import httpx

# One client for the process lifetime — reuses the connection pool to the
# runtime service across every request instead of paying a new TCP/TLS
# handshake per chat message. Safe to share across concurrent requests:
# no per-user state (cookies, auth) is set here, only per-call args.
_client: httpx.AsyncClient | None = None


def get_http_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=60.0)
    return _client


async def close_http_client() -> None:
    global _client
    if _client is not None:
        await _client.aclose()
        _client = None
