from fastapi import APIRouter, HTTPException, Query
from ...db.connection import connect

router = APIRouter()


@router.get("")
async def get_usage(
    project: str = Query(None),
    client: str = Query(None),
    model: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
):
    conn = connect()
    where, params = [], []
    if project and project != "All":
        where.append("project=?")
        params.append(project)
    if client and client != "All":
        where.append("client=?")
        params.append(client)
    if model:
        where.append("model=?")
        params.append(model)
    w = "WHERE " + " AND ".join(where) if where else ""
    total = conn.execute(f"SELECT COUNT(*) FROM usage {w}", params).fetchone()[0]
    offset = (page - 1) * page_size
    rows = conn.execute(
        f"SELECT id,event_time,session_id,project,cwd,client,model,provider,input_tokens,output_tokens,"
        f"cache_read_tokens,cache_write_tokens,total_tokens,cost_usd,context_window,max_output_tokens,"
        f"prompt_preview,response_preview FROM usage {w} ORDER BY event_time DESC LIMIT ? OFFSET ?",
        params + [page_size, offset],
    ).fetchall()
    conn.close()
    return {
        "data": [dict(r) for r in rows],
        "meta": {"total": total, "page": page, "page_size": page_size},
    }


@router.get("/timeline")
async def get_usage_timeline(days: int = Query(0, ge=0)):
    """days=0 (default) returns the full history; days>0 caps to that many most-recent days."""
    conn = connect()
    sql = """
        SELECT DATE(event_time) as day,
               SUM(total_tokens) as tokens,
               SUM(input_tokens) as input,
               SUM(output_tokens) as output,
               SUM(cache_read_tokens) as cache_read,
               SUM(cache_write_tokens) as cache_write
        FROM usage WHERE event_time IS NOT NULL
        GROUP BY DATE(event_time) ORDER BY day DESC
    """
    if days > 0:
        rows = conn.execute(sql + " LIMIT ?", (days,)).fetchall()
    else:
        rows = conn.execute(sql).fetchall()
    conn.close()
    return {"data": [dict(r) for r in rows]}


@router.get("/project/{project}")
async def get_usage_by_project(project: str):
    conn = connect()
    rows = conn.execute(
        "SELECT id,event_time,session_id,project,cwd,client,model,provider,input_tokens,output_tokens,"
        "cache_read_tokens,cache_write_tokens,total_tokens,cost_usd,context_window,max_output_tokens,"
        "prompt_preview,response_preview FROM usage WHERE project=? ORDER BY event_time DESC LIMIT 500",
        (project,),
    ).fetchall()
    conn.close()
    return {"data": [dict(r) for r in rows], "meta": {"total": len(rows)}}


@router.get("/summary")
async def get_summary():
    conn = connect()
    row = conn.execute(
        """
        SELECT COALESCE(SUM(total_tokens),0) as total_tokens,
               COUNT(*) as total_requests,
               COUNT(DISTINCT project) as total_projects,
               COUNT(DISTINCT session_id) as total_sessions
        FROM usage
        """,
    ).fetchone()
    top_model = conn.execute(
        "SELECT model FROM usage WHERE model IS NOT NULL AND model != '' "
        "GROUP BY model ORDER BY COUNT(*) DESC LIMIT 1"
    ).fetchone()
    top_client = conn.execute(
        "SELECT client FROM usage WHERE client IS NOT NULL AND client != '' "
        "GROUP BY client ORDER BY COUNT(*) DESC LIMIT 1"
    ).fetchone()
    conn.close()
    data = dict(row)
    data["top_model"] = top_model[0] if top_model else ""
    data["top_client"] = top_client[0] if top_client else ""
    data["avg_tokens_per_request"] = round(data["total_tokens"] / max(data["total_requests"], 1), 1)
    return {"data": data}


@router.get("/{usage_id}")
async def get_usage_detail(usage_id: int):
    conn = connect()
    row = conn.execute(
        "SELECT id,event_time,session_id,project,cwd,client,model,provider,input_tokens,output_tokens,"
        "cache_read_tokens,cache_write_tokens,total_tokens,cost_usd,context_window,max_output_tokens,"
        "prompt_preview,response_preview,prompt_full,response_full FROM usage WHERE id=?",
        (usage_id,),
    ).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Request not found")
    return {"data": dict(row)}