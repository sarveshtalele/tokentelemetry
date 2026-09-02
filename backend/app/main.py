import sys
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .db.connection import connect
from .api.router import api_router
from .api.routes.live import router as live_router

# telemetry/ sits alongside backend/ (both under the repo root, or under the
# CLI's ~/.tokentelemetry install root) and is the canonical collector/
# reconcile implementation the background daemon runs. Adding its parent to
# sys.path lets backend code import it directly instead of keeping a second,
# easily-drifting copy under backend/app/services/.
_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))


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