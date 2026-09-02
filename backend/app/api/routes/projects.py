from fastapi import APIRouter
from ...db.connection import connect

router = APIRouter()


@router.get("")
async def get_projects():
    conn = connect()
    rows = conn.execute(
        """
        SELECT project,
               COALESCE(SUM(total_tokens),0) as total_tokens,
               COUNT(*) as requests,
               COUNT(DISTINCT session_id) as sessions,
               COUNT(DISTINCT client) as client_count,
               MAX(event_time) as last_activity
        FROM usage GROUP BY project ORDER BY total_tokens DESC
        """,
    ).fetchall()
    conn.close()
    return {"data": [dict(r) for r in rows]}


@router.get("/{project}")
async def get_project_detail(project: str):
    conn = connect()
    row = conn.execute(
        """
        SELECT project,
               COALESCE(SUM(total_tokens),0) as total_tokens,
               COUNT(*) as requests,
               COUNT(DISTINCT session_id) as sessions,
               COUNT(DISTINCT client) as clients,
               COUNT(DISTINCT model) as models,
               MIN(event_time) as first_active,
               MAX(event_time) as last_active
        FROM usage WHERE project=? GROUP BY project
        """,
        (project,),
    ).fetchone()
    conn.close()
    return {"data": dict(row) if row else {}}


@router.get("/{project}/hotspots")
async def get_project_hotspots(project: str):
    conn = connect()
    rows = conn.execute(
        """
        SELECT category, ROUND(SUM(estimated_tokens),1) as estimated_tokens,
               COUNT(*) as reference_count
        FROM attributions WHERE project=? AND category IS NOT NULL
        GROUP BY category ORDER BY estimated_tokens DESC
        """,
        (project,),
    ).fetchall()
    conn.close()
    return {"data": [dict(r) for r in rows]}


@router.get("/{project}/attribution-summary")
async def get_project_attribution_summary(project: str):
    conn = connect()
    top_skill = conn.execute(
        """
        SELECT skill_name, COUNT(*) as call_count
        FROM skill_events WHERE project=? AND skill_name IS NOT NULL AND skill_name != ''
        GROUP BY skill_name ORDER BY call_count DESC LIMIT 1
        """,
        (project,),
    ).fetchone()
    top_mcp = conn.execute(
        """
        SELECT tool_name as server_name, COUNT(*) as call_count
        FROM events WHERE project=? AND (tool_name LIKE 'mcp_%' OR event_type LIKE '%mcp%')
        GROUP BY tool_name ORDER BY call_count DESC LIMIT 1
        """,
        (project,),
    ).fetchone()
    top_hook = conn.execute(
        """
        SELECT event_type as hook_name, COUNT(*) as call_count
        FROM events
        WHERE project=? AND event_type IN ('SessionStart','UserPromptSubmit','PreToolUse','PostToolUse','Stop')
        GROUP BY event_type ORDER BY call_count DESC LIMIT 1
        """,
        (project,),
    ).fetchone()
    conn.close()
    return {
        "data": {
            "top_skill": dict(top_skill) if top_skill else None,
            "top_mcp_server": dict(top_mcp) if top_mcp else None,
            "top_hook": dict(top_hook) if top_hook else None,
        }
    }


@router.get("/{project}/paths")
async def get_project_paths(project: str):
    conn = connect()
    rows = conn.execute(
        """
        SELECT path, category, ROUND(SUM(estimated_tokens),1) as estimated_tokens,
               COUNT(*) as reference_count
        FROM attributions WHERE project=? AND path IS NOT NULL
        GROUP BY path ORDER BY estimated_tokens DESC LIMIT 200
        """,
        (project,),
    ).fetchall()
    conn.close()
    return {"data": [dict(r) for r in rows]}