from datetime import datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, Field


class Category(StrEnum):
    MEDICAL = "medical"
    SHELTER = "shelter"
    SECURITY = "security"
    GENERAL = "general"


class FacilityType(StrEnum):
    HOSPITAL = "hospital"
    CLINIC = "clinic"
    PUBLIC_PLACE = "public_place"


class OrganisationType(StrEnum):
    GOVERNMENT = "government"
    PRIVATE = "private"
    PUBLIC_SECTOR = "public_sector"
    UNCLASSIFIED = "unclassified"


class Organisation(BaseModel):
    type: OrganisationType
    name: str | None = None
    inferred: bool


class Source(BaseModel):
    name: Literal["OpenStreetMap", "Wikipedia"]
    record_id: str
    record_url: str
    updated_at: datetime | None = None


class Resource(BaseModel):
    id: str
    name: str = Field(min_length=1, max_length=200)
    category: Category
    facility_type: FacilityType
    latitude: float
    longitude: float
    distance_metres: int | None = Field(default=None, ge=0)
    organisation: Organisation
    listing_status: Literal["listed"] = "listed"
    source: Source


class Location(BaseModel):
    query_type: Literal["city", "coordinates"]
    display_name: str
    city: str | None = None
    district: str | None = None
    state: str | None = None
    country_code: Literal["IN"] = "IN"
    latitude: float
    longitude: float


class Coverage(BaseModel):
    radius_metres: int
    healthcare_status: Literal["available", "partial", "unavailable"]
    is_partial: bool
    warnings: list[str]


class NearbyResponse(BaseModel):
    schema_version: Literal["1.0"] = "1.0"
    request_id: str
    generated_at: datetime
    location: Location
    coverage: Coverage
    resources: list[Resource]
    meta: dict[Literal["total"], int]


class NearbyQuery(BaseModel):
    city: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    radius_km: int = 10
