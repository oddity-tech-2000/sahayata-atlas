import logging
import time
from collections import defaultdict, deque
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any
from uuid import uuid4

import httpx
from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .errors import ApiError
from .models import NearbyQuery, NearbyResponse
from .service import ResourceService, inside_mumbai
from .settings import get_settings

settings = get_settings()
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("sahayata_atlas")


class MinuteRateLimiter:
    def __init__(self, limit: int) -> None:
        self.limit = limit
        self.requests: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
        now = time.monotonic()
        window = self.requests[key]
        while window and window[0] < now - 60:
            window.popleft()
        if len(window) >= self.limit:
            return False
        window.append(now)
        return True


def error_payload(error: ApiError, request_id: str) -> dict[str, Any]:
    return {
        "error": {
            "code": error.code,
            "message": error.message,
            "retryable": error.retryable,
            "request_id": request_id,
            "details": error.details,
        }
    }


def create_app(resource_service: ResourceService | Any | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(application: FastAPI) -> AsyncIterator[None]:
        if resource_service is None:
            client = httpx.AsyncClient(follow_redirects=True)
            application.state.resource_service = ResourceService(client, settings)
            try:
                yield
            finally:
                await client.aclose()
        else:
            application.state.resource_service = resource_service
            yield

    application = FastAPI(
        title="Sahayata Atlas API",
        version="1.0.0",
        docs_url="/api/docs" if settings.environment != "production" else None,
        redoc_url=None,
        lifespan=lifespan,
    )
    limiter = MinuteRateLimiter(settings.rate_limit_per_minute)

    @application.middleware("http")
    async def request_context(request: Request, call_next):
        request.state.request_id = str(uuid4())
        started = time.perf_counter()
        response = await call_next(request)
        response.headers["X-Request-ID"] = request.state.request_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(self)"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' "
            "https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; "
            "img-src 'self' data: blob: https://*.tile.openstreetmap.org; connect-src 'self'; "
            "frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
        )
        logger.info(
            "request_complete request_id=%s method=%s path=%s status=%s duration_ms=%s",
            request.state.request_id,
            request.method,
            request.url.path,
            response.status_code,
            round((time.perf_counter() - started) * 1000),
        )
        return response

    @application.exception_handler(ApiError)
    async def handle_api_error(request: Request, error: ApiError):
        return JSONResponse(
            status_code=error.status_code,
            content=error_payload(error, request.state.request_id),
            headers={"Cache-Control": "no-store"},
        )

    @application.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, _error: RequestValidationError):
        error = ApiError(
            400,
            "INVALID_REQUEST",
            "Provide a Mumbai locality or a valid latitude and longitude pair within Mumbai.",
        )
        return JSONResponse(status_code=400, content=error_payload(error, request.state.request_id))

    @application.get("/api/v1/health")
    async def health() -> dict[str, str]:
        from datetime import UTC, datetime

        return {"status": "ok", "version": "1.0.0", "time": datetime.now(UTC).isoformat()}

    @application.get("/api/v1/resources/nearby", response_model=NearbyResponse)
    async def nearby_resources(
        request: Request,
        city: str | None = Query(default=None, max_length=100),
        latitude: float | None = Query(default=None, ge=-90, le=90),
        longitude: float | None = Query(default=None, ge=-180, le=180),
        radius_km: int = Query(default=10, ge=1, le=50),
    ) -> NearbyResponse:
        client_ip = request.client.host if request.client else "unknown"
        if not limiter.allow(client_ip):
            raise ApiError(
                429,
                "RATE_LIMITED",
                "Too many searches were requested. Please wait a moment and try again.",
                retryable=True,
            )
        cleaned_city = city.strip() if city else None
        coordinate_mode = latitude is not None or longitude is not None
        if (
            bool(cleaned_city) == coordinate_mode
            or (latitude is None) != (longitude is None)
            or (cleaned_city is not None and len(cleaned_city) < 2)
        ):
            raise ApiError(
                400,
                "INVALID_REQUEST",
                "Provide a Mumbai locality or a valid latitude and longitude pair within Mumbai.",
            )
        if (
            latitude is not None
            and longitude is not None
            and not inside_mumbai(latitude, longitude)
        ):
            raise ApiError(
                422,
                "LOCATION_OUTSIDE_SERVICE_AREA",
                "This region is outside Mumbai and is currently not available. "
                "Search a Mumbai locality instead.",
            )
        return await request.app.state.resource_service.search(
            NearbyQuery(
                city=cleaned_city,
                latitude=latitude,
                longitude=longitude,
                radius_km=radius_km,
            ),
            request.state.request_id,
        )

    @application.api_route(
        "/api/{path:path}",
        methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    )
    async def unknown_api(request: Request, path: str):
        del path
        error = ApiError(404, "INVALID_REQUEST", "That API endpoint does not exist.")
        return JSONResponse(status_code=404, content=error_payload(error, request.state.request_id))

    client_dir = Path(__file__).resolve().parents[2] / "dist" / "client"
    assets_dir = client_dir / "assets"
    if assets_dir.is_dir():
        application.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @application.get("/{path:path}", include_in_schema=False)
    async def frontend(path: str):
        requested = (client_dir / path).resolve()
        if client_dir in requested.parents and requested.is_file():
            return FileResponse(requested)
        index = client_dir / "index.html"
        if index.is_file():
            return FileResponse(index, headers={"Cache-Control": "no-cache"})
        raise ApiError(
            503,
            "INTERNAL_ERROR",
            "The frontend build is not available.",
            retryable=True,
        )

    return application


app = create_app()
