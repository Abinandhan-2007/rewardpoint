import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from backend directory or root directory
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
CAPTAIN_PASSWORD = os.getenv("CAPTAIN_PASSWORD", "captain2026")
SECRET_KEY = os.getenv("SECRET_KEY", "team-reward-tracker-super-secret-key-3.14")
# SQLite database configuration with DB_PATH env var support
DB_PATH = os.getenv("DB_PATH")
if DB_PATH:
    db_file = Path(DB_PATH).resolve()
    db_file.parent.mkdir(parents=True, exist_ok=True)
    DATABASE_URL = f"sqlite:///{db_file.as_posix()}"
else:
    DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR.as_posix()}/tracker.db")

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

# Initial members to seed if disk is wiped / database is empty
INITIAL_MEMBERS = os.getenv("INITIAL_MEMBERS", "")

