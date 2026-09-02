import os, sqlite3
from pathlib import Path
from .schema import SCHEMA, add_migrations

DEFAULT_DB = Path(os.environ.get("CLAUDE_TELEMETRY_DB", "~/.claude/telemetry/telemetry.db")).expanduser()


def connect(db_path=None):
    p = Path(db_path or DEFAULT_DB).expanduser()
    p.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(p, timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=30000")
    conn.executescript(SCHEMA)
    add_migrations(conn)
    return conn