from dataclasses import dataclass, field


@dataclass
class AppError(Exception):
    message: str
    code: str = "INTERNAL_ERROR"
    http_status: int = 500
    details: dict = field(default_factory=dict)

    def __post_init__(self) -> None:
        super().__init__(self.message)

    def to_dict(self) -> dict:
        return {
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details,
            }
        }


@dataclass
class NotFoundError(AppError):
    # message is always derived from `resource` in __post_init__ below — the
    # default here just satisfies dataclass field ordering (AppError.message has
    # no default) so callers can write NotFoundError(resource="Project") without
    # also passing a redundant message.
    message: str = ""
    resource: str = "Resource"
    code: str = "NOT_FOUND"
    http_status: int = 404

    def __post_init__(self) -> None:
        self.message = f"{self.resource} not found"
        super().__post_init__()


@dataclass
class ValidationError(AppError):
    code: str = "VALIDATION_ERROR"
    http_status: int = 422


@dataclass
class UnauthorizedError(AppError):
    message: str = "Unauthorized"
    code: str = "UNAUTHORIZED"
    http_status: int = 401


@dataclass
class ForbiddenError(AppError):
    message: str = "Forbidden"
    code: str = "FORBIDDEN"
    http_status: int = 403


@dataclass
class ConflictError(AppError):
    code: str = "CONFLICT"
    http_status: int = 409


@dataclass
class ServiceUnavailableError(AppError):
    message: str = "Service temporarily unavailable"
    code: str = "SERVICE_UNAVAILABLE"
    http_status: int = 503


@dataclass
class RateLimitError(AppError):
    message: str = "Too many requests"
    code: str = "RATE_LIMITED"
    http_status: int = 429


@dataclass
class UpstreamError(AppError):
    """Raised when an internal call (api → runtime) fails."""
    # See NotFoundError above — message is derived from `service` below.
    message: str = ""
    service: str = "unknown"
    code: str = "UPSTREAM_ERROR"
    http_status: int = 502

    def __post_init__(self) -> None:
        self.message = f"Upstream service '{self.service}' returned an error"
        super().__post_init__()
