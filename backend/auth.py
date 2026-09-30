import time
import secrets
import string
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Tuple
from collections import defaultdict

import bcrypt
import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_MINUTES
from database import get_db
import models

logger = logging.getLogger("auth")

security_bearer = HTTPBearer(auto_error=False)

# ----------------- Password Hashing (bcrypt) -----------------
def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception as e:
        logger.warning(f"Password verification error: {e}")
        return False

# ----------------- Team ID Generator -----------------
def generate_team_id(db: Session) -> str:
    """Generate a readable, short unique Team ID, e.g. TEAM-4F9K2"""
    charset = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
    for _ in range(50):
        code = "".join(secrets.choice(charset) for _ in range(5))
        candidate = f"TEAM-{code}"
        exists = db.query(models.Team).filter(models.Team.team_id == candidate).first()
        if not exists:
            return candidate
    # Fallback with timestamp
    return f"TEAM-{int(time.time()) % 100000:05d}"

# ----------------- JWT Token Management -----------------
def create_access_token(user: models.User, team: models.Team, expires_delta: Optional[timedelta] = None) -> str:
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=JWT_EXPIRE_MINUTES)
    
    payload = {
        "sub": str(user.id),
        "user_id": user.id,
        "team_db_id": user.team_id,
        "team_id": team.team_id,
        "team_name": team.name,
        "roll_no": user.roll_no,
        "name": user.name,
        "role": user.role,  # "captain" | "member"
        "exp": expire,
        "iat": datetime.utcnow()
    }
    encoded = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded

def decode_access_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

# ----------------- Rate Limiting on Login -----------------
# Maps key (client_ip + roll_no) -> list of failed attempt timestamps
_login_attempts: Dict[str, list] = defaultdict(list)
RATE_LIMIT_WINDOW = 60  # seconds
MAX_LOGIN_ATTEMPTS = 5  # attempts per window

def check_login_rate_limit(key: str):
    now = time.time()
    attempts = _login_attempts[key]
    # Prune old attempts
    valid_attempts = [t for t in attempts if now - t < RATE_LIMIT_WINDOW]
    _login_attempts[key] = valid_attempts

    if len(valid_attempts) >= MAX_LOGIN_ATTEMPTS:
        retry_after = int(RATE_LIMIT_WINDOW - (now - valid_attempts[0]))
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed login attempts. Please wait {max(1, retry_after)} seconds before trying again.",
            headers={"Retry-After": str(max(1, retry_after))}
        )

def record_failed_attempt(key: str):
    _login_attempts[key].append(time.time())

def record_successful_attempt(key: str):
    if key in _login_attempts:
        del _login_attempts[key]

# ----------------- FastAPI Auth Dependencies -----------------
async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: Session = Depends(get_db)
) -> Tuple[models.User, models.Team]:
    """
    Extract and validate the current user and their team from the Bearer token.
    Raises 401 if missing or invalid.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Malformed authentication token."
        )

    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account no longer exists."
        )

    team = db.query(models.Team).filter(models.Team.id == user.team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Team no longer exists."
        )

    return user, team

async def require_captain(
    auth: Tuple[models.User, models.Team] = Depends(get_current_user)
) -> Tuple[models.User, models.Team]:
    """
    Strictly require the authenticated user to be a CAPTAIN.
    Returns 403 Forbidden if the user is only a member.
    """
    user, team = auth
    if user.role != "captain":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Captain privileges required."
        )
    return user, team

async def require_member_or_captain(
    auth: Tuple[models.User, models.Team] = Depends(get_current_user)
) -> Tuple[models.User, models.Team]:
    """
    Any authenticated member or captain of the team.
    """
    return auth
