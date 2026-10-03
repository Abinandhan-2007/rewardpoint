import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
ENV_PATH = BASE_DIR / ".env"
if ENV_PATH.exists():
    load_dotenv(ENV_PATH)
else:
    load_dotenv()

GRADIO_SPACE = os.getenv("GRADIO_SPACE", "PraneshJs/RewardPointsSite")
POLL_INTERVAL_MINUTES = int(os.getenv("POLL_INTERVAL_MINUTES", "5"))
FETCH_DELAY_SECONDS = float(os.getenv("FETCH_DELAY_SECONDS", "0.5"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))

# Auth & JWT
JWT_SECRET = os.getenv("JWT_SECRET", "team-reward-tracker-jwt-secret-key-production-grade-2026")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "1440")) # 24 hours

# Database URL (SQLite default, Postgres if provided via DATABASE_URL)
raw_db = os.getenv("DATABASE_URL")
if raw_db and (raw_db.startswith("postgresql://") or raw_db.startswith("postgres://")):
    # SQLAlchemy requires postgresql:// instead of postgres://
    if raw_db.startswith("postgres://"):
        raw_db = raw_db.replace("postgres://", "postgresql://", 1)
    DATABASE_URL = raw_db
elif os.getenv("DB_PATH"):
    db_file = Path(os.getenv("DB_PATH")).resolve()
    db_file.parent.mkdir(parents=True, exist_ok=True)
    DATABASE_URL = f"sqlite:///{db_file.as_posix()}"
elif raw_db and not raw_db.startswith("sqlite:///."):
    DATABASE_URL = raw_db
else:
    # Guarantee absolute path so running uvicorn from root or backend uses the exact same database file
    DATABASE_URL = f"sqlite:///{(BASE_DIR / 'tracker.db').resolve().as_posix()}"

# Seed Configuration for First Captain and Team (Disabled by default to keep DB clean)
ENABLE_SEED = os.getenv("ENABLE_SEED", "false").lower() == "true"
SEED_TEAM_NAME = os.getenv("SEED_TEAM_NAME", "Alpha Squad")
SEED_CAPTAIN_ROLL = os.getenv("SEED_CAPTAIN_ROLL", "7376241CS280")
SEED_CAPTAIN_PASSWORD = os.getenv("SEED_CAPTAIN_PASSWORD", "captain2026")
SEED_CAPTAIN_NAME = os.getenv("SEED_CAPTAIN_NAME", "monish jb")

PORT = int(os.getenv("PORT", "8000"))
HOST = os.getenv("HOST", "0.0.0.0")

# Static files directory for built React frontend
STATIC_DIR_ENV = os.getenv("STATIC_DIR")
if STATIC_DIR_ENV:
    STATIC_DIR = Path(STATIC_DIR_ENV).resolve()
else:
    repo_dist = BASE_DIR.parent / "frontend" / "dist"
    local_static = BASE_DIR / "static"
    local_dist = BASE_DIR / "dist"
    if repo_dist.exists():
        STATIC_DIR = repo_dist
    elif local_static.exists():
        STATIC_DIR = local_static
    elif local_dist.exists():
        STATIC_DIR = local_dist
    else:
        STATIC_DIR = repo_dist
