from fastapi import APIRouter
from ...db.connection import connect

router = APIRouter()


@router.get("")
async def get_skills():
    conn = connect()
    rows = conn.execute(
        """
        SELECT skill_name, trigger_type, plugin_name,
               COUNT(*) as call_count,
               MAX(event_time) as last_activated
        FROM skill_events
        GROUP BY skill_name, COALESCE(trigger_type,'')
        ORDER BY call_count DESC
        """,
    ).fetchall()
    conn.close()
    return {"data": [dict(r) for r in rows]}