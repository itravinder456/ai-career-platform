from core.logging.setup import configure_logging, get_logger
from app.core.settings import get_settings


def setup_logging() -> None:
    settings = get_settings()
    configure_logging(service=settings.app_name, level=settings.log_level)


log = get_logger("api")
