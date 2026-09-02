from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db.connection import connect
from .api.router import api_router
from .api.routes.live import router as live_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    conn = connect()
    conn.close()
    yield


app = FastAPI(
    title="Claude Telemetry Enterprise",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")
app.include_router(live_router)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}