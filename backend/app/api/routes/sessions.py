from fastapi import APIRouter
from ...db.connection import connect

router = APIRouter()


@router.get("")
async def get_sessions():
    conn = connect()
    rows = conn.execute(
        """
        SELECT session_id, project, client, model,
               COALESCE(SUM(total_tokens),0) as total_tokens,
               COUNT(*) as interactions,
               MIN(event_time) as started_at,
               MAX(event_time) as last_active
        FROM usage GROUP BY session_id
        ORDER BY last_active DESC LIMIT 200
        """,
    ).fetchall()
    conn.close()
    return {"data": [dict(r) for r in rows]}


@router.get("/{session_id}")
async def get_session_detail(session_id: str):
    conn = connect()
    rows = conn.execute(
        "SELECT id,event_time,project,client,model,input_tokens,output_tokens,total_tokens "
        "FROM usage WHERE session_id=? ORDER BY event_time DESC",
        (session_id,),
    ).fetchall()
    tools = conn.execute(
        "SELECT tool_name, COUNT(*) as calls FROM tool_calls WHERE session_id=? GROUP BY tool_name",
        (session_id,),
    ).fetchall()
    conn.close()
    return {"data": {"usage": [dict(r) for r in rows], "tools": [dict(r) for r in tools]}}