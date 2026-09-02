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
