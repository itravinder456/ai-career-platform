"""
Local dev entrypoint (Windows). psycopg's async mode cannot run on Windows'
default ProactorEventLoop — it needs a SelectorEventLoop. This must be set
before uvicorn creates its event loop, so `uvicorn app.main:app` directly
won't work here; this script sets the policy first, then starts uvicorn.

No-op on Linux/Docker (ProactorEventLoop doesn't exist there) — production
is unaffected.
"""

import sys

if sys.platform == "win32":
    import asyncio

    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8001, reload=True)
