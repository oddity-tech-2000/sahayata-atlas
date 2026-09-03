import asyncio
import math
import re
from datetime import UTC, datetime
from typing import Any

import httpx
from cachetools import TTLCache

from .errors import ApiError, ProviderError
from .models import (
    Category,
    Coverage,
    FacilityType,
    Location,
    NearbyQuery,
    NearbyResponse,
    Organisation,
    OrganisationType,
    Resource,
    Source,
)
from .settings import Settings

USER_AGENT = "SahayataAtlas/1.0 (public emergency-resource discovery)"
MUMBAI_BOUNDS = (18.85, 72.70, 19.35, 73.15)


def inside_mumbai(latitude: float, longitude: float) -> bool:
    south, west, north, east = MUMBAI_BOUNDS
    return south <= latitude <= north and west <= longitude <= east


class ResourceService:
    def __init__(self, client: httpx.AsyncClient, settings: Settings) -> None:
        self.client = client
        self.settings = settings
        self.cache: TTLCache[str, NearbyResponse] = TTLCache(
            maxsize=settings.cache_max_entries,
            ttl=settings.cache_ttl_seconds,
        )
        self.cache_lock = asyncio.Lock()

    async def search(self, query: NearbyQuery, request_id: str) -> NearbyResponse:
        key = self._cache_key(query)
        async with self.cache_lock:
            cached = self.cache.get(key)
        if cached:
            return cached.model_copy(update={"request_id": request_id})

        location = await self._resolve_location(query)
        radius_metres = query.radius_km * 1000
        osm_result, wikipedia_result = await asyncio.gather(
            self._openstreetmap(location.latitude, location.longitude, radius_metres),
            self._wikipedia(location.latitude, location.longitude, radius_metres),
            return_exceptions=True,
        )
        failures = [item for item in (osm_result, wikipedia_result) if isinstance(item, Exception)]
        if len(failures) == 2:
            timed_out = all(isinstance(item, ProviderError) and item.timed_out for item in failures)
            raise ApiError(
                504 if timed_out else 502,
                "UPSTREAM_TIMEOUT" if timed_out else "UPSTREAM_FAILURE",
                "Public data providers took too long to respond. Please try again."
                if timed_out
                else "Public data providers are temporarily unavailable. Please try again.",
                retryable=True,
            )

        warnings: list[str] = []
        if isinstance(osm_result, Exception):
            warnings.append("Hospital and emergency-service listings are temporarily unavailable.")
            osm_resources: list[Resource] = []
        else:
            osm_resources = osm_result
        if isinstance(wikipedia_result, Exception):
            warnings.append("Some general public-place listings are temporarily unavailable.")
            wikipedia_resources: list[Resource] = []
        else:
            wikipedia_resources = wikipedia_result
        if radius_metres > 10_000:
            warnings.append("Wikipedia public-place coverage is limited to the nearest 10 km.")

        resources = self._deduplicate([*osm_resources, *wikipedia_resources])
        partial = bool(warnings)
        response = NearbyResponse(
            request_id=request_id,
            generated_at=datetime.now(UTC),
            location=location,
            coverage=Coverage(
                radius_metres=radius_metres,
                healthcare_status="unavailable"
                if isinstance(osm_result, Exception)
                else "partial"
                if partial
                else "available",
                is_partial=partial,
                warnings=warnings,
            ),
            resources=resources,
            meta={"total": len(resources)},
        )
        async with self.cache_lock:
            self.cache[key] = response
        return response

    async def _get_json(
        self,
        provider: str,
        url: str,
        *,
        params: dict[str, Any] | None = None,
        data: dict[str, str] | None = None,
    ) -> dict[str, Any]:
        try:
            response = await self.client.request(
                "POST" if data else "GET",
                url,
                params=params,
                data=data,
                headers={"Accept": "application/json", "User-Agent": USER_AGENT},
                timeout=self.settings.upstream_timeout_seconds,
            )
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict):
                raise ValueError("Expected a JSON object")
            return payload
        except httpx.TimeoutException as error:
            raise ProviderError(provider, timed_out=True) from error
        except (httpx.HTTPError, ValueError) as error:
            raise ProviderError(provider) from error

    async def _resolve_location(self, query: NearbyQuery) -> Location:
        if query.city is None:
            return Location(
                query_type="coordinates",
                display_name="Current location",
                latitude=query.latitude,
                longitude=query.longitude,
            )
        payload = await self._get_json(
            "Open-Meteo",
            "https://geocoding-api.open-meteo.com/v1/search",
            params={
                "name": query.city,
                "count": 5,
                "countryCode": "IN",
                "language": "en",
                "format": "json",
            },
        )
        results = payload.get("results")
        if not isinstance(results, list):
            raise ApiError(404, "LOCATION_NOT_FOUND", "That Mumbai locality could not be found.")
        match = next(
            (
                item
                for item in results
                if isinstance(item, dict)
                and item.get("country_code") == "IN"
                and isinstance(item.get("latitude"), int | float)
                and isinstance(item.get("longitude"), int | float)
                and inside_mumbai(float(item["latitude"]), float(item["longitude"]))
            ),
            None,
        )
        if match is None:
            raise ApiError(
                422,
                "LOCATION_OUTSIDE_SERVICE_AREA",
                "This region is outside Mumbai and is currently not available. "
                "Search a Mumbai locality instead.",
            )
        name = str(match.get("name") or query.city)
        return Location(
            query_type="city",
            display_name=name,
            city=name,
            district=str(match["admin2"]) if match.get("admin2") else None,
            state=str(match["admin1"]) if match.get("admin1") else None,
            latitude=float(match["latitude"]),
            longitude=float(match["longitude"]),
        )

    async def _openstreetmap(
        self,
        latitude: float,
        longitude: float,
        radius_metres: int,
    ) -> list[Resource]:
        query = f'''[out:json][timeout:5];(
          nwr(around:{radius_metres},{latitude},{longitude})["amenity"~"^(hospital|clinic|police|fire_station)$"];
          nwr(around:{radius_metres},{latitude},{longitude})["healthcare"="hospital"];
          nwr(around:{radius_metres},{latitude},{longitude})["emergency"="ambulance_station"];
        );out center tags 200;'''
        payload = await self._get_json(
            "OpenStreetMap",
            self.settings.overpass_url,
            data={"data": query},
        )
        elements = payload.get("elements", [])
        if not isinstance(elements, list):
            raise ProviderError("OpenStreetMap")
        resources: list[Resource] = []
        for element in elements:
            if not isinstance(element, dict):
                continue
            center = element.get("center") if isinstance(element.get("center"), dict) else {}
            lat = element.get("lat", center.get("lat"))
            lon = element.get("lon", center.get("lon"))
            if not isinstance(lat, int | float) or not isinstance(lon, int | float):
                continue
            raw_tags = element.get("tags") if isinstance(element.get("tags"), dict) else {}
            tags = {str(key): str(value) for key, value in raw_tags.items()}
            fallback = tags.get("amenity") or tags.get("healthcare") or "public resource"
            name = (
                tags.get("name")
                or tags.get("name:en")
                or f"Unnamed {fallback.replace('_', ' ')}"
            )[:200]
            category, facility = self._classify(tags, name)
            object_type = str(element.get("type", "node"))
            object_id = str(element.get("id", "unknown"))
            resources.append(
                Resource(
                    id=f"osm:{object_type}:{object_id}",
                    name=name,
                    category=category,
                    facility_type=facility,
                    latitude=float(lat),
                    longitude=float(lon),
                    distance_metres=self._distance(latitude, longitude, float(lat), float(lon)),
                    organisation=self._organisation(tags, name),
                    source=Source(
                        name="OpenStreetMap",
                        record_id=f"{object_type}/{object_id}",
                        record_url=f"https://www.openstreetmap.org/{object_type}/{object_id}",
                    ),
                )
            )
        return resources

    async def _wikipedia(
        self,
        latitude: float,
        longitude: float,
        radius_metres: int,
    ) -> list[Resource]:
        payload = await self._get_json(
            "Wikipedia",
            "https://en.wikipedia.org/w/api.php",
            params={
                "action": "query",
                "list": "geosearch",
                "gscoord": f"{latitude}|{longitude}",
                "gsradius": min(radius_metres, 10_000),
                "gslimit": 40,
                "format": "json",
            },
        )
        query = payload.get("query")
        places = query.get("geosearch", []) if isinstance(query, dict) else []
        if not isinstance(places, list):
            raise ProviderError("Wikipedia")
        resources: list[Resource] = []
        for place in places:
            if not isinstance(place, dict):
                continue
            lat, lon = place.get("lat"), place.get("lon")
            if not isinstance(lat, int | float) or not isinstance(lon, int | float):
                continue
            title = str(place.get("title") or "Public place")[:200]
            category, facility = self._classify({}, title)
            page_id = str(place.get("pageid", "unknown"))
            distance = place.get("dist")
            resources.append(
                Resource(
                    id=f"wikipedia:page:{page_id}",
                    name=title,
                    category=category,
                    facility_type=facility,
                    latitude=float(lat),
                    longitude=float(lon),
                    distance_metres=round(distance)
                    if isinstance(distance, int | float)
                    else self._distance(latitude, longitude, float(lat), float(lon)),
                    organisation=Organisation(
                        type=OrganisationType.UNCLASSIFIED,
                        inferred=True,
                    ),
                    source=Source(
                        name="Wikipedia",
                        record_id=f"page/{page_id}",
                        record_url=f"https://en.wikipedia.org/?curid={page_id}",
                    ),
                )
            )
        return resources

    @staticmethod
    def _classify(tags: dict[str, str], label: str) -> tuple[Category, FacilityType]:
        amenity = tags.get("amenity", "")
        healthcare = tags.get("healthcare", "")
        text = f"{amenity} {healthcare} {tags.get('emergency', '')} {label}".lower()
        if (
            amenity == "hospital"
            or healthcare == "hospital"
            or re.search(r"hospital|medical centre", text)
        ):
            return Category.MEDICAL, FacilityType.HOSPITAL
        if (
            amenity in {"clinic", "doctors"}
            or healthcare in {"clinic", "doctor"}
            or re.search(r"clinic|dispensary", text)
        ):
            return Category.MEDICAL, FacilityType.CLINIC
        if re.search(r"police|fire_station|ambulance|emergency", text):
            return Category.SECURITY, FacilityType.PUBLIC_PLACE
        if re.search(r"school|college|community_centre|townhall|social_facility|shelter", text):
            return Category.SHELTER, FacilityType.PUBLIC_PLACE
        return Category.GENERAL, FacilityType.PUBLIC_PLACE

    @staticmethod
    def _organisation(tags: dict[str, str], label: str) -> Organisation:
        explicit = f"{tags.get('operator:type', '')} {tags.get('ownership', '')}".lower()
        context = f"{label} {tags.get('operator', '')} {tags.get('owner', '')}".lower()
        candidate = explicit or context
        organisation_type = OrganisationType.UNCLASSIFIED
        if re.search(r"private|company|limited|pvt\.?|ltd\.?", candidate):
            organisation_type = OrganisationType.PRIVATE
        elif re.search(r"public_sector|psu|corporation|authority", candidate):
            organisation_type = OrganisationType.PUBLIC_SECTOR
        elif re.search(
            r"government|public|municipal|civic|district|state|central|ministry",
            candidate,
        ):
            organisation_type = OrganisationType.GOVERNMENT
        return Organisation(
            type=organisation_type,
            name=tags.get("operator") or tags.get("owner"),
            inferred=not bool(explicit),
        )

    @staticmethod
    def _distance(
        origin_lat: float,
        origin_lon: float,
        target_lat: float,
        target_lon: float,
    ) -> int:
        radians = math.radians
        delta_lat = radians(target_lat - origin_lat)
        delta_lon = radians(target_lon - origin_lon)
        value = math.sin(delta_lat / 2) ** 2 + math.cos(radians(origin_lat)) * math.cos(
            radians(target_lat)
        ) * math.sin(delta_lon / 2) ** 2
        return round(6_371_000 * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value)))

    @staticmethod
    def _deduplicate(resources: list[Resource]) -> list[Resource]:
        unique: dict[str, Resource] = {}
        for resource in resources:
            key = re.sub(r"[^a-z0-9]+", " ", resource.name.lower()).strip()
            current = unique.get(key)
            if current is None or (
                current.source.name == "Wikipedia" and resource.source.name == "OpenStreetMap"
            ):
                unique[key] = resource
        return sorted(
            unique.values(),
            key=lambda resource: resource.distance_metres
            if resource.distance_metres is not None
            else math.inf,
        )[:200]

    @staticmethod
    def _cache_key(query: NearbyQuery) -> str:
        if query.city:
            return f"city:{query.city.lower()}:{query.radius_km}"
        return f"coordinates:{query.latitude:.3f}:{query.longitude:.3f}:{query.radius_km}"
