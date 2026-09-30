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
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BASE_DIR}/tracker.db")
PORT = int(os.getenv("PORT", "8000"))
HOST = os.getenv("HOST", "0.0.0.0")
