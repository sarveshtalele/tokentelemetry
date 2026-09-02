import os
from fastapi import APIRouter
from ...db.connection import connect, DEFAULT_DB

router = APIRouter()


@router.get("")
async def get_settings():
    db_path = DEFAULT_DB
    conn = connect()
    tables = {}
    for t in ["events", "usage", "tool_calls", "tool_paths", "skill_events", "attributions", "reconcile_state"]:
        try:
            c = conn.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
            tables[t] = c
        except Exception:
            tables[t] = 0
    try:
        db_size = os.path.getsize(db_path)
    except Exception:
        db_size = 0
    last_reconcile = conn.execute(
        "SELECT MAX(reconciled_at) FROM reconcile_state"
    ).fetchone()[0]
    conn.close()
    return {
        "data": {
            "db_path": str(db_path),
            "db_size": db_size,
            "table_counts": tables,
            "last_reconcile": last_reconcile,
            "env": {
                "CLAUDE_TELEMETRY_DB": os.environ.get("CLAUDE_TELEMETRY_DB", ""),
                "CLAUDE_CONFIG_DIR": os.environ.get("CLAUDE_CONFIG_DIR", ""),
                "CLAUDE_TELEMETRY_INTERVAL": os.environ.get("CLAUDE_TELEMETRY_INTERVAL", "5"),
            },
        }
    }


@router.post("/reconcile")
async def trigger_reconcile():
    from ...services.reconcile import reconcile

    changed, _ = reconcile()
    return {"data": {"changed": changed}}