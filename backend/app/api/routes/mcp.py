from fastapi import APIRouter
from ...db.connection import connect

router = APIRouter()


def _server_name(tool_name: str) -> str:
    # Claude Code MCP tool names look like mcp__<server>__<tool>; group by
    # the server segment so e.g. mcp__github__search_issues and
    # mcp__github__create_pr both roll up under "github".
    if tool_name.startswith("mcp__"):
        parts = tool_name.split("__")
        if len(parts) >= 2 and parts[1]:
            return parts[1]
    return tool_name


@router.get("")
async def get_mcp_servers():
    conn = connect()
    # tool_calls is populated by reconcile from session transcripts (same
    # source the working Tools page uses), so this reflects historical
    # usage too — not just tool calls made after the hooks were installed
    # (which is all the live-only `events` table would ever contain).
    rows = conn.execute(
        "SELECT tool_name, session_id, event_time FROM tool_calls WHERE tool_name LIKE 'mcp_%'",
    ).fetchall()
    conn.close()

    servers: dict = {}
    for r in rows:
        name = _server_name(r["tool_name"])
        s = servers.setdefault(
            name, {"server_name": name, "call_count": 0, "sessions": set(), "first_seen": None, "last_seen": None}
        )
        s["call_count"] += 1
        if r["session_id"]:
            s["sessions"].add(r["session_id"])
        et = r["event_time"]
        if et:
            if not s["first_seen"] or et < s["first_seen"]:
                s["first_seen"] = et
            if not s["last_seen"] or et > s["last_seen"]:
                s["last_seen"] = et

    data = [
        {
            "server_name": s["server_name"],
            "call_count": s["call_count"],
            "sessions": len(s["sessions"]),
            "first_seen": s["first_seen"],
            "last_seen": s["last_seen"],
        }
        for s in servers.values()
    ]
    data.sort(key=lambda x: x["call_count"], reverse=True)
    return {"data": data}
