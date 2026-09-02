from fastapi import APIRouter
from ...db.connection import connect

router = APIRouter()


@router.get("")
async def get_plugins():
    conn = connect()
    skill_plugins = conn.execute(
        """
        SELECT plugin_name, COUNT(*) as call_count,
               COUNT(DISTINCT skill_name) as skills,
               MAX(event_time) as last_used
        FROM skill_events
        WHERE plugin_name IS NOT NULL AND plugin_name != ''
        GROUP BY plugin_name ORDER BY call_count DESC
        """,
    ).fetchall()
    hook_counts = conn.execute(
        """
        SELECT event_type as hook_name, COUNT(*) as call_count
        FROM events
        WHERE event_type IN ('SessionStart','UserPromptSubmit','PreToolUse','PostToolUse','Stop')
        GROUP BY event_type ORDER BY call_count DESC
        """,
    ).fetchall()
    agents = conn.execute(
        """
        SELECT agent_type, COUNT(*) as call_count
        FROM events
        WHERE agent_type IS NOT NULL AND agent_type != ''
        GROUP BY agent_type ORDER BY call_count DESC
        """,
    ).fetchall()
    conn.close()
    return {
        "data": {
            "plugins": [dict(r) for r in skill_plugins],
            "hooks": [dict(r) for r in hook_counts],
            "agents": [dict(r) for r in agents],
        }
    }