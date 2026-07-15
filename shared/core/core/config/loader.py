from functools import lru_cache
from pathlib import Path
from typing import TypeVar

from core.config.base import AppSettings

S = TypeVar("S", bound=AppSettings)


def load_settings(
    cls: type[S],
    env_file: str | Path | None = ".env",
    **overrides: object,
) -> S:
    """
    Parse and validate settings for a service.

    Secret resolution order (current):
        1. **overrides  (highest priority — test injection)
        2. Environment variables
        3. .env file

    Future — to swap in AWS Secrets Manager:
        Add a pydantic-settings SecretsManagerSettingsSource here
        and prepend it before env vars in the sources list.
        No changes needed in any service settings class.

    Usage:
        settings = load_settings(ApiSettings)
        settings = load_settings(ApiSettings, env_file="../.env")
        settings = load_settings(ApiSettings, debug=True)  # test override
    """
    init_kwargs: dict[str, object] = {}

    if env_file is not None:
        init_kwargs["_env_file"] = str(env_file)

    init_kwargs.update(overrides)

    try:
        return cls(**init_kwargs)
    except Exception as exc:
        raise SettingsLoadError(cls.__name__, exc) from exc


def make_settings_factory(cls: type[S], **kwargs: object):
    """
    Returns a cached factory function for the given settings class.
    Use this at service startup to get a singleton settings instance.

    Usage:
        get_settings = make_settings_factory(ApiSettings)

        # In FastAPI dependency:
        def dep(settings: ApiSettings = Depends(get_settings)):
            ...
    """

    @lru_cache(maxsize=1)
    def _get() -> S:
        return load_settings(cls, **kwargs)

    return _get


class SettingsLoadError(RuntimeError):
    def __init__(self, settings_class: str, cause: Exception) -> None:
        self.settings_class = settings_class
        self.cause = cause
        super().__init__(
            f"Failed to load settings for '{settings_class}': {cause}\n"
            "Check that all required env vars are set in your .env file."
        )
