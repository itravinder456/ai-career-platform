from fastapi import FastAPI

app = FastAPI(
    title="Ravinder AI — Runtime",
    version="0.1.0",
    docs_url="/docs",
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
