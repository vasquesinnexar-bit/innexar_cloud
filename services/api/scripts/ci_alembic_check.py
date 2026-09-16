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

import app.main  # noqa: F401,E402 (registra models; exige sys.path acima)
from app.core.database import Base  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402


def _model_modules(path: str) -> set[str]:
    """Módulos app.modules.*.models importados (estático, via AST)."""
    import ast

    with open(path, encoding="utf-8") as f:
        tree = ast.parse(f.read())
    out: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.ImportFrom,)):
            mod = node.module or ""
            if ".models" in mod:
                out.add(mod)
    return out


_API_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_main_models = _model_modules(os.path.join(_API_DIR, "app", "main.py"))
_env_models = _model_modules(os.path.join(_API_DIR, "alembic", "env.py"))
missing = sorted(_main_models - _env_models)
if missing:
    print(f"TRAVA: alembic/env.py não importa models usados em main: {missing}")
    raise SystemExit(2)

eng = create_engine(f"sqlite:///{db_path}")
Base.metadata.create_all(eng)
eng.dispose()

env = dict(os.environ)
env["DATABASE_URL"] = f"sqlite+aiosqlite:///{db_path}"
r1 = subprocess.run(
    [sys.executable, "-m", "alembic", "-c", "alembic.ini", "stamp", "head"],
    capture_output=True,
    text=True,
    env=env,
)
print(r1.stdout[-500:] if r1.stdout else "")
print(r1.stderr[-500:] if r1.stderr else "")
if r1.returncode != 0:
    raise SystemExit(r1.returncode)
r2 = subprocess.run(
    [sys.executable, "-m", "alembic", "-c", "alembic.ini", "check"],
    capture_output=True,
    text=True,
    env=env,
)
print(r2.stdout[-2000:] if r2.stdout else "")
print(r2.stderr[-500:] if r2.stderr else "")
os.path.exists(db_path) and os.remove(db_path)
raise SystemExit(r2.returncode)
