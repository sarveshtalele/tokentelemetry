from fastapi import APIRouter
from ...db.connection import connect

router = APIRouter()


@router.get("")
async def get_mcp_servers():
    conn = connect()
    rows = conn.execute(
        """
        SELECT tool_name as server_name, COUNT(*) as call_count,
               COUNT(DISTINCT session_id) as sessions,
               MIN(event_time) as first_seen,
               MAX(event_time) as last_seen
        FROM events
        WHERE tool_name LIKE 'mcp_%' OR event_type LIKE '%mcp%'
        GROUP BY tool_name ORDER BY call_count DESC
        """,
    ).fetchall()
    conn.close()
    return {"data": [dict(r) for r in rows]}