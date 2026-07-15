import logging
import sys

import structlog


def configure_logging(service: str, level: str = "INFO") -> None:
    """
    Configure structlog for JSON output in production, pretty output in development.
    Call once at service startup before any log statements.
    """
    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.processors.TimeStamper(fmt="iso", utc=True),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        _add_service_name(service),
    ]

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, level.upper(), logging.INFO)
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )


def _add_service_name(service: str) -> structlog.types.Processor:
    def processor(logger: object, method: str, event_dict: dict) -> dict:
        event_dict["service"] = service
        return event_dict

    return processor


def get_logger(name: str) -> structlog.BoundLogger:
    return structlog.get_logger(name)
