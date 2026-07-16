from core.logging.setup import configure_logging, get_logger
from app.core.settings import get_settings


def setup_logging() -> None:
    s = get_settings()
    configure_logging(service=s.app_name, level=s.log_level)


log = get_logger("runtime")
