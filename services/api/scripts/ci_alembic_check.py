"""CI: valida que as migrations cobrem o metadata (alembic check honesto).

Cria sqlite em arquivo via Base.metadata.create_all, carimba head e roda
`alembic check` (deve sair limpo). Uso: python scripts/ci_alembic_check.py
"""

import os
import subprocess
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

db_path = os.path.join(tempfile.gettempdir(), "ci_alembic_check.db")
if os.path.exists(db_path):
    os.remove(db_path)

os.environ["DATABASE_URL"] = f"sqlite+aiosqlite:///{db_path}"

import app.main  # noqa: F401 (registra models)
from app.core.database import Base
from sqlalchemy import create_engine

eng = create_engine(f"sqlite:///{db_path}")
Base.metadata.create_all(eng)
eng.dispose()

env = dict(os.environ)
env["DATABASE_URL"] = f"sqlite+aiosqlite:///{db_path}"
r1 = subprocess.run(
    [sys.executable, "-m", "alembic", "-c", "alembic.ini", "stamp", "head"],
    capture_output=True, text=True, env=env,
)
print(r1.stdout[-500:] if r1.stdout else "")
print(r1.stderr[-500:] if r1.stderr else "")
if r1.returncode != 0:
    raise SystemExit(r1.returncode)
r2 = subprocess.run(
    [sys.executable, "-m", "alembic", "-c", "alembic.ini", "check"],
    capture_output=True, text=True, env=env,
)
print(r2.stdout[-2000:] if r2.stdout else "")
print(r2.stderr[-500:] if r2.stderr else "")
os.path.exists(db_path) and os.remove(db_path)
raise SystemExit(r2.returncode)
