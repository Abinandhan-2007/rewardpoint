import hmac
import hashlib
import time
import json
import base64
from typing import Optional
from fastapi import HTTPException, Security, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from config import CAPTAIN_PASSWORD, SECRET_KEY

security = HTTPBearer(auto_error=False)

def create_access_token() -> str:
    """Create a tamper-proof signed session token for captain"""
    payload = {
        "role": "captain",
        "exp": int(time.time()) + (24 * 3600)  # 24 hours
    }
    payload_bytes = json.dumps(payload).encode("utf-8")
    payload_b64 = base64.urlsafe_b64encode(payload_bytes).decode("utf-8")
    
    sig = hmac.new(SECRET_KEY.encode("utf-8"), payload_b64.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{payload_b64}.{sig}"

def verify_token(token: str) -> bool:
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return False
        payload_b64, sig = parts
        expected_sig = hmac.new(SECRET_KEY.encode("utf-8"), payload_b64.encode("utf-8"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return False
        
        payload_bytes = base64.urlsafe_b64decode(payload_b64.encode("utf-8"))
        payload = json.loads(payload_bytes)
        if payload.get("exp", 0) < time.time():
            return False
        return True
    except Exception:
        return False

async def get_current_captain(credentials: Optional[HTTPAuthorizationCredentials] = Security(security)):
    if not credentials or not verify_token(credentials.credentials):
        raise HTTPException(
            status_code=401,
            detail="Unauthorized. Valid captain token required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return {"role": "captain"}
