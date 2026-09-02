import sys
from pathlib import Path

# telemetry/ is the single canonical source for the SQLite schema and
# migrations (the background daemon connects through it directly). Re-export
# rather than keeping a second copy here -- see the note in
# backend/app/main.py and CONTRIBUTING.md for why that used to be a problem.
_ROOT = Path(__file__).resolve().parents[3]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from telemetry.db import SCHEMA, migrate as add_migrations  # noqa: E402,F401
