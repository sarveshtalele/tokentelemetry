"""API tests for the FastAPI telemetry backend (backend/app).

Run: uv run pytest tests/test_backend_api.py
Uses a scratch SQLite DB (via CLAUDE_TELEMETRY_DB) so it never touches a
real ~/.claude/telemetry/telemetry.db.
"""

import os
import sys
import tempfile
from pathlib import Path

import pytest

_TMP_DB = tempfile.NamedTemporaryFile(prefix="telemetry_test_", suffix=".db", delete=False)
_TMP_DB.close()
os.environ["CLAUDE_TELEMETRY_DB"] = _TMP_DB.name

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402
from app.db.connection import connect  # noqa: E402


@pytest.fixture(scope="module", autouse=True)
def seed_db():
    conn = connect()
    conn.execute(
        """INSERT INTO usage(
            event_time,session_id,project,cwd,client,model,provider,transcript_path,transcript_line,
            input_tokens,output_tokens,cache_read_tokens,cache_write_tokens,total_tokens,cost_usd,
            prompt_preview,response_preview,prompt_full,response_full
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            "2024-01-01T00:00:00Z", "sess-1", "demo-project", "/tmp/demo", "vscode", "claude-x", "anthropic",
            "/tmp/t.jsonl", 1, 100, 200, 0, 0, 300, 0.01,
            "short prompt", "short response",
            "x" * 5000, "y" * 5000,
        ),
    )
    conn.execute(
        """INSERT INTO skill_events(event_time,session_id,project,cwd,client,skill_name,trigger_type,source)
           VALUES(?,?,?,?,?,?,?,?)""",
        ("2024-01-01T00:00:00Z", "sess-1", "demo-project", "/tmp/demo", "vscode", "code-review", "tool", "transcript"),
    )
    for _ in range(2):
        conn.execute(
            """INSERT INTO events(event_time,event_type,session_id,project,cwd,client,tool_name)
               VALUES(?,?,?,?,?,?,?)""",
            ("2024-01-01T00:00:00Z", "PostToolUse", "sess-1", "demo-project", "/tmp/demo", "vscode", "mcp__github__search"),
        )
    conn.execute(
        """INSERT INTO events(event_time,event_type,session_id,project,cwd,client,tool_name)
           VALUES(?,?,?,?,?,?,?)""",
        ("2024-01-01T00:00:00Z", "PreToolUse", "sess-1", "demo-project", "/tmp/demo", "vscode", "Read"),
    )
    # tool_calls is what reconcile backfills from transcripts -- this is the
    # source MCP usage should be read from so historical calls show up too,
    # not just ones made after the hooks were installed (events-only).
    for tool_name, tool_use_id in [
        ("mcp__github__search_issues", "t1"),
        ("mcp__github__create_pr", "t2"),
        ("mcp__linear__list_issues", "t3"),
    ]:
        conn.execute(
            """INSERT INTO tool_calls(event_time,session_id,project,cwd,client,tool_name,tool_use_id,transcript_path,transcript_line)
               VALUES(?,?,?,?,?,?,?,?,?)""",
            ("2024-01-01T00:00:00Z", "sess-1", "demo-project", "/tmp/demo", "vscode", tool_name, tool_use_id, "/tmp/t.jsonl", 1),
        )
    conn.commit()
    conn.close()
    yield


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_usage_detail_returns_full_text(client):
    listing = client.get("/api/v1/usage")
    usage_id = listing.json()["data"][0]["id"]

    detail = client.get(f"/api/v1/usage/{usage_id}")
    assert detail.status_code == 200
    body = detail.json()["data"]
    assert len(body["prompt_full"]) == 5000
    assert len(body["response_full"]) == 5000
    assert body["prompt_preview"] == "short prompt"


def test_usage_detail_404_for_missing_id(client):
    resp = client.get("/api/v1/usage/999999")
    assert resp.status_code == 404


def test_timeline_defaults_to_all_time(client):
    resp = client.get("/api/v1/usage/timeline")
    assert resp.status_code == 200
    assert len(resp.json()["data"]) >= 1


def test_timeline_days_param_still_works(client):
    resp = client.get("/api/v1/usage/timeline?days=7")
    assert resp.status_code == 200


def test_project_attribution_summary(client):
    resp = client.get("/api/v1/projects/demo-project/attribution-summary")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["top_skill"]["skill_name"] == "code-review"
    assert data["top_mcp_server"]["server_name"] == "github"
    assert data["top_mcp_server"]["call_count"] == 2
    assert data["top_hook"]["hook_name"] == "PostToolUse"


def test_mcp_servers_groups_by_server_not_full_tool_name(client):
    resp = client.get("/api/v1/mcp")
    assert resp.status_code == 200
    by_name = {row["server_name"]: row for row in resp.json()["data"]}
    assert by_name["github"]["call_count"] == 2
    assert by_name["linear"]["call_count"] == 1


def test_project_attribution_summary_unknown_project(client):
    resp = client.get("/api/v1/projects/does-not-exist/attribution-summary")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data == {"top_skill": None, "top_mcp_server": None, "top_hook": None}


def test_reports_preview_requests(client):
    resp = client.get("/api/v1/reports/preview?kind=requests")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["row_count"] >= 1
    assert "total_tokens" in data["columns"]
    assert data["sample"][0]["project"] == "demo-project"


def test_reports_preview_projects_filters_by_project(client):
    resp = client.get("/api/v1/reports/preview?kind=projects&project=demo-project")
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["row_count"] == 1
    assert data["sample"][0]["project"] == "demo-project"
    assert data["sample"][0]["top_tool"] in ("mcp__github__search_issues", "mcp__github__create_pr", "mcp__linear__list_issues")


def test_reports_preview_unknown_project_is_empty(client):
    resp = client.get("/api/v1/reports/preview?kind=requests&project=does-not-exist")
    assert resp.status_code == 200
    assert resp.json()["data"]["row_count"] == 0


def test_reports_export_csv(client):
    resp = client.get("/api/v1/reports/export?kind=requests&format=csv")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    assert "attachment" in resp.headers["content-disposition"]
    assert "demo-project" in resp.text
    assert resp.text.splitlines()[0].startswith("event_time,project,session_id")


def test_reports_export_json(client):
    resp = client.get("/api/v1/reports/export?kind=projects&format=json")
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("application/json")
    body = resp.json()
    assert any(row["project"] == "demo-project" for row in body)


def test_reports_export_rejects_unknown_kind(client):
    resp = client.get("/api/v1/reports/export?kind=bogus")
    assert resp.status_code == 422


def test_reports_export_csv_escapes_formula_leading_cells(client):
    conn = connect()
    conn.execute(
        """INSERT INTO usage(
            event_time,session_id,project,cwd,client,model,provider,transcript_path,transcript_line,
            input_tokens,output_tokens,cache_read_tokens,cache_write_tokens,total_tokens,cost_usd,
            prompt_preview,response_preview,prompt_full,response_full
        ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            "2024-01-02T00:00:00Z", "sess-formula", "demo-project", "/tmp/demo", "vscode", "claude-x",
            "anthropic", "/tmp/formula.jsonl", 1, 1, 1, 0, 0, 2, 0.0,
            "=cmd|'/c calc'!A1", "short response", "=cmd|'/c calc'!A1", "y",
        ),
    )
    conn.commit()
    conn.close()

    resp = client.get("/api/v1/reports/export?kind=requests&format=csv")
    assert resp.status_code == 200
    assert ",=cmd|" not in resp.text  # unescaped: would be a live formula in a spreadsheet
    assert ",'=cmd|" in resp.text  # escaped: leading quote neutralizes it
