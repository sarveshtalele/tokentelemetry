from fastapi import APIRouter
from ...db.connection import connect

router = APIRouter()


@router.get("")
async def get_tools():
    conn = connect()
    rows = conn.execute(
        """
        SELECT tool_name, COUNT(*) as call_count,
               COUNT(DISTINCT session_id) as unique_sessions,
               MIN(event_time) as first_seen,
               MAX(event_time) as last_seen
        FROM tool_calls GROUP BY tool_name ORDER BY call_count DESC
        """,
    ).fetchall()
    conn.close()
    return {"data": [dict(r) for r in rows]}


@router.get("/{tool_name}")
async def get_tool_detail(tool_name: str):
    conn = connect()
    row = conn.execute(
        """
        SELECT tool_name, COUNT(*) as call_count,
               COUNT(DISTINCT session_id) as unique_sessions,
               COUNT(DISTINCT project) as projects,
               MIN(event_time) as first_seen,
               MAX(event_time) as last_seen
        FROM tool_calls WHERE tool_name=? GROUP BY tool_name
        """,
        (tool_name,),
    ).fetchone()
    conn.close()
    return {"data": dict(row) if row else {}}