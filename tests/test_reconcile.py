"""Tests for telemetry/reconcile.py transcript ingestion.

Run: uv run pytest tests/test_reconcile.py
"""

import json
import os
import sqlite3
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

_TMP_DB = tempfile.NamedTemporaryFile(prefix="telemetry_reconcile_test_", suffix=".db", delete=False)
_TMP_DB.close()
os.environ["CLAUDE_TELEMETRY_DB"] = _TMP_DB.name

from telemetry.db import connect  # noqa: E402
from telemetry.reconcile import ingest_transcript  # noqa: E402


def _write_transcript(tmp_path, skill_input):
    lines = [
        {
            "type": "user",
            "session_id": "sess-plugin",
            "cwd": "/tmp/demo",
            "message": {"role": "user", "content": "please run a skill"},
        },
        {
            "type": "assistant",
            "session_id": "sess-plugin",
            "cwd": "/tmp/demo",
            "message": {
                "role": "assistant",
                "content": [{"type": "tool_use", "id": "tu1", "name": "Skill", "input": skill_input}],
            },
        },
    ]
    p = tmp_path / "transcript.jsonl"
    p.write_text("\n".join(json.dumps(x) for x in lines), encoding="utf-8")
    return p


def _skill_row_for(conn, transcript):
    conn.row_factory = sqlite3.Row
    return conn.execute(
        "SELECT skill_name, plugin_name FROM skill_events WHERE session_id='sess-plugin' AND transcript_path=?",
        (str(transcript),),
    ).fetchone()


def test_reconcile_splits_plugin_prefixed_skill(tmp_path):
    transcript = _write_transcript(tmp_path, {"skill": "superpowers:brainstorming"})
    conn = connect(os.environ["CLAUDE_TELEMETRY_DB"])
    ingest_transcript(conn, transcript)
    conn.commit()
    row = _skill_row_for(conn, transcript)
    conn.close()
    assert row is not None
    assert row["skill_name"] == "brainstorming"
    assert row["plugin_name"] == "superpowers"


def test_reconcile_prefers_explicit_plugin_field(tmp_path):
    transcript = _write_transcript(tmp_path, {"skill": "brainstorming", "plugin_name": "superpowers"})
    conn = connect(os.environ["CLAUDE_TELEMETRY_DB"])
    ingest_transcript(conn, transcript)
    conn.commit()
    row = _skill_row_for(conn, transcript)
    conn.close()
    assert row["skill_name"] == "brainstorming"
    assert row["plugin_name"] == "superpowers"


def test_reconcile_leaves_plugin_null_for_unnamespaced_skill(tmp_path):
    transcript = _write_transcript(tmp_path, {"skill": "code-review"})
    conn = connect(os.environ["CLAUDE_TELEMETRY_DB"])
    ingest_transcript(conn, transcript)
    conn.commit()
    row = _skill_row_for(conn, transcript)
    conn.close()
    assert row["skill_name"] == "code-review"
    assert row["plugin_name"] is None


def test_reconcile_accumulates_all_tool_results_since_last_reply(tmp_path):
    # Regression test: a turn following several tool calls used to lose
    # everything but the last tool_result, because ingest_transcript kept a
    # single `previous_user` string that later user-role lines simply
    # overwrote. All of them should end up in prompt_full, in order.
    lines = [
        {
            "type": "user",
            "session_id": "sess-multi",
            "cwd": "/tmp/demo",
            "message": {"role": "user", "content": "read three files and summarize"},
        },
        {
            "type": "assistant",
            "session_id": "sess-multi",
            "cwd": "/tmp/demo",
            "message": {
                "role": "assistant",
                "content": [
                    {"type": "tool_use", "id": "tu1", "name": "Read", "input": {"file_path": "a.txt"}},
                    {"type": "tool_use", "id": "tu2", "name": "Read", "input": {"file_path": "b.txt"}},
                ],
            },
        },
        {
            "type": "user",
            "session_id": "sess-multi",
            "cwd": "/tmp/demo",
            "message": {
                "role": "user",
                "content": [{"type": "tool_result", "tool_use_id": "tu1", "content": "contents of A"}],
            },
        },
        {
            "type": "user",
            "session_id": "sess-multi",
            "cwd": "/tmp/demo",
            "message": {
                "role": "user",
                "content": [{"type": "tool_result", "tool_use_id": "tu2", "content": "contents of B"}],
            },
        },
        {
            "type": "assistant",
            "session_id": "sess-multi",
            "cwd": "/tmp/demo",
            "message": {
                "role": "assistant",
                "content": [{"type": "text", "text": "Here is the summary."}],
                "model": "claude-x",
                "usage": {"input_tokens": 5, "output_tokens": 10},
            },
        },
    ]
    p = tmp_path / "multi.jsonl"
    p.write_text("\n".join(json.dumps(x) for x in lines), encoding="utf-8")

    conn = connect(os.environ["CLAUDE_TELEMETRY_DB"])
    ingest_transcript(conn, p)
    conn.commit()
    conn.row_factory = sqlite3.Row
    row = conn.execute(
        "SELECT prompt_full FROM usage WHERE session_id='sess-multi' AND transcript_path=?",
        (str(p),),
    ).fetchone()
    conn.close()

    assert row is not None
    assert "contents of A" in row["prompt_full"]
    assert "contents of B" in row["prompt_full"]
    assert row["prompt_full"].index("contents of A") < row["prompt_full"].index("contents of B")


def test_reconcile_resets_context_after_each_reply(tmp_path):
    # The context that produced turn 1's reply must not bleed into turn 2's
    # prompt_full once it's already been used.
    lines = [
        {
            "type": "user",
            "session_id": "sess-reset",
            "cwd": "/tmp/demo",
            "message": {"role": "user", "content": "first message"},
        },
        {
            "type": "assistant",
            "session_id": "sess-reset",
            "cwd": "/tmp/demo",
            "message": {
                "role": "assistant",
                "content": [{"type": "text", "text": "first reply"}],
                "model": "claude-x",
                "usage": {"input_tokens": 1, "output_tokens": 1},
            },
        },
        {
            "type": "user",
            "session_id": "sess-reset",
            "cwd": "/tmp/demo",
            "message": {"role": "user", "content": "second message"},
        },
        {
            "type": "assistant",
            "session_id": "sess-reset",
            "cwd": "/tmp/demo",
            "message": {
                "role": "assistant",
                "content": [{"type": "text", "text": "second reply"}],
                "model": "claude-x",
                "usage": {"input_tokens": 1, "output_tokens": 1},
            },
        },
    ]
    p = tmp_path / "reset.jsonl"
    p.write_text("\n".join(json.dumps(x) for x in lines), encoding="utf-8")

    conn = connect(os.environ["CLAUDE_TELEMETRY_DB"])
    ingest_transcript(conn, p)
    conn.commit()
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT prompt_full FROM usage WHERE session_id='sess-reset' AND transcript_path=? ORDER BY id",
        (str(p),),
    ).fetchall()
    conn.close()

    assert len(rows) == 2
    assert rows[0]["prompt_full"] == "first message"
    assert rows[1]["prompt_full"] == "second message"


def test_telemetry_db_connect_creates_prompt_full_columns_standalone(tmp_path):
    # Regression test: telemetry/db.py is a separate schema module from
    # backend/app/db/schema.py, connected to independently by the daemon/
    # reconcile path. It must create prompt_full/response_full itself --
    # not rely on the backend having already run its own migration against
    # the same file first.
    db_path = tmp_path / "standalone.db"
    conn = connect(str(db_path))
    cols = {row[1] for row in conn.execute("PRAGMA table_info(usage)")}
    conn.close()
    assert "prompt_full" in cols
    assert "response_full" in cols
