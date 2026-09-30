import asyncio
import json
import logging
from datetime import datetime
from typing import Optional, Tuple, Dict, Any, List
from sqlalchemy.orm import Session

from gradio_client import Client
from config import GRADIO_SPACE, FETCH_DELAY_SECONDS, MAX_RETRIES
import models
from database import SessionLocal
from parser import parse_student_details, parse_subjects_and_marks
from events import event_manager

logger = logging.getLogger("fetcher")
logging.basicConfig(level=logging.INFO)

class GradioFetcher:
    def __init__(self, space_name: str = GRADIO_SPACE):
        self.space_name = space_name
        self._client: Optional[Client] = None
        self._lock = asyncio.Lock()

    def get_client(self) -> Client:
        if self._client is None:
            logger.info(f"Connecting to Gradio space: {self.space_name}...")
            self._client = Client(self.space_name)
            logger.info("Connected to Gradio space successfully!")
        return self._client

    def _call_predict(self, roll_no: str, api_name: str) -> str:
        """Synchronous wrapper for gradio_client.Client.predict"""
        client = self.get_client()
        result = client.predict(roll_no=roll_no, api_name=api_name)
        return str(result) if result is not None else ""

    async def fetch_endpoint_with_retry(self, roll_no: str, api_name: str) -> Tuple[bool, str]:
        """
        Call Gradio endpoint with exponential backoff up to MAX_RETRIES.
        Returns (success: bool, raw_response_or_error: str)
        """
        delay = 1.0
        last_error = ""

        for attempt in range(1, MAX_RETRIES + 1):
            try:
                # Run synchronous gradio_client in thread pool to not block asyncio event loop
                raw_text = await asyncio.to_thread(self._call_predict, roll_no, api_name)
                return True, raw_text
            except Exception as e:
                last_error = str(e)
                logger.warning(f"Attempt {attempt}/{MAX_RETRIES} failed for roll '{roll_no}' on {api_name}: {last_error}")
                # Reset client on connection errors to force reconnect next time
                if "connect" in last_error.lower() or "timeout" in last_error.lower():
                    self._client = None
                if attempt < MAX_RETRIES:
                    await asyncio.sleep(delay)
                    delay *= 2  # Exponential backoff: 1s, 2s, 4s

        return False, last_error

    async def fetch_member_data(self, roll_no: str) -> Dict[str, Any]:
        """
        Fetch both /search_student and /extract_subjects_and_marks_for_gradio.
        Returns parsed dictionaries along with raw text and fetch statuses.
        """
        roll_no = roll_no.strip().upper()

        # 1. Fetch Student Details
        ok1, raw_student = await self.fetch_endpoint_with_retry(roll_no, "/search_student")
        if ok1:
            parsed_student = parse_student_details(raw_student)
        else:
            parsed_student = {
                "status": "error",
                "error_message": f"Failed after {MAX_RETRIES} attempts: {raw_student}",
                "raw_text": "",
                "roll_no": roll_no,
                "student_name": "",
                "balance_points": 0.0,
                "cumulative_points": 0.0,
                "redeemed_points": 0.0,
                "activities": [],
                "breakdown": {}
            }

        # 2. Fetch Subjects and Marks
        ok2, raw_subjects = await self.fetch_endpoint_with_retry(roll_no, "/extract_subjects_and_marks_for_gradio")
        if ok2:
            parsed_subjects = parse_subjects_and_marks(raw_subjects)
        else:
            parsed_subjects = {
                "status": "error",
                "error_message": f"Failed after {MAX_RETRIES} attempts: {raw_subjects}",
                "raw_text": "",
                "subjects": [],
                "total_reward_points": 0.0,
                "total_internal_marks": 0.0,
                "total_subjects": 0
            }

        return {
            "source_reachable": (ok1 or ok2),
            "parsed_student": parsed_student,
            "parsed_subjects": parsed_subjects,
            "raw_student": raw_student if ok1 else "",
            "raw_subjects": raw_subjects if ok2 else ""
        }

gradio_fetcher = GradioFetcher()


def detect_changes(
    prev_snapshot: Optional[models.Snapshot],
    new_data: Dict[str, Any],
    member: models.Member
) -> List[Dict[str, Any]]:
    """
    Compare previous snapshot with newly parsed data.
    Returns list of change events if differences are found.
    """
    changes: List[Dict[str, Any]] = []
    now = datetime.utcnow()

    student_data = new_data["parsed_student"]
    subjects_data = new_data["parsed_subjects"]

    # If first snapshot, we don't log diffs, but we record the initial snapshot
    if not prev_snapshot:
        return changes

    # Only compare if the new fetch was successful or had data
    if student_data["status"] == "success":
        new_balance = student_data["balance_points"]
        old_balance = prev_snapshot.balance_points
        if abs(new_balance - old_balance) > 0.001:
            diff = new_balance - old_balance
            sign = "+" if diff > 0 else ""
            desc = f"Reward points changed: {old_balance:.2f} → {new_balance:.2f} ({sign}{diff:.2f})"
            changes.append({
                "field_name": "balance_points",
                "old_value": f"{old_balance:.2f}",
                "new_value": f"{new_balance:.2f}",
                "description": desc,
                "timestamp": now
            })

        new_cumul = student_data["cumulative_points"]
        old_cumul = prev_snapshot.cumulative_points
        if abs(new_cumul - old_cumul) > 0.001:
            diff = new_cumul - old_cumul
            sign = "+" if diff > 0 else ""
            desc = f"Cumulative points changed: {old_cumul:.2f} → {new_cumul:.2f} ({sign}{diff:.2f})"
            changes.append({
                "field_name": "cumulative_points",
                "old_value": f"{old_cumul:.2f}",
                "new_value": f"{new_cumul:.2f}",
                "description": desc,
                "timestamp": now
            })

        new_redeemed = student_data["redeemed_points"]
        old_redeemed = prev_snapshot.redeemed_points
        if abs(new_redeemed - old_redeemed) > 0.001:
            desc = f"Redeemed points updated: {old_redeemed:.2f} → {new_redeemed:.2f}"
            changes.append({
                "field_name": "redeemed_points",
                "old_value": f"{old_redeemed:.2f}",
                "new_value": f"{new_redeemed:.2f}",
                "description": desc,
                "timestamp": now
            })

    if subjects_data["status"] == "success":
        new_marks = subjects_data["total_internal_marks"]
        old_marks = prev_snapshot.total_marks
        if abs(new_marks - old_marks) > 0.001:
            diff = new_marks - old_marks
            sign = "+" if diff > 0 else ""
            desc = f"Internal marks changed: {old_marks:.2f} → {new_marks:.2f} ({sign}{diff:.2f})"
            changes.append({
                "field_name": "total_marks",
                "old_value": f"{old_marks:.2f}",
                "new_value": f"{new_marks:.2f}",
                "description": desc,
                "timestamp": now
            })

        new_subj_count = subjects_data["total_subjects"]
        old_subj_count = prev_snapshot.total_subjects
        if new_subj_count != old_subj_count:
            desc = f"Subjects count changed: {old_subj_count} → {new_subj_count}"
            changes.append({
                "field_name": "subjects_count",
                "old_value": str(old_subj_count),
                "new_value": str(new_subj_count),
                "description": desc,
                "timestamp": now
            })

    return changes


async def process_member_snapshot(
    db: Session,
    member: models.Member,
    fetched_data: Dict[str, Any]
) -> models.Snapshot:
    """
    Save new snapshot, compare changes, write change logs, and push live SSE updates.
    """
    student_data = fetched_data["parsed_student"]
    subjects_data = fetched_data["parsed_subjects"]
    now = datetime.utcnow()

    # Get most recent snapshot
    prev_snapshot = (
        db.query(models.Snapshot)
        .filter(models.Snapshot.member_id == member.id)
        .order_by(models.Snapshot.timestamp.desc())
        .first()
    )

    # Detect differences
    change_items = detect_changes(prev_snapshot, fetched_data, member)

    # Create new snapshot record
    fetch_status = "success"
    error_msg = None
    if student_data["status"] != "success":
        fetch_status = student_data["status"]
        error_msg = student_data.get("error_message")
    elif subjects_data["status"] != "success":
        fetch_status = "partial"
        error_msg = subjects_data.get("error_message")

    # Update member name if fetched from Gradio
    fetched_name = (student_data.get("student_name") or "").strip()
    if fetched_name and fetched_name != "Unknown":
        member_name_clean = (member.name or "").strip().upper()
        roll_clean = (member.roll_no or "").strip().upper()
        if member_name_clean == roll_clean or not member.name:
            member.name = fetched_name
            member.updated_at = now

    new_snapshot = models.Snapshot(
        member_id=member.id,
        timestamp=now,
        balance_points=student_data.get("balance_points", 0.0),
        cumulative_points=student_data.get("cumulative_points", 0.0),
        redeemed_points=student_data.get("redeemed_points", 0.0),
        total_marks=subjects_data.get("total_internal_marks", 0.0),
        total_subjects=subjects_data.get("total_subjects", 0),
        year=student_data.get("year"),
        department=student_data.get("department"),
        mentor_name=student_data.get("mentor_name"),
        average_points=student_data.get("average_points"),
        points_needed=student_data.get("points_needed_for_average"),
        subjects_json=json.dumps(subjects_data.get("subjects", [])),
        activities_json=json.dumps(student_data.get("activities", [])),
        breakdown_json=json.dumps(student_data.get("breakdown", {})),
        raw_student_text=fetched_data.get("raw_student"),
        raw_subjects_text=fetched_data.get("raw_subjects"),
        fetch_status=fetch_status,
        error_message=error_msg
    )
    db.add(new_snapshot)

    # Save change logs
    saved_changes = []
    for ch in change_items:
        log_entry = models.ChangeLog(
            member_id=member.id,
            timestamp=ch["timestamp"],
            field_name=ch["field_name"],
            old_value=ch["old_value"],
            new_value=ch["new_value"],
            description=ch["description"]
        )
        db.add(log_entry)
        saved_changes.append(ch)

    db.commit()
    db.refresh(new_snapshot)

    # Broadcast live SSE notifications
    member_summary = {
        "id": member.id,
        "roll_no": member.roll_no,
        "name": member.name,
        "balance_points": new_snapshot.balance_points,
        "cumulative_points": new_snapshot.cumulative_points,
        "redeemed_points": new_snapshot.redeemed_points,
        "total_marks": new_snapshot.total_marks,
        "total_subjects": new_snapshot.total_subjects,
        "year": new_snapshot.year,
        "department": new_snapshot.department,
        "mentor_name": new_snapshot.mentor_name,
        "last_updated": new_snapshot.timestamp.isoformat(),
        "fetch_status": new_snapshot.fetch_status,
        "has_recent_change": len(saved_changes) > 0
    }

    # Broadcast member update
    await event_manager.broadcast("member_updated", member_summary)

    # If any changes were detected, broadcast change alert
    for ch in saved_changes:
        await event_manager.broadcast("change_alert", {
            "member_id": member.id,
            "member_name": member.name,
            "roll_no": member.roll_no,
            "field": ch["field_name"],
            "old_value": ch["old_value"],
            "new_value": ch["new_value"],
            "description": ch["description"],
            "timestamp": ch["timestamp"].isoformat()
        })

    return new_snapshot


_sync_lock = asyncio.Lock()

async def sync_all_members():
    """
    Fetch all active members sequentially with 0.5s delay between calls.
    Updates sync status and broadcasts live events.
    Guarded by lock to prevent concurrent runs.
    """
    if _sync_lock.locked():
        logger.info("Sync already in progress, skipping concurrent run.")
        return

    async with _sync_lock:
        await _do_sync_all_members()

async def _do_sync_all_members():
    db = SessionLocal()
    try:

        status_row = db.query(models.SyncStatus).filter_by(id=1).first()
        if not status_row:
            status_row = models.SyncStatus(id=1)
            db.add(status_row)

        status_row.status = "running"
        status_row.last_sync_start = datetime.utcnow()
        status_row.last_error = None
        db.commit()

        await event_manager.broadcast("sync_status", {
            "status": "running",
            "last_sync_start": status_row.last_sync_start.isoformat(),
            "source_reachable": status_row.source_reachable
        })

        members = db.query(models.Member).filter(models.Member.is_active == True).all()
        logger.info(f"Starting sync for {len(members)} team members...")

        overall_reachable = True
        failed_count = 0

        for member in members:
            try:
                fetched = await gradio_fetcher.fetch_member_data(member.roll_no)
                if not fetched["source_reachable"]:
                    overall_reachable = False
                    failed_count += 1
                
                await process_member_snapshot(db, member, fetched)
            except Exception as e:
                logger.error(f"Error processing member {member.roll_no}: {e}")
                failed_count += 1

            # Respect the 0.5s delay between members to avoid overloading the source server
            await asyncio.sleep(FETCH_DELAY_SECONDS)

        status_row.status = "success" if failed_count == 0 else ("partial" if failed_count < len(members) else "error")
        status_row.last_sync_finish = datetime.utcnow()
        status_row.source_reachable = overall_reachable
        if failed_count == len(members) and len(members) > 0:
            status_row.last_error = "All member queries failed or source unreachable"
        db.commit()

        await event_manager.broadcast("sync_status", {
            "status": status_row.status,
            "last_sync_finish": status_row.last_sync_finish.isoformat(),
            "source_reachable": status_row.source_reachable,
            "last_error": status_row.last_error
        })
        logger.info("Sync finished successfully!")

    except Exception as e:
        logger.error(f"Fatal error in sync_all_members: {e}")
        status_row = db.query(models.SyncStatus).filter_by(id=1).first()
        if status_row:
            status_row.status = "error"
            status_row.last_error = str(e)
            status_row.source_reachable = False
            status_row.last_sync_finish = datetime.utcnow()
            db.commit()

        await event_manager.broadcast("sync_status", {
            "status": "error",
            "source_reachable": False,
            "last_error": str(e)
        })
    finally:
        db.close()
