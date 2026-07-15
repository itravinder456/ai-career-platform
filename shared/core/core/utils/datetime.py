from datetime import datetime, timezone


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def utc_timestamp() -> float:
    return utcnow().timestamp()


def is_expired(dt: datetime, ttl_seconds: int) -> bool:
    return (utcnow() - dt).total_seconds() > ttl_seconds
