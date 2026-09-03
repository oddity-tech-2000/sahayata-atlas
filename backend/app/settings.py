from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    log_level: str = "INFO"
    upstream_timeout_seconds: float = 6.0
    overpass_url: str = "https://overpass-api.de/api/interpreter"
    photon_url: str = "https://photon.komoot.io/api/"
    photon_min_interval_seconds: float = 1.0
    nominatim_url: str = "https://nominatim.openstreetmap.org/search"
    nominatim_min_interval_seconds: float = 1.0
    geocoding_cache_ttl_seconds: int = 86_400
    cache_ttl_seconds: int = 300
    cache_max_entries: int = 500
    rate_limit_per_minute: int = 60


@lru_cache
def get_settings() -> Settings:
    return Settings()
