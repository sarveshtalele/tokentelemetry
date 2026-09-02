#!/usr/bin/env python3
import json, os
from pathlib import Path

from ..db.connection import connect
from .common import (
    text_of_content, extract_usage, detect_client, extract_paths,
    classify_path, project_name, first
)
from .attribution import rebuild_attributions

CLAUDE_DIR = Path(os.environ.get("CLAUDE_CONFIG_DIR", "~/.claude")).expanduser()
PROJECTS_DIR = CLAUDE_DIR / "projects"
DB_PATH = Path(os.environ.get("CLAUDE_TELEMETRY_DB", "~/.claude/telemetry/telemetry.db")).expanduser()

def _skill_exists(conn, session_id, path, line, skill, tool_use_id):
    return conn.execute(
        """SELECT 1 FROM skill_events
           WHERE session_id=? AND transcript_path=? AND skill_name=?
             AND COALESCE(payload_json,'') LIKE ?
           LIMIT 1""",
        (session_id, path, skill, f'%"{tool_use_id}"%')
    ).fetchone()

def ingest_transcript(conn, path):
    previous_user = ""
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
    except Exception:
        return 0

    for idx, line in enumerate(lines, 1):
        try:
            obj = json.loads(line)
        except Exception:
            continue
        if not isinstance(obj, dict):
            continue

        msg = obj.get("message") if isinstance(obj.get("message"), dict) else {}
        role = msg.get("role") or obj.get("type")
        content = msg.get("content", obj.get("content", ""))
        text = text_of_content(content)
        cwd = first(obj, ["cwd", "working_directory"], None) or first(msg, ["cwd"], None)
        session_id = first(obj, ["session_id", "sessionId"], None) or path.stem
        timestamp = first(obj, ["timestamp", "created_at", "createdAt"], None)
        client = detect_client(path, obj)
        pname = project_name(cwd, path, PROJECTS_DIR)
        usage = extract_usage(obj)

        if role == "user" and text:
            previous_user = text[:12000]

        usage_id = None
        if role == "assistant" and usage["total_tokens"] > 0:
            conn.execute(
                """INSERT OR IGNORE INTO usage(
                    event_time,session_id,project,cwd,client,model,provider,transcript_path,
                    transcript_line,input_tokens,output_tokens,cache_read_tokens,cache_write_tokens,
                    total_tokens,cost_usd,context_window,max_output_tokens,prompt_preview,response_preview
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    timestamp, session_id, pname, cwd, client, usage["model"], usage["provider"],
                    str(path), idx, usage["input_tokens"], usage["output_tokens"],
                    usage["cache_read_tokens"], usage["cache_write_tokens"], usage["total_tokens"],
                    usage["cost_usd"], usage["context_window"], usage["max_output_tokens"],
                    previous_user[:800], text[:1200]
                )
            )
            row = conn.execute(
                "SELECT id FROM usage WHERE transcript_path=? AND transcript_line=?",
                (str(path), idx)
            ).fetchone()
            usage_id = row[0] if row else None

        blocks = content if isinstance(content, list) else []
        for b in blocks:
            if not isinstance(b, dict) or b.get("type") != "tool_use":
                continue
            name = b.get("name", "unknown")
            inp = b.get("input") if isinstance(b.get("input"), dict) else {}
            tool_use_id = b.get("id") or f"{path.stem}:{idx}:{name}"
            conn.execute(
                """INSERT OR IGNORE INTO tool_calls(
                    event_time,session_id,project,cwd,client,model,tool_name,tool_use_id,
                    transcript_path,transcript_line,input_json
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
                (timestamp, session_id, pname, cwd, client, usage["model"], name, tool_use_id,
                 str(path), idx, json.dumps(inp, ensure_ascii=False))
            )
            row = conn.execute(
                """SELECT id FROM tool_calls
                   WHERE transcript_path=? AND transcript_line=? AND tool_use_id=?""",
                (str(path), idx, tool_use_id)
            ).fetchone()
            if not row:
                continue
            tool_id = row[0]

            # Rebuild paths for this tool call idempotently.
            conn.execute("DELETE FROM tool_paths WHERE tool_call_id=?", (tool_id,))
            for p in extract_paths(inp, cwd):
                conn.execute(
                    "INSERT INTO tool_paths(tool_call_id,path,category) VALUES(?,?,?)",
                    (tool_id, p, classify_path(p))
                )

            if str(name).lower() == "skill":
                skill = first(inp, ["skill", "name", "skill_name"], "unknown")
                if not _skill_exists(conn, session_id, str(path), idx, skill, tool_use_id):
                    conn.execute(
                        """INSERT INTO skill_events(
                            event_time,session_id,project,cwd,client,skill_name,trigger_type,
                            source,plugin_name,transcript_path,payload_json
                        ) VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
                        (timestamp, session_id, pname, cwd, client, skill, "tool", "transcript",
                         None, str(path), json.dumps({"tool_use_id": tool_use_id, **inp}, ensure_ascii=False))
                    )

    return len(lines)

def reconcile(force=False):
    conn = connect(DB_PATH)
    changed = 0
    files = 0
    try:
        if PROJECTS_DIR.exists():
            for p in PROJECTS_DIR.rglob("*.jsonl"):
                try:
                    stat = p.stat()
                except OSError:
                    continue
                row = conn.execute(
                    "SELECT mtime_ns,size_bytes FROM reconcile_state WHERE transcript_path=?",
                    (str(p),)
                ).fetchone()
                if not force and row and row[0] == stat.st_mtime_ns and row[1] == stat.st_size:
                    continue
                ingest_transcript(conn, p)
                conn.execute(
                    """INSERT INTO reconcile_state(transcript_path,mtime_ns,size_bytes,reconciled_at)
                       VALUES(?,?,?,CURRENT_TIMESTAMP)
                       ON CONFLICT(transcript_path) DO UPDATE SET
                       mtime_ns=excluded.mtime_ns,size_bytes=excluded.size_bytes,
                       reconciled_at=CURRENT_TIMESTAMP""",
                    (str(p), stat.st_mtime_ns, stat.st_size)
                )
                changed += 1
                files += 1
        rebuild_attributions(conn)
    finally:
        conn.close()
    return changed, files

def main():
    force = os.environ.get("CLAUDE_TELEMETRY_FORCE_RECONCILE", "").lower() in {"1","true","yes"}
    changed, files = reconcile(force=force)
    print(f"Reconciled {changed} transcript(s) into {DB_PATH}")

if __name__ == "__main__":
    main()
