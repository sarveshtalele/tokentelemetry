from fastapi import APIRouter, Query
from ...db.connection import connect

router = APIRouter()


@router.get("")
async def get_events(
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
):
    conn = connect()
    total = conn.execute("SELECT COUNT(*) FROM events").fetchone()[0]
    offset = (page - 1) * page_size
    rows = conn.execute(
        "SELECT id,event_time,event_type,session_id,project,client,model,"
        "tool_name,skill_name,agent_type,transcript_path "
        "FROM events ORDER BY id DESC LIMIT ? OFFSET ?",
        (page_size, offset),
    ).fetchall()
    conn.close()
    return {
        "data": [dict(r) for r in rows],
        "meta": {"total": total, "page": page, "page_size": page_size},
    }