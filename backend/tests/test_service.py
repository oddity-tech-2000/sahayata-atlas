import httpx
import pytest

from backend.app.errors import ApiError
from backend.app.models import NearbyQuery
from backend.app.service import ResourceService
from backend.app.settings import Settings


def service_with(handler) -> tuple[ResourceService, httpx.AsyncClient]:
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    settings = Settings(photon_min_interval_seconds=0, nominatim_min_interval_seconds=0)
    return ResourceService(client, settings), client


@pytest.mark.asyncio
async def test_nominatim_finds_a_mumbai_place_other_geocoders_miss() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.host == "geocoding-api.open-meteo.com":
            return httpx.Response(200, json={"results": []})
        if request.url.host == "photon.komoot.io":
            return httpx.Response(200, json={"features": []})
        assert request.url.params["q"] == "Marol Naka, Mumbai, Maharashtra, India"
        assert request.url.params["bounded"] == "1"
        assert request.url.params["countrycodes"] == "in"
        assert request.headers["user-agent"].startswith("SahayataAtlas/")
        return httpx.Response(
            200,
            json=[
                {
                    "lat": "19.0597",
                    "lon": "72.8830",
                    "name": "Marol Naka",
                    "display_name": "Marol Naka, Andheri East, Mumbai, Maharashtra, India",
                    "address": {
                        "city_district": "Mumbai Suburban",
                        "state": "Maharashtra",
                    },
                }
            ],
        )

    service, client = service_with(handler)
    try:
        first = await service._resolve_location(NearbyQuery(city="Marol   Naka"))
        second = await service._resolve_location(NearbyQuery(city="marol naka"))
    finally:
        await client.aclose()

    assert first.display_name == "Marol Naka"
    assert first.district == "Mumbai Suburban"
    assert first.state == "Maharashtra"
    assert first.latitude == 19.0597
    assert second == first
    assert len(requests) == 3


@pytest.mark.asyncio
async def test_open_meteo_match_does_not_call_nominatim() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json={
                "results": [
                    {
                        "name": "Bandra",
                        "country_code": "IN",
                        "admin1": "Maharashtra",
                        "admin2": "Mumbai Suburban",
                        "latitude": 19.0544,
                        "longitude": 72.8402,
                    }
                ]
            },
        )

    service, client = service_with(handler)
    try:
        location = await service._resolve_location(NearbyQuery(city="Bandra"))
    finally:
        await client.aclose()

    assert location.display_name == "Bandra"
    assert len(requests) == 1


@pytest.mark.parametrize(
    ("language", "submitted", "resolved_name"),
    [
        ("hi", "दादर", "दादर"),
        ("mr", "काळबादेवी", "काळबादेवी"),
    ],
)
@pytest.mark.asyncio
async def test_indian_language_place_search_uses_nominatim(
    language: str,
    submitted: str,
    resolved_name: str,
) -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.host == "geocoding-api.open-meteo.com":
            assert request.url.params["language"] == language
            return httpx.Response(200, json={"results": []})
        assert request.url.host == "nominatim.openstreetmap.org"
        assert request.url.params["accept-language"] == language
        return httpx.Response(
            200,
            json=[
                {
                    "lat": "18.9986",
                    "lon": "72.8377",
                    "name": resolved_name,
                    "display_name": f"{resolved_name}, मुंबई, महाराष्ट्र, भारत",
                    "address": {"city_district": "मुंबई", "state": "महाराष्ट्र"},
                }
            ],
        )

    service, client = service_with(handler)
    try:
        location = await service._resolve_location(
            NearbyQuery(city=submitted, language=language),
        )
    finally:
        await client.aclose()

    assert location.display_name == resolved_name
    assert [request.url.host for request in requests] == [
        "geocoding-api.open-meteo.com",
        "nominatim.openstreetmap.org",
    ]


@pytest.mark.asyncio
async def test_outside_mumbai_result_stays_outside_service_area() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "geocoding-api.open-meteo.com":
            return httpx.Response(
                200,
                json={
                    "results": [
                        {
                            "name": "Delhi",
                            "country_code": "IN",
                            "latitude": 28.6139,
                            "longitude": 77.209,
                        }
                    ]
                },
            )
        if request.url.host == "photon.komoot.io":
            return httpx.Response(200, json={"features": []})
        return httpx.Response(200, json=[])

    service, client = service_with(handler)
    try:
        with pytest.raises(ApiError) as caught:
            await service._resolve_location(NearbyQuery(city="Delhi"))
    finally:
        await client.aclose()

    assert caught.value.status_code == 422
    assert caught.value.code == "LOCATION_OUTSIDE_SERVICE_AREA"


@pytest.mark.asyncio
async def test_unknown_place_returns_location_not_found() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if "open-meteo" in request.url.host:
            return httpx.Response(200, json={"results": []})
        if request.url.host == "photon.komoot.io":
            return httpx.Response(200, json={"features": []})
        return httpx.Response(200, json=[])

    service, client = service_with(handler)
    try:
        with pytest.raises(ApiError) as caught:
            await service._resolve_location(NearbyQuery(city="not a real mumbai place"))
    finally:
        await client.aclose()

    assert caught.value.status_code == 404
    assert caught.value.code == "LOCATION_NOT_FOUND"


@pytest.mark.parametrize(
    ("submitted", "resolved_name"),
    [
        ("Dadar", "Dadar"),
        ("Marine Line", "Marine Lines"),
        ("Kalbadevi", "Kalbadevi"),
    ],
)
@pytest.mark.asyncio
async def test_requested_mumbai_places_use_bounded_fallback(
    submitted: str,
    resolved_name: str,
) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.host == "geocoding-api.open-meteo.com":
            return httpx.Response(200, json={"results": []})
        assert request.url.host == "photon.komoot.io"
        assert request.url.params["q"] == submitted
        assert request.url.params["bbox"] == "72.7,18.85,73.15,19.35"
        return httpx.Response(
            200,
            json={
                "features": [
                    {
                        "type": "Feature",
                        "geometry": {"type": "Point", "coordinates": [72.83, 18.975]},
                        "properties": {
                            "name": resolved_name,
                            "district": "Mumbai City",
                            "state": "Maharashtra",
                        },
                    }
                ]
            },
        )

    service, client = service_with(handler)
    try:
        location = await service._resolve_location(NearbyQuery(city=submitted))
    finally:
        await client.aclose()

    assert location.display_name == resolved_name
    assert location.district == "Mumbai City"
