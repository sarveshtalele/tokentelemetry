import csv
import io
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse

from ...db.connection import connect

router = APIRouter()

REQUEST_COLUMNS = [
    "event_time", "project", "session_id", "client", "model", "provider",
    "input_tokens", "output_tokens", "cache_read_tokens", "cache_write_tokens",
    "total_tokens", "cost_usd", "prompt_preview", "response_preview",
]

PROJECT_COLUMNS = [
    "project", "total_tokens", "requests", "sessions",
    "top_tool", "top_tool_calls", "first_active", "last_active",
]


def _filters(project, start, end):
    where, params = [], []
    if project and project != "All":
        where.append("project=?")
        params.append(project)
    if start:
        where.append("event_time >= ?")
        params.append(start)
    if end:
        where.append("event_time <= ?")
        params.append(end + " 23:59:59")
    clause = "WHERE " + " AND ".join(where) if where else ""
    return clause, params


def _rows_for(kind: str, project, start, end):
    conn = connect()
    clause, params = _filters(project, start, end)
    if kind == "projects":
        proj_rows = conn.execute(
            f"""SELECT project, COALESCE(SUM(total_tokens),0) as total_tokens, COUNT(*) as requests,
                       COUNT(DISTINCT session_id) as sessions, MIN(event_time) as first_active,
                       MAX(event_time) as last_active
                FROM usage {clause} GROUP BY project ORDER BY total_tokens DESC""",
            params,
        ).fetchall()
        rows = []
        for r in proj_rows:
            d = dict(r)
            top_tool = conn.execute(
                "SELECT tool_name, COUNT(*) as c FROM tool_calls WHERE project=? "
                "GROUP BY tool_name ORDER BY c DESC LIMIT 1",
                (d["project"],),
            ).fetchone()
            d["top_tool"] = top_tool["tool_name"] if top_tool else ""
            d["top_tool_calls"] = top_tool["c"] if top_tool else 0
            rows.append(d)
    else:
        rows = [
            dict(r)
            for r in conn.execute(
                f"SELECT {','.join(REQUEST_COLUMNS)} FROM usage {clause} "
                f"ORDER BY event_time DESC LIMIT 5000",
                params,
            ).fetchall()
        ]
    conn.close()
    return rows


@router.get("/preview")
async def preview_report(
    kind: str = Query("requests", pattern="^(requests|projects)$"),
    project: str = Query(None),
    start: str = Query(None, description="YYYY-MM-DD"),
    end: str = Query(None, description="YYYY-MM-DD"),
):
    rows = _rows_for(kind, project, start, end)
    columns = PROJECT_COLUMNS if kind == "projects" else REQUEST_COLUMNS
    return {"data": {"row_count": len(rows), "columns": columns, "sample": rows[:5]}}


@router.get("/export")
async def export_report(
    kind: str = Query("requests", pattern="^(requests|projects)$"),
    format: str = Query("csv", pattern="^(csv|json)$"),
    project: str = Query(None),
    start: str = Query(None, description="YYYY-MM-DD"),
    end: str = Query(None, description="YYYY-MM-DD"),
):
    rows = _rows_for(kind, project, start, end)
    columns = PROJECT_COLUMNS if kind == "projects" else REQUEST_COLUMNS
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    filename = f"tokentelemetry-{kind}-{stamp}.{format}"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}

    if format == "json":
        return StreamingResponse(
            iter([json.dumps(rows, indent=2)]),
            media_type="application/json",
            headers=headers,
        )

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=columns)
    writer.writeheader()
    writer.writerows(rows)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers=headers,
    )
