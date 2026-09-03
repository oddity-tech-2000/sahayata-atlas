import asyncio
import math
import re
from datetime import UTC, datetime
from difflib import SequenceMatcher
from time import monotonic
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

USER_AGENT = "SahayataAtlas/1.1 (+https://sahayata-atlas-ur3z.onrender.com/)"
MUMBAI_BOUNDS = (18.85, 72.70, 19.35, 73.15)
MUMBAI_CENTER = (19.076, 72.8777)


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
        self.location_cache: TTLCache[str, Location] = TTLCache(
            maxsize=settings.cache_max_entries,
            ttl=settings.geocoding_cache_ttl_seconds,
        )
        self.cache_lock = asyncio.Lock()
        self.location_cache_lock = asyncio.Lock()
        self.photon_lock = asyncio.Lock()
        self.photon_last_request = 0.0
        self.nominatim_lock = asyncio.Lock()
        self.nominatim_last_request = 0.0

    async def search(self, query: NearbyQuery, request_id: str) -> NearbyResponse:
        key = self._cache_key(query)
        async with self.cache_lock:
            cached = self.cache.get(key)
        if cached:
            return cached.model_copy(update={"request_id": request_id})

        location = await self._resolve_location(query)
        radius_metres = query.radius_km * 1000
        osm_result, wikipedia_result = await asyncio.gather(
            self._openstreetmap(
                location.latitude,
                location.longitude,
                radius_metres,
                query.language,
            ),
            self._wikipedia(
                location.latitude,
                location.longitude,
                radius_metres,
                query.language,
            ),
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

    async def _get_json_list(
        self,
        provider: str,
        url: str,
        *,
        params: dict[str, Any] | None = None,
    ) -> list[Any]:
        try:
            response = await self.client.get(
                url,
                params=params,
                headers={"Accept": "application/json", "User-Agent": USER_AGENT},
                timeout=self.settings.upstream_timeout_seconds,
            )
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, list):
                raise ValueError("Expected a JSON array")
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
        search_term = " ".join(query.city.split())
        cache_key = f"{query.language}:{search_term.casefold()}"
        async with self.location_cache_lock:
            cached = self.location_cache.get(cache_key)
        if cached:
            return cached

        failures: list[ProviderError] = []
        outside_service_area = False
        try:
            payload = await self._get_json(
                "Open-Meteo",
                "https://geocoding-api.open-meteo.com/v1/search",
                params={
                    "name": search_term,
                    "count": 10,
                    "countryCode": "IN",
                    "language": query.language,
                    "format": "json",
                },
            )
            raw_results = payload.get("results")
            results = raw_results if isinstance(raw_results, list) else []
            outside_service_area = any(self._is_valid_geocoding_result(item) for item in results)
            match = next(
                (
                    item
                    for item in results
                    if self._is_valid_geocoding_result(item)
                    and inside_mumbai(float(item["latitude"]), float(item["longitude"]))
                ),
                None,
            )
            if isinstance(match, dict):
                location = self._open_meteo_location(match, search_term)
                await self._cache_location(cache_key, location)
                return location
        except ProviderError as error:
            failures.append(error)

        if query.language == "en":
            try:
                features = await self._photon(search_term)
                match = self._best_photon_match(features, search_term)
                if match is not None:
                    location = self._photon_location(match, search_term)
                    await self._cache_location(cache_key, location)
                    return location
            except ProviderError as error:
                failures.append(error)

        try:
            results = await self._nominatim(search_term, query.language)
            match = next(
                (
                    item
                    for item in results
                    if isinstance(item, dict)
                    and self._coordinate(item.get("lat")) is not None
                    and self._coordinate(item.get("lon")) is not None
                    and inside_mumbai(
                        self._coordinate(item.get("lat")),
                        self._coordinate(item.get("lon")),
                    )
                ),
                None,
            )
            if isinstance(match, dict):
                location = self._nominatim_location(match, search_term)
                await self._cache_location(cache_key, location)
                return location
        except ProviderError as error:
            failures.append(error)

        provider_count = 3 if query.language == "en" else 2
        if len(failures) == provider_count:
            timed_out = all(error.timed_out for error in failures)
            raise ApiError(
                504 if timed_out else 502,
                "UPSTREAM_TIMEOUT" if timed_out else "UPSTREAM_FAILURE",
                "Location providers took too long to respond. Please try again."
                if timed_out
                else "Location search is temporarily unavailable. Please try again.",
                retryable=True,
            )
        if outside_service_area:
            raise ApiError(
                422,
                "LOCATION_OUTSIDE_SERVICE_AREA",
                "This region is outside Mumbai and is currently not available. "
                "Search a Mumbai locality instead.",
            )
        raise ApiError(404, "LOCATION_NOT_FOUND", "That Mumbai locality could not be found.")

    async def _photon(self, search_term: str) -> list[Any]:
        south, west, north, east = MUMBAI_BOUNDS
        async with self.photon_lock:
            wait_seconds = self.settings.photon_min_interval_seconds - (
                monotonic() - self.photon_last_request
            )
            if wait_seconds > 0:
                await asyncio.sleep(wait_seconds)
            self.photon_last_request = monotonic()
            payload = await self._get_json(
                "OpenStreetMap Photon",
                self.settings.photon_url,
                params={
                    "q": search_term,
                    "lat": MUMBAI_CENTER[0],
                    "lon": MUMBAI_CENTER[1],
                    "bbox": f"{west},{south},{east},{north}",
                    "location_bias_scale": 0.1,
                    "limit": 10,
                    "lang": "en",
                },
            )
        features = payload.get("features")
        if not isinstance(features, list):
            raise ProviderError("OpenStreetMap Photon")
        return features

    async def _nominatim(self, search_term: str, language: str = "en") -> list[Any]:
        south, west, north, east = MUMBAI_BOUNDS
        async with self.nominatim_lock:
            wait_seconds = self.settings.nominatim_min_interval_seconds - (
                monotonic() - self.nominatim_last_request
            )
            if wait_seconds > 0:
                await asyncio.sleep(wait_seconds)
            self.nominatim_last_request = monotonic()
            return await self._get_json_list(
                "OpenStreetMap Nominatim",
                self.settings.nominatim_url,
                params={
                    "q": f"{search_term}, Mumbai, Maharashtra, India",
                    "format": "jsonv2",
                    "addressdetails": 1,
                    "limit": 10,
                    "countrycodes": "in",
                    "viewbox": f"{west},{north},{east},{south}",
                    "bounded": 1,
                    "accept-language": language,
                },
            )

    async def _cache_location(self, cache_key: str, location: Location) -> None:
        async with self.location_cache_lock:
            self.location_cache[cache_key] = location

    @staticmethod
    def _is_valid_geocoding_result(item: Any) -> bool:
        return (
            isinstance(item, dict)
            and item.get("country_code") == "IN"
            and isinstance(item.get("latitude"), int | float)
            and isinstance(item.get("longitude"), int | float)
        )

    @staticmethod
    def _coordinate(value: Any) -> float | None:
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    @classmethod
    def _best_photon_match(cls, features: list[Any], search_term: str) -> dict[str, Any] | None:
        query_text = cls._normalise_place_text(search_term)
        candidates: list[tuple[float, float, int, dict[str, Any]]] = []
        for index, feature in enumerate(features):
            if not isinstance(feature, dict):
                continue
            geometry = feature.get("geometry")
            properties = feature.get("properties")
            if not isinstance(geometry, dict) or not isinstance(properties, dict):
                continue
            coordinates = geometry.get("coordinates")
            if not isinstance(coordinates, list) or len(coordinates) < 2:
                continue
            longitude = cls._coordinate(coordinates[0])
            latitude = cls._coordinate(coordinates[1])
            if latitude is None or longitude is None or not inside_mumbai(latitude, longitude):
                continue
            labels = [
                properties.get(key)
                for key in ("name", "street", "locality", "district", "city", "county")
                if properties.get(key)
            ]
            similarity = max(
                (
                    SequenceMatcher(
                        None,
                        query_text,
                        cls._normalise_place_text(str(label)),
                    ).ratio()
                    for label in labels
                ),
                default=0.0,
            )
            if similarity < 0.45:
                continue
            centre_distance = cls._distance(
                MUMBAI_CENTER[0],
                MUMBAI_CENTER[1],
                latitude,
                longitude,
            )
            candidates.append((similarity, -centre_distance, -index, feature))
        return max(candidates, default=None, key=lambda item: item[:3])[3] if candidates else None

    @staticmethod
    def _normalise_place_text(value: str) -> str:
        return re.sub(r"[^a-z0-9]+", " ", value.casefold()).strip()

    @staticmethod
    def _open_meteo_location(match: dict[str, Any], search_term: str) -> Location:
        name = str(match.get("name") or search_term)
        return Location(
            query_type="city",
            display_name=name,
            city=name,
            district=str(match["admin2"]) if match.get("admin2") else None,
            state=str(match["admin1"]) if match.get("admin1") else None,
            latitude=float(match["latitude"]),
            longitude=float(match["longitude"]),
        )

    @classmethod
    def _nominatim_location(cls, match: dict[str, Any], search_term: str) -> Location:
        latitude = cls._coordinate(match.get("lat"))
        longitude = cls._coordinate(match.get("lon"))
        if latitude is None or longitude is None:
            raise ValueError("Nominatim result is missing coordinates")
        address = match.get("address") if isinstance(match.get("address"), dict) else {}
        district = (
            address.get("city_district")
            or address.get("state_district")
            or address.get("county")
        )
        state = address.get("state")
        return Location(
            query_type="city",
            display_name=search_term,
            city=search_term,
            district=str(district) if district else None,
            state=str(state) if state else None,
            latitude=latitude,
            longitude=longitude,
        )

    @classmethod
    def _photon_location(cls, match: dict[str, Any], search_term: str) -> Location:
        geometry = match.get("geometry") if isinstance(match.get("geometry"), dict) else {}
        properties = (
            match.get("properties") if isinstance(match.get("properties"), dict) else {}
        )
        coordinates = geometry.get("coordinates")
        if not isinstance(coordinates, list) or len(coordinates) < 2:
            raise ValueError("Photon result is missing coordinates")
        longitude = cls._coordinate(coordinates[0])
        latitude = cls._coordinate(coordinates[1])
        if latitude is None or longitude is None:
            raise ValueError("Photon result is missing coordinates")
        name = str(properties.get("name") or properties.get("street") or search_term)
        district = properties.get("district") or properties.get("county")
        state = properties.get("state")
        return Location(
            query_type="city",
            display_name=name,
            city=name,
            district=str(district) if district else None,
            state=str(state) if state else None,
            latitude=latitude,
            longitude=longitude,
        )

    async def _openstreetmap(
        self,
        latitude: float,
        longitude: float,
        radius_metres: int,
        language: str = "en",
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
                tags.get(f"name:{language}")
                or tags.get("name")
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
        language: str = "en",
    ) -> list[Resource]:
        payload = await self._get_json(
            "Wikipedia",
            f"https://{language}.wikipedia.org/w/api.php",
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
                        record_url=f"https://{language}.wikipedia.org/?curid={page_id}",
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
            return f"city:{query.language}:{query.city.lower()}:{query.radius_km}"
        return (
            f"coordinates:{query.language}:{query.latitude:.3f}:"
            f"{query.longitude:.3f}:{query.radius_km}"
        )
