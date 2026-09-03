from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    log_level: str = "INFO"
    upstream_timeout_seconds: float = 6.0
    overpass_url: str = "https://overpass-api.de/api/interpreter"
    cache_ttl_seconds: int = 300
    cache_max_entries: int = 500
    rate_limit_per_minute: int = 60


@lru_cache
def get_settings() -> Settings:
    return Settings()
