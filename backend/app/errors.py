from typing import Any


class ApiError(Exception):
    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        *,
        retryable: bool = False,
        details: list[Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.retryable = retryable
        self.details = details or []


class ProviderError(Exception):
    def __init__(self, provider: str, *, timed_out: bool = False) -> None:
        super().__init__(f"{provider} request failed")
        self.provider = provider
        self.timed_out = timed_out
