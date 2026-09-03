from datetime import UTC, datetime
from uuid import uuid4

from fastapi.testclient import TestClient

from backend.app.main import create_app
from backend.app.models import Coverage, Location, NearbyResponse


class FakeResourceService:
    async def search(self, query, request_id: str) -> NearbyResponse:
        return NearbyResponse(
            request_id=request_id,
            generated_at=datetime.now(UTC),
            location=Location(
                query_type="city" if query.city else "coordinates",
                display_name=query.city or "Current location",
                city=query.city,
                district="Mumbai Suburban" if query.city else None,
                state="Maharashtra" if query.city else None,
                latitude=query.latitude or 19.076,
                longitude=query.longitude or 72.8777,
            ),
            coverage=Coverage(
                radius_metres=query.radius_km * 1000,
                healthcare_status="available",
                is_partial=False,
                warnings=[],
            ),
            resources=[],
            meta={"total": 0},
        )


def client() -> TestClient:
    return TestClient(create_app(FakeResourceService()))


def test_health_contract() -> None:
    with client() as test_client:
        response = test_client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"
    assert response.headers["x-request-id"]


def test_city_search_contract() -> None:
    with client() as test_client:
        response = test_client.get("/api/v1/resources/nearby", params={"city": "Mumbai"})
    assert response.status_code == 200
    assert response.json()["location"]["display_name"] == "Mumbai"
    assert response.json()["request_id"] == response.headers["x-request-id"]


def test_supported_indian_language_is_accepted() -> None:
    with client() as test_client:
        response = test_client.get(
            "/api/v1/resources/nearby",
            params={"city": "दादर", "language": "hi"},
        )
    assert response.status_code == 200
    assert response.json()["location"]["display_name"] == "दादर"


def test_unsupported_language_is_rejected() -> None:
    with client() as test_client:
        response = test_client.get(
            "/api/v1/resources/nearby",
            params={"city": "Dadar", "language": "fr"},
        )
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


def test_missing_location_is_rejected() -> None:
    with client() as test_client:
        response = test_client.get("/api/v1/resources/nearby")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_REQUEST"


def test_outside_mumbai_is_rejected() -> None:
    with client() as test_client:
        response = test_client.get(
            "/api/v1/resources/nearby",
            params={"latitude": 28.6139, "longitude": 77.209},
        )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "LOCATION_OUTSIDE_SERVICE_AREA"
    assert "outside Mumbai" in response.json()["error"]["message"]


def test_unknown_api_is_structured() -> None:
    with client() as test_client:
        response = test_client.get(f"/api/{uuid4()}")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "INVALID_REQUEST"
