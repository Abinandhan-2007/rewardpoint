import os
import io
import csv
import json
import asyncio
from datetime import datetime, timedelta
from typing import Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, Depends, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

import models
from database import engine, init_db, get_db, SessionLocal
from config import CAPTAIN_PASSWORD, PORT, HOST
from auth import create_access_token, get_current_captain
from fetcher import gradio_fetcher, process_member_snapshot
from scheduler import scheduler
from events import event_manager
from semester_timeline import generate_semester_timeline

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
    description="Backend API for Captain's Team Reward Tracker with live Gradio sync",
    version="1.0.0",
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

# ----------------- Pydantic Schemas -----------------
class LoginRequest(BaseModel):
    password: str

class MemberCreate(BaseModel):
    name: str
    roll_no: str

class MemberUpdate(BaseModel):
    name: Optional[str] = None
    roll_no: Optional[str] = None


# ----------------- Auth Routes -----------------
@app.post("/api/auth/login")
def login(req: LoginRequest):
    if req.password.strip() == CAPTAIN_PASSWORD:
        token = create_access_token()
        return {"token": token, "role": "captain", "message": "Login successful"}
    raise HTTPException(status_code=401, detail="Invalid captain password")

@app.get("/api/auth/me")
def get_me(captain = Depends(get_current_captain)):
    return {"role": "captain", "status": "authenticated"}


# ----------------- Member Management Routes -----------------
@app.get("/api/members")
def get_members(
    db: Session = Depends(get_db),
    captain = Depends(get_current_captain)
):
    members = db.query(models.Member).filter(models.Member.is_active == True).all()
    results = []
    
    # 24 hour threshold for "recent change"
    cutoff = datetime.utcnow() - timedelta(hours=24)

    for m in members:
        latest_snapshot = (
            db.query(models.Snapshot)
            .filter(models.Snapshot.member_id == m.id)
            .order_by(models.Snapshot.timestamp.desc())
            .first()
        )
        
        # Check if there was any change logged recently
        recent_change = (
            db.query(models.ChangeLog)
            .filter(models.ChangeLog.member_id == m.id, models.ChangeLog.timestamp >= cutoff)
            .order_by(models.ChangeLog.timestamp.desc())
            .first()
        )

        item = {
            "id": m.id,
            "roll_no": m.roll_no,
            "name": m.name,
            "created_at": m.created_at.isoformat() if m.created_at else None,
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
            "error_message": latest_snapshot.error_message if latest_snapshot else None,
            "has_recent_change": recent_change is not None,
            "recent_change_desc": recent_change.description if recent_change else None,
            "recent_change_time": recent_change.timestamp.isoformat() if recent_change else None
        }
        results.append(item)

    return results

@app.post("/api/members")
async def add_member(
    req: MemberCreate,
    db: Session = Depends(get_db),
    captain = Depends(get_current_captain)
):
    roll_no = req.roll_no.strip().upper()
    name = req.name.strip()

    if not roll_no:
        raise HTTPException(status_code=400, detail="Roll number is required")
    if not name:
        name = roll_no

    existing = db.query(models.Member).filter(models.Member.roll_no == roll_no).first()
    if existing:
        if not existing.is_active:
            existing.is_active = True
            existing.name = name
            db.commit()
            db.refresh(existing)
            # Trigger background fetch for this member
            asyncio.create_task(_fetch_single_member_task(existing.id))
            return {"id": existing.id, "roll_no": existing.roll_no, "name": existing.name, "message": "Member reactivated"}
        raise HTTPException(status_code=400, detail=f"Member with roll number {roll_no} already exists")

    new_member = models.Member(
        roll_no=roll_no,
        name=name,
        is_active=True
    )
    db.add(new_member)
    db.commit()
    db.refresh(new_member)

    # Immediately broadcast that the member was added and is currently fetching
    await event_manager.broadcast("member_updated", {
        "id": new_member.id,
        "roll_no": new_member.roll_no,
        "name": new_member.name,
        "balance_points": 0.0,
        "cumulative_points": 0.0,
        "redeemed_points": 0.0,
        "total_marks": 0.0,
        "total_subjects": 0,
        "year": None,
        "department": None,
        "mentor_name": None,
        "last_updated": datetime.utcnow().isoformat(),
        "fetch_status": "fetching",
        "has_recent_change": False
    })

    # Immediately fetch member data in the background so it populates right away
    asyncio.create_task(_fetch_single_member_task(new_member.id))

    return {
        "id": new_member.id, 
        "roll_no": new_member.roll_no, 
        "name": new_member.name, 
        "message": f"Member {new_member.roll_no} added! Fetching live details from Gradio Space...",
        "fetch_status": "fetching"
    }

@app.put("/api/members/{member_id}")
def update_member(
    member_id: int,
    req: MemberUpdate,
    db: Session = Depends(get_db),
    captain = Depends(get_current_captain)
):
    member = db.query(models.Member).filter(models.Member.id == member_id, models.Member.is_active == True).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    if req.name is not None and req.name.strip():
        member.name = req.name.strip()
    if req.roll_no is not None and req.roll_no.strip():
        new_roll = req.roll_no.strip().upper()
        if new_roll != member.roll_no:
            # Check duplicate
            other = db.query(models.Member).filter(models.Member.roll_no == new_roll, models.Member.id != member_id).first()
            if other:
                raise HTTPException(status_code=400, detail=f"Roll number {new_roll} is already in use")
            member.roll_no = new_roll
            # Trigger re-fetch for new roll number
            asyncio.create_task(_fetch_single_member_task(member.id))

    member.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Member updated successfully"}

@app.delete("/api/members/{member_id}")
def delete_member(
    member_id: int,
    db: Session = Depends(get_db),
    captain = Depends(get_current_captain)
):
    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")
    
    # Soft delete
    member.is_active = False
    member.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Member removed successfully"}

@app.post("/api/members/{member_id}/fetch")
async def trigger_member_fetch(
    member_id: int,
    db: Session = Depends(get_db),
    captain = Depends(get_current_captain)
):
    member = db.query(models.Member).filter(models.Member.id == member_id, models.Member.is_active == True).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    fetched = await gradio_fetcher.fetch_member_data(member.roll_no)
    snapshot = await process_member_snapshot(db, member, fetched)
    return {
        "status": snapshot.fetch_status,
        "balance_points": snapshot.balance_points,
        "total_marks": snapshot.total_marks,
        "error_message": snapshot.error_message
    }

async def _fetch_single_member_task(member_id: int):
    """Background helper to fetch single member without holding request open"""
    await asyncio.sleep(0.5)
    db = SessionLocal()
    try:
        member = db.query(models.Member).filter(models.Member.id == member_id).first()
        if member and member.is_active:
            fetched = await gradio_fetcher.fetch_member_data(member.roll_no)
            await process_member_snapshot(db, member, fetched)
    except Exception as e:
        print(f"Error fetching member {member_id}: {e}")
    finally:
        db.close()


# ----------------- Member Details & History -----------------
@app.get("/api/members/{member_id}/history")
def get_member_history(
    member_id: int,
    db: Session = Depends(get_db),
    captain = Depends(get_current_captain)
):
    member = db.query(models.Member).filter(models.Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=404, detail="Member not found")

    # Latest snapshot
    latest_snapshot = (
        db.query(models.Snapshot)
        .filter(models.Snapshot.member_id == member.id)
        .order_by(models.Snapshot.timestamp.desc())
        .first()
    )

    # Historical snapshots for line chart (up to 50 most recent, chronologically ordered)
    history_snapshots = (
        db.query(models.Snapshot)
        .filter(models.Snapshot.member_id == member.id)
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

    # Full change log for this member
    change_logs = (
        db.query(models.ChangeLog)
        .filter(models.ChangeLog.member_id == member.id)
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
            "raw_student_text": latest_snapshot.raw_student_text,
            "raw_subjects_text": latest_snapshot.raw_subjects_text,
            "fetch_status": latest_snapshot.fetch_status,
            "error_message": latest_snapshot.error_message,
            "last_updated": latest_snapshot.timestamp.isoformat()
        }

    semester_progression = generate_semester_timeline(latest_snapshot)

    return {
        "member": {
            "id": member.id,
            "name": member.name,
            "roll_no": member.roll_no,
            "is_active": member.is_active
        },
        "current": current_data,
        "chart_data": chart_data,
        "semester_progression": semester_progression,
        "change_logs": logs_data
    }


# ----------------- Recent Changes Feed -----------------
@app.get("/api/changes")
def get_recent_changes(
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    captain = Depends(get_current_captain)
):
    changes = (
        db.query(models.ChangeLog, models.Member)
        .join(models.Member, models.ChangeLog.member_id == models.Member.id)
        .order_by(models.ChangeLog.timestamp.desc())
        .limit(limit)
        .all()
    )

    return [
        {
            "id": log.id,
            "member_id": member.id,
            "member_name": member.name,
            "roll_no": member.roll_no,
            "field": log.field_name,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "description": log.description,
            "timestamp": log.timestamp.isoformat()
        }
        for log, member in changes
    ]


# ----------------- Sync & Scheduler Controls -----------------
@app.post("/api/sync/refresh")
def refresh_now(captain = Depends(get_current_captain)):
    """Manual sync trigger for captain"""
    scheduler.trigger_immediate_sync()
    return {"status": "triggered", "message": "Manual sync initiated"}

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


# ----------------- Export CSV -----------------
@app.get("/api/export/csv")
def export_csv(
    db: Session = Depends(get_db),
    captain = Depends(get_current_captain)
):
    output = io.StringIO()
    writer = csv.writer(output)

    # Header row
    writer.writerow([
        "Roll Number",
        "Student Name",
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

    members = db.query(models.Member).filter(models.Member.is_active == True).all()
    for m in members:
        snap = (
            db.query(models.Snapshot)
            .filter(models.Snapshot.member_id == m.id)
            .order_by(models.Snapshot.timestamp.desc())
            .first()
        )
        if snap:
            writer.writerow([
                m.roll_no,
                m.name,
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
                m.roll_no,
                m.name,
                "", "", "", "0.00", "0.00", "0.00", "0.00", 0, "", "pending"
            ])

    output.seek(0)
    filename = f"team_reward_tracker_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


# ----------------- Live Server-Sent Events (SSE) -----------------
@app.get("/api/events")
async def events_endpoint():
    """
    SSE stream yielding live update events for changed snapshots,
    new alerts, and sync statuses.
    """
    queue = event_manager.subscribe()

    async def event_generator():
        # Send initial connected greeting
        yield f"event: connected\ndata: {json.dumps({'message': 'Connected to live stream'})}\n\n"
        try:
            while True:
                try:
                    # Wait for next event or send heartbeat every 15 seconds
                    message = await asyncio.wait_for(queue.get(), timeout=15.0)
                    yield message
                except asyncio.TimeoutError:
                    # Heartbeat comment to keep connection active
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
