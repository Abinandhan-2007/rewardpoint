import os
import io
import csv
import json
import secrets
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, Query, Response, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func

import models
from database import engine, init_db, get_db, SessionLocal
from config import (
    PORT,
    HOST,
    STATIC_DIR,
    SEED_TEAM_NAME,
    SEED_CAPTAIN_ROLL,
    SEED_CAPTAIN_PASSWORD
)
from auth import (
    hash_password,
    verify_password,
    generate_team_id,
    create_access_token,
    check_login_rate_limit,
    record_failed_attempt,
    record_successful_attempt,
    get_current_user,
    require_captain,
    require_member_or_captain
)
from fetcher import gradio_fetcher, process_user_snapshot
from scheduler import scheduler
from events import event_manager
from semester_timeline import generate_semester_timeline

logger = logging.getLogger("api")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize database and start scheduler
    init_db()
    scheduler.start()
    yield
    # Shutdown: stop scheduler
    scheduler.stop()

app = FastAPI(
    title="Team Reward Tracker API",
    description="Multi-Team Reward Tracker with Captain and Member Roles & Gradio Synchronization",
    version="2.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ----------------- Health Check Routes -----------------
@app.get("/health")
def health():
    return {"status": "ok"}

@app.get("/api/health")
def api_health():
    return {"status": "ok"}

# ----------------- Static Asset Mounting -----------------
if STATIC_DIR and (STATIC_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

# ----------------- Pydantic Request Schemas -----------------
class CaptainSignupRequest(BaseModel):
    team_id: str = Field(..., min_length=2)  # Captain provides their own chosen Team ID
    roll_no: str = Field(..., min_length=2)
    password: str = Field(..., min_length=4)
    captain_name: Optional[str] = ""
    team_name: Optional[str] = None

class LoginRequest(BaseModel):
    team_id: str = Field(..., min_length=1)
    roll_no: str = Field(..., min_length=2)
    password: Optional[str] = ""

class MemberAddRequest(BaseModel):
    roll_no: str = Field(..., min_length=2)
    name: Optional[str] = None
    password: Optional[str] = None

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=4)

class MemberPasswordResetRequest(BaseModel):
    new_password: Optional[str] = None


# ----------------- Auth & Team Creation Routes -----------------
@app.post("/api/auth/signup")
async def captain_signup(req: CaptainSignupRequest, db: Session = Depends(get_db)):
    """
    Captain signup: creates a new team with the captain's specified Team ID
    (not auto-generated) and registers the captain user.
    """
    team_code = req.team_id.strip().upper()
    c_roll = req.roll_no.strip().upper()
    pwd = req.password.strip()
    c_name = req.captain_name.strip() if req.captain_name else c_roll

    if not team_code:
        raise HTTPException(status_code=400, detail="Team ID is required")
    if not c_roll or not pwd:
        raise HTTPException(status_code=400, detail="Captain roll number and password are required")

    # Check if Team ID is already taken
    existing_team = db.query(models.Team).filter(func.upper(models.Team.team_id) == team_code).first()
    if existing_team:
        raise HTTPException(status_code=400, detail=f"Team ID '{team_code}' is already taken. Please choose another Team ID.")

    new_team = models.Team(
        team_id=team_code,
        name=team_code
    )
    db.add(new_team)
    db.flush()

    captain_user = models.User(
        team_id=new_team.id,
        name=c_name,
        roll_no=c_roll,
        password_hash=hash_password(pwd),
        role="captain"
    )
    db.add(captain_user)
    db.commit()
    db.refresh(new_team)
    db.refresh(captain_user)

    # Issue JWT token
    token = create_access_token(captain_user, new_team)

    # Trigger background fetch for captain's own roll number
    asyncio.create_task(_fetch_single_user_task(captain_user.id))

    return {
        "token": token,
        "role": "captain",
        "team": {
            "id": new_team.id,
            "team_id": new_team.team_id,
            "name": new_team.team_id
        },
        "user": {
            "id": captain_user.id,
            "name": captain_user.name,
            "roll_no": captain_user.roll_no,
            "role": "captain"
        },
        "message": f"Team '{new_team.team_id}' created successfully!"
    }


@app.post("/api/auth/login")
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    Login endpoint: requires Team ID and Roll Number.
    - Members: only need Team ID + Roll Number (no password needed).
    - Captains: require password verification.
    Rate limited by client IP & roll number.
    """
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"{client_ip}:{req.roll_no.strip().upper()}"
    check_login_rate_limit(rate_key)

    team_code = req.team_id.strip().upper()
    roll_no = req.roll_no.strip().upper()
    password = (req.password or "").strip()

    # 1. Lookup Team
    team = db.query(models.Team).filter(func.upper(models.Team.team_id) == team_code).first()
    if not team:
        record_failed_attempt(rate_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Team '{team_code}' not found. Please check your Team ID."
        )

    # 2. Lookup User within this team
    user = (
        db.query(models.User)
        .filter(models.User.team_id == team.id, func.upper(models.User.roll_no) == roll_no)
        .first()
    )
    if not user:
        record_failed_attempt(rate_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Roll number '{roll_no}' not found in Team '{team_code}'."
        )

    # 3. Role-based verification:
    # Members do NOT need password! Roll number is enough.
    if user.role == "captain":
        if not password or not verify_password(password, user.password_hash):
            record_failed_attempt(rate_key)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid captain password."
            )

    # Clear rate limiter count on success
    record_successful_attempt(rate_key)

    token = create_access_token(user, team)
    return {
        "token": token,
        "role": user.role,
        "team": {
            "id": team.id,
            "team_id": team.team_id,
            "name": team.team_id
        },
        "user": {
            "id": user.id,
            "name": user.name,
            "roll_no": user.roll_no,
            "role": user.role
        },
        "message": "Login successful"
    }


@app.get("/api/auth/me")
def get_me(auth = Depends(get_current_user)):
    user, team = auth
    return {
        "user": {
            "id": user.id,
            "name": user.name,
            "roll_no": user.roll_no,
            "role": user.role
        },
        "team": {
            "id": team.id,
            "team_id": team.team_id,
            "name": team.name
        }
    }


@app.post("/api/auth/change-password")
def change_password(
    req: PasswordChangeRequest,
    auth = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Any authenticated user can change their own password"""
    user, _ = auth
    if not verify_password(req.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password does not match.")
    
    user.password_hash = hash_password(req.new_password)
    user.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Password updated successfully."}


# ----------------- Captain Routes -----------------
@app.get("/api/team/members")
def get_team_members(
    auth = Depends(require_captain),
    db: Session = Depends(get_db)
):
    """
    Captain view: returns all members of the captain's team with their latest stats.
    """
    captain, team = auth
    users = db.query(models.User).filter(models.User.team_id == team.id).all()
    results = []
    cutoff = datetime.utcnow() - timedelta(hours=24)

    for u in users:
        latest_snapshot = (
            db.query(models.Snapshot)
            .filter(models.Snapshot.user_id == u.id)
            .order_by(models.Snapshot.timestamp.desc())
            .first()
        )
        recent_change = (
            db.query(models.ChangeLog)
            .filter(models.ChangeLog.user_id == u.id, models.ChangeLog.timestamp >= cutoff)
            .order_by(models.ChangeLog.timestamp.desc())
            .first()
        )

        results.append({
            "id": u.id,
            "roll_no": u.roll_no,
            "name": u.name,
            "role": u.role,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "balance_points": latest_snapshot.balance_points if latest_snapshot else 0.0,
            "cumulative_points": latest_snapshot.cumulative_points if latest_snapshot else 0.0,
            "redeemed_points": latest_snapshot.redeemed_points if latest_snapshot else 0.0,
            "total_marks": latest_snapshot.total_marks if latest_snapshot else 0.0,
            "total_subjects": latest_snapshot.total_subjects if latest_snapshot else 0,
            "year": latest_snapshot.year if latest_snapshot else None,
            "department": latest_snapshot.department if latest_snapshot else None,
            "mentor_name": latest_snapshot.mentor_name if latest_snapshot else None,
            "last_updated": latest_snapshot.timestamp.isoformat() if latest_snapshot else None,
            "fetch_status": latest_snapshot.fetch_status if latest_snapshot else "pending",
            "has_recent_change": recent_change is not None,
            "recent_change_desc": recent_change.description if recent_change else None
        })

    return results


@app.post("/api/team/members")
async def add_team_member(
    req: MemberAddRequest,
    auth = Depends(require_captain),
    db: Session = Depends(get_db)
):
    """
    Captain adds a member: roll number is required.
    Members do not require passwords; they log in using Team ID + Roll Number.
    """
    captain, team = auth
    roll = req.roll_no.strip().upper()
    if not roll:
        raise HTTPException(status_code=400, detail="Roll number is required")

    # Check if this roll number already exists in this team
    existing = db.query(models.User).filter(
        models.User.team_id == team.id,
        models.User.roll_no == roll
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Member with roll number {roll} already exists in team {team.team_id}."
        )

    given_name = req.name.strip() if req.name and req.name.strip() else roll

    new_user = models.User(
        team_id=team.id,
        roll_no=roll,
        name=given_name,
        password_hash="",
        role="member"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Broadcast initial entry
    await event_manager.broadcast("member_updated", {
        "id": new_user.id,
        "team_id": team.id,
        "roll_no": new_user.roll_no,
        "name": new_user.name,
        "role": "member",
        "balance_points": 0.0,
        "cumulative_points": 0.0,
        "redeemed_points": 0.0,
        "total_marks": 0.0,
        "total_subjects": 0,
        "fetch_status": "fetching",
        "has_recent_change": False
    }, team_id=team.id)

    # Trigger background fetch immediately for this member
    asyncio.create_task(_fetch_single_user_task(new_user.id))

    return {
        "id": new_user.id,
        "roll_no": new_user.roll_no,
        "name": new_user.name,
        "team_id": team.team_id,
        "team_name": team.team_id,
        "message": f"Member {new_user.roll_no} added! The student can log in using Team ID '{team.team_id}' and Roll No '{new_user.roll_no}' (no password needed)."
    }


@app.delete("/api/team/members/{user_id}")
def remove_team_member(
    user_id: int,
    auth = Depends(require_captain),
    db: Session = Depends(get_db)
):
    """
    Captain removes a member: deletes member and cascades stored data (snapshots, logs).
    """
    captain, team = auth
    if user_id == captain.id:
        raise HTTPException(status_code=400, detail="Captains cannot remove their own account from the team.")

    target = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.team_id == team.id
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found in your team.")

    roll_deleted = target.roll_no
    name_deleted = target.name
    db.delete(target)
    db.commit()

    return {
        "message": f"Member {name_deleted} ({roll_deleted}) and all stored data were deleted."
    }


@app.post("/api/team/members/{user_id}/reset-password")
def reset_member_password(
    user_id: int,
    req: MemberPasswordResetRequest,
    auth = Depends(require_captain),
    db: Session = Depends(get_db)
):
    """
    Captain resets a member's password and gets a temporary password to share.
    """
    captain, team = auth
    target = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.team_id == team.id
    ).first()
    if not target:
        raise HTTPException(status_code=404, detail="Member not found in your team.")

    new_pwd = req.new_password.strip() if req.new_password and req.new_password.strip() else f"reset-{secrets.token_hex(2).upper()}"
    target.password_hash = hash_password(new_pwd)
    target.updated_at = datetime.utcnow()
    db.commit()

    return {
        "user_id": target.id,
        "roll_no": target.roll_no,
        "name": target.name,
        "temp_password": new_pwd,
        "message": f"Password reset for {target.name}. Share the temporary password."
    }


@app.get("/api/team/members/{user_id}/details")
def get_member_full_details(
    user_id: int,
    auth = Depends(require_captain),
    db: Session = Depends(get_db)
):
    """
    Captain views all details of a specific member in their team,
    including the whole semester progression graph timeline.
    """
    captain, team = auth
    user = db.query(models.User).filter(
        models.User.id == user_id,
        models.User.team_id == team.id
    ).first()
    if not user:
        raise HTTPException(status_code=404, detail="Member not found in your team.")

    return _build_user_details_response(db, user)


@app.get("/api/team/changes")
def get_team_changes(
    limit: int = Query(50, ge=1, le=200),
    auth = Depends(require_captain),
    db: Session = Depends(get_db)
):
    """Recent changes feed scoped strictly to the captain's team"""
    captain, team = auth
    changes = (
        db.query(models.ChangeLog, models.User)
        .join(models.User, models.ChangeLog.user_id == models.User.id)
        .filter(models.ChangeLog.team_id == team.id)
        .order_by(models.ChangeLog.timestamp.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": log.id,
            "user_id": user.id,
            "member_name": user.name,
            "roll_no": user.roll_no,
            "field": log.field_name,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "description": log.description,
            "timestamp": log.timestamp.isoformat()
        }
        for log, user in changes
    ]


@app.get("/api/team/export/csv")
def export_team_csv(
    auth = Depends(require_captain),
    db: Session = Depends(get_db)
):
    """Captain exports team members and metrics as CSV"""
    captain, team = auth
    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "Team ID",
        "Team Name",
        "Roll Number",
        "Student Name",
        "Role",
        "Year",
        "Department",
        "Mentor Name",
        "Balance Reward Points",
        "Cumulative Points",
        "Redeemed Points",
        "Total Internal Marks",
        "Total Subjects",
        "Last Updated (UTC)",
        "Fetch Status"
    ])

    users = db.query(models.User).filter(models.User.team_id == team.id).all()
    for u in users:
        snap = (
            db.query(models.Snapshot)
            .filter(models.Snapshot.user_id == u.id)
            .order_by(models.Snapshot.timestamp.desc())
            .first()
        )
        if snap:
            writer.writerow([
                team.team_id,
                team.name,
                u.roll_no,
                u.name,
                u.role,
                snap.year or "",
                snap.department or "",
                snap.mentor_name or "",
                f"{snap.balance_points:.2f}",
                f"{snap.cumulative_points:.2f}",
                f"{snap.redeemed_points:.2f}",
                f"{snap.total_marks:.2f}",
                snap.total_subjects,
                snap.timestamp.strftime("%Y-%m-%d %H:%M:%S") if snap.timestamp else "",
                snap.fetch_status
            ])
        else:
            writer.writerow([
                team.team_id,
                team.name,
                u.roll_no,
                u.name,
                u.role,
                "", "", "", "0.00", "0.00", "0.00", "0.00", 0, "", "pending"
            ])

    output.seek(0)
    filename = f"{team.team_id}_reward_tracker_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.post("/api/team/refresh")
def refresh_team_now(auth = Depends(require_captain)):
    """Captain initiates an immediate sync cycle for the team"""
    scheduler.trigger_immediate_sync()
    return {"status": "triggered", "message": "Manual sync initiated for your team."}


# ----------------- Member & Shared Routes -----------------
@app.get("/api/member/me")
def get_member_self_details(
    auth = Depends(require_member_or_captain),
    db: Session = Depends(get_db)
):
    """
    Member view: member can ONLY view their own full details,
    points, marks, activities, and whole semester progression graph.
    """
    user, _ = auth
    return _build_user_details_response(db, user)


@app.get("/api/team/summary")
def get_team_summary(
    auth = Depends(require_member_or_captain),
    db: Session = Depends(get_db)
):
    """
    Shared view: returns aggregated team summary and top performers leaderboard
    (name + points only, safe for members to see).
    """
    user, team = auth
    users = db.query(models.User).filter(models.User.team_id == team.id).all()
    total_members = len(users)

    total_points = 0.0
    total_marks = 0.0
    latest_sync = None
    leaderboard_raw = []

    for u in users:
        snap = (
            db.query(models.Snapshot)
            .filter(models.Snapshot.user_id == u.id)
            .order_by(models.Snapshot.timestamp.desc())
            .first()
        )
        pts = snap.balance_points if snap else 0.0
        mks = snap.total_marks if snap else 0.0
        if snap and snap.timestamp:
            if not latest_sync or snap.timestamp > latest_sync:
                latest_sync = snap.timestamp

        total_points += pts
        total_marks += mks

        # Top performers list: name + points only (member cannot see other member's subjects/history)
        leaderboard_raw.append({
            "name": u.name,
            "points": pts,
            "is_current_user": (u.id == user.id)
        })

    # Sort leaderboard descending by points
    leaderboard_raw.sort(key=lambda x: x["points"], reverse=True)
    leaderboard = [
        {
            "rank": idx + 1,
            "name": item["name"],
            "points": item["points"],
            "is_current_user": item["is_current_user"]
        }
        for idx, item in enumerate(leaderboard_raw)
    ]

    avg_points = (total_points / total_members) if total_members > 0 else 0.0
    avg_marks = (total_marks / total_members) if total_members > 0 else 0.0

    return {
        "team_id": team.team_id,
        "team_name": team.name,
        "total_members": total_members,
        "total_points": round(total_points, 2),
        "avg_points": round(avg_points, 2),
        "avg_marks": round(avg_marks, 2),
        "last_sync": latest_sync.isoformat() if latest_sync else None,
        "leaderboard": leaderboard
    }


@app.get("/api/sync/status")
def get_sync_status(db: Session = Depends(get_db)):
    status_row = db.query(models.SyncStatus).filter_by(id=1).first()
    if not status_row:
        return {
            "status": "idle",
            "last_sync_start": None,
            "last_sync_finish": None,
            "source_reachable": True,
            "last_error": None
        }
    return {
        "status": status_row.status,
        "last_sync_start": status_row.last_sync_start.isoformat() if status_row.last_sync_start else None,
        "last_sync_finish": status_row.last_sync_finish.isoformat() if status_row.last_sync_finish else None,
        "source_reachable": status_row.source_reachable,
        "last_error": status_row.last_error
    }


# ----------------- Live Server-Sent Events (SSE) -----------------
@app.get("/api/events")
async def events_endpoint(token: Optional[str] = Query(None)):
    """
    SSE stream yielding live update events strictly filtered to the user's team.
    """
    team_db_id = None
    if token:
        try:
            from auth import decode_access_token
            payload = decode_access_token(token)
            team_db_id = payload.get("team_db_id")
        except Exception:
            team_db_id = None

    queue = event_manager.subscribe(team_id=team_db_id)

    async def event_generator():
        yield f"event: connected\ndata: {json.dumps({'message': 'Connected to live stream', 'team_id': team_db_id})}\n\n"
        try:
            while True:
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield message
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            event_manager.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


# ----------------- Helper Functions -----------------
def _build_user_details_response(db: Session, user: models.User) -> dict:
    """Helper to assemble full member details with semester progression graph"""
    latest_snapshot = (
        db.query(models.Snapshot)
        .filter(models.Snapshot.user_id == user.id)
        .order_by(models.Snapshot.timestamp.desc())
        .first()
    )

    history_snapshots = (
        db.query(models.Snapshot)
        .filter(models.Snapshot.user_id == user.id)
        .order_by(models.Snapshot.timestamp.asc())
        .limit(50)
        .all()
    )

    chart_data = [
        {
            "timestamp": s.timestamp.isoformat(),
            "balance_points": s.balance_points,
            "cumulative_points": s.cumulative_points,
            "redeemed_points": s.redeemed_points,
            "total_marks": s.total_marks
        }
        for s in history_snapshots
    ]

    change_logs = (
        db.query(models.ChangeLog)
        .filter(models.ChangeLog.user_id == user.id)
        .order_by(models.ChangeLog.timestamp.desc())
        .all()
    )

    logs_data = [
        {
            "id": c.id,
            "timestamp": c.timestamp.isoformat(),
            "field_name": c.field_name,
            "old_value": c.old_value,
            "new_value": c.new_value,
            "description": c.description
        }
        for c in change_logs
    ]

    current_data = None
    if latest_snapshot:
        subjects_list = []
        activities_list = []
        breakdown_dict = {}
        try:
            if latest_snapshot.subjects_json:
                subjects_list = json.loads(latest_snapshot.subjects_json)
            if latest_snapshot.activities_json:
                activities_list = json.loads(latest_snapshot.activities_json)
            if latest_snapshot.breakdown_json:
                breakdown_dict = json.loads(latest_snapshot.breakdown_json)
        except Exception:
            pass

        current_data = {
            "balance_points": latest_snapshot.balance_points,
            "cumulative_points": latest_snapshot.cumulative_points,
            "redeemed_points": latest_snapshot.redeemed_points,
            "total_marks": latest_snapshot.total_marks,
            "total_subjects": latest_snapshot.total_subjects,
            "year": latest_snapshot.year,
            "department": latest_snapshot.department,
            "mentor_name": latest_snapshot.mentor_name,
            "average_points": latest_snapshot.average_points,
            "points_needed": latest_snapshot.points_needed,
            "subjects": subjects_list,
            "activities": activities_list,
            "breakdown": breakdown_dict,
            "fetch_status": latest_snapshot.fetch_status,
            "error_message": latest_snapshot.error_message,
            "last_updated": latest_snapshot.timestamp.isoformat()
        }

    semester_progression = generate_semester_timeline(latest_snapshot)

    return {
        "user": {
            "id": user.id,
            "name": user.name,
            "roll_no": user.roll_no,
            "role": user.role,
            "team_id": user.team.team_id if user.team else "",
            "team_name": user.team.name if user.team else ""
        },
        "current": current_data,
        "chart_data": chart_data,
        "semester_progression": semester_progression,
        "change_logs": logs_data
    }


async def _fetch_single_user_task(user_id: int):
    """Background helper to fetch single user immediately without holding request open"""
    await asyncio.sleep(0.5)
    db = SessionLocal()
    try:
        user = db.query(models.User).filter(models.User.id == user_id).first()
        if user:
            fetched = await gradio_fetcher.fetch_member_data(user.roll_no)
            await process_user_snapshot(db, user, fetched)
    except Exception as e:
        logger.error(f"Error fetching user {user_id}: {e}")
    finally:
        db.close()


# Catch-all route to serve React index.html for client-side routing
@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    if full_path.startswith("api/") or full_path == "api":
        raise HTTPException(status_code=404, detail="API endpoint not found")
    if STATIC_DIR and (STATIC_DIR / full_path).is_file():
        return FileResponse(STATIC_DIR / full_path)
    if STATIC_DIR and (STATIC_DIR / "index.html").is_file():
        return FileResponse(STATIC_DIR / "index.html")
    return {"status": "ok", "app": "Team Reward Tracker API"}
