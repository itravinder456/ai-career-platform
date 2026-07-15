import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import TypeVar

logger = logging.getLogger(__name__)

T = TypeVar("T")


async def retry(
    fn: Callable[[], Awaitable[T]],
    *,
    attempts: int = 3,
    delay: float = 1.0,
    backoff: float = 2.0,
    exceptions: tuple[type[Exception], ...] = (Exception,),
) -> T:
    """
    Retry an async callable with exponential backoff.

    Args:
        fn:         Async callable to retry.
        attempts:   Max number of attempts.
        delay:      Initial delay between attempts in seconds.
        backoff:    Multiplier applied to delay after each attempt.
        exceptions: Only retry on these exception types.
    """
    current_delay = delay
    for attempt in range(1, attempts + 1):
        try:
            return await fn()
        except exceptions as exc:
            if attempt == attempts:
                raise
            logger.warning(
                "Retrying after error",
                extra={"attempt": attempt, "error": str(exc), "next_delay": current_delay},
            )
            await asyncio.sleep(current_delay)
            current_delay *= backoff

    raise RuntimeError("unreachable")
