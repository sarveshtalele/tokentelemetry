#!/usr/bin/env python3
import json, os, sys
from pathlib import Path
from ..db.connection import connect
from .common import first, detect_client, project_name

DEFAULT_DB = Path(os.environ.get("CLAUDE_TELEMETRY_DB", "~/.claude/telemetry/telemetry.db")).expanduser()

def ingest(payload, db_path=DEFAULT_DB):
    conn = connect(db_path)
    try:
        event_type = payload.get("hook_event_name") or payload.get("event_type") or payload.get("name") or "unknown"
        session_id = payload.get("session_id")
        cwd = payload.get("cwd")
        transcript = payload.get("transcript_path")
        client = detect_client(transcript or "", payload)
        project = project_name(cwd, transcript)
        tool_name, tool_use_id = payload.get("tool_name"), payload.get("tool_use_id")
        agent_id, agent_type, model = payload.get("agent_id"), payload.get("agent_type"), payload.get("model")

        skillish = "skill_activated" in str(event_type).lower() or str(tool_name).lower() == "skill"
        skill_name = first(payload, ["skill_name", "skill"], None) if skillish else None
        skill_trigger = first(payload, ["trigger_type", "invocation_trigger", "trigger"], None)
        skill_source = first(payload, ["source", "source_location"], None)

        conn.execute(
            """INSERT INTO events(
                event_time,event_type,session_id,project,cwd,client,model,tool_name,
                tool_use_id,skill_name,skill_trigger,skill_source,agent_id,agent_type,
                transcript_path,payload_json
            ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            (
                first(payload, ["timestamp", "event_time"], None), event_type, session_id,
                project, cwd, client, model, tool_name, tool_use_id, skill_name,
                skill_trigger, skill_source, agent_id, agent_type, transcript,
                json.dumps(payload, ensure_ascii=False)
            )
        )

        if skillish:
            ti = payload.get("tool_input") if isinstance(payload.get("tool_input"), dict) else {}
            sname = skill_name or first(ti, ["skill", "name", "skill_name"], "unknown")
            conn.execute(
                """INSERT INTO skill_events(
                    event_time,session_id,project,cwd,client,skill_name,trigger_type,
                    source,plugin_name,transcript_path,payload_json
                ) VALUES(?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    first(payload, ["timestamp", "event_time"], None), session_id, project,
                    cwd, client, sname,
                    skill_trigger or ("tool" if str(tool_name).lower() == "skill" else None),
                    skill_source, first(payload, ["plugin_name", "plugin"], None),
                    transcript, json.dumps(payload, ensure_ascii=False)
                )
            )
        conn.commit()
    finally:
        conn.close()

def main():
    raw = sys.stdin.read()
    if not raw.strip():
        return
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        return
    ingest(payload)

if __name__ == "__main__":
    main()
