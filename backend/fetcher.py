import asyncio
import json
import logging
from datetime import datetime
from collections import defaultdict
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from gradio_client import Client
from config import GRADIO_SPACE, FETCH_DELAY_SECONDS, MAX_RETRIES
from database import SessionLocal
import models
from parser import parse_student_details, parse_subjects_and_marks
from events import event_manager

logger = logging.getLogger("fetcher")

class GradioFetcher:
    def __init__(self, space_name: str = GRADIO_SPACE):
        self.space_name = space_name
        self.client: Optional[Client] = None
        self._lock = asyncio.Lock()

    async def _get_client(self) -> Client:
        async with self._lock:
            if self.client is None:
                logger.info(f"Connecting to Gradio space: {self.space_name}...")
                self.client = await asyncio.to_thread(Client, self.space_name)
                logger.info("Connected to Gradio space successfully!")
            return self.client

    async def _predict_with_retry(self, fn_name: str, *args) -> Tuple[bool, str]:
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                client = await self._get_client()
                result = await asyncio.to_thread(
                    client.predict,
                    *args,
                    api_name=fn_name
                )
                return True, str(result)
            except Exception as e:
                logger.warning(f"Attempt {attempt}/{MAX_RETRIES} failed for {fn_name}: {e}")
                if attempt == MAX_RETRIES:
                    return False, f"Failed after {MAX_RETRIES} attempts: {str(e)}"
                await asyncio.sleep(0.5 * (2 ** (attempt - 1)))
        return False, "Unknown error during prediction"

    async def fetch_member_data(self, roll_no: str) -> Dict[str, Any]:
        """
        Fetch both /search_student and /extract_subjects_and_marks_for_gradio
        for a given roll number.
        """
        roll_no = roll_no.strip().upper()
        ok1, raw_student = await self._predict_with_retry("/search_student", roll_no)
        ok2, raw_subjects = await self._predict_with_retry("/extract_subjects_and_marks_for_gradio", roll_no)

        if ok1:
            parsed_student = parse_student_details(raw_student)
        else:
            parsed_student = {
                "status": "error",
                "roll_no": roll_no,
                "error_message": raw_student,
                "balance_points": 0.0,
                "cumulative_points": 0.0,
                "redeemed_points": 0.0,
                "activities": [],
                "breakdown": {}
            }

        if ok2:
            parsed_subjects = parse_subjects_and_marks(raw_subjects)
        else:
            parsed_subjects = {
                "status": "error",
                "error_message": raw_subjects,
                "total_internal_marks": 0.0,
                "total_subjects": 0,
                "subjects": []
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
    user: models.User
) -> List[Dict[str, Any]]:
    """
    Compare new data against previous snapshot and generate change log entries.
    """
    if not prev_snapshot:
        return []

    changes = []
    now = datetime.utcnow()
    student_data = new_data["parsed_student"]
    subjects_data = new_data["parsed_subjects"]

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

    return changes


async def process_user_snapshot(
    db: Session,
    user: models.User,
    fetched_data: Dict[str, Any]
) -> models.Snapshot:
    """
    Save new snapshot, compare changes, write change logs, and push live SSE updates
    strictly isolated to this user's team.
    """
    student_data = fetched_data["parsed_student"]
    subjects_data = fetched_data["parsed_subjects"]
    now = datetime.utcnow()

    # Get most recent snapshot for this user
    prev_snapshot = (
        db.query(models.Snapshot)
        .filter(models.Snapshot.user_id == user.id)
        .order_by(models.Snapshot.timestamp.desc())
        .first()
    )

    change_items = detect_changes(prev_snapshot, fetched_data, user)

    fetch_status = "success"
    error_msg = None
    if student_data["status"] != "success":
        fetch_status = student_data["status"]
        error_msg = student_data.get("error_message")
    elif subjects_data["status"] != "success":
        fetch_status = "partial"
        error_msg = subjects_data.get("error_message")

    # Auto-update user's name if fetched from student details and not custom-renamed
    if student_data.get("student_name") and student_data["student_name"].strip() not in ("Unknown", "N/A", ""):
        user.name = student_data["student_name"].strip()
        user.updated_at = now

    new_snapshot = models.Snapshot(
        team_id=user.team_id,
        user_id=user.id,
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

    saved_changes = []
    for ch in change_items:
        log_entry = models.ChangeLog(
            team_id=user.team_id,
            user_id=user.id,
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

    # Broadcast live SSE update ONLY to members of the same team
    member_summary = {
        "id": user.id,
        "team_id": user.team_id,
        "roll_no": user.roll_no,
        "name": user.name,
        "role": user.role,
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

    await event_manager.broadcast("member_updated", member_summary, team_id=user.team_id)

    for ch in saved_changes:
        await event_manager.broadcast("change_alert", {
            "user_id": user.id,
            "team_id": user.team_id,
            "member_name": user.name,
            "roll_no": user.roll_no,
            "field": ch["field_name"],
            "old_value": ch["old_value"],
            "new_value": ch["new_value"],
            "description": ch["description"],
            "timestamp": ch["timestamp"].isoformat()
        }, team_id=user.team_id)

    return new_snapshot


async def sync_all_members():
    """
    Fetch data from Gradio Space for every member of every team.
    Fetch one roll number at a time with a 0.5s delay.
    If the same roll number appears in several teams, fetch it ONCE per cycle
    and share the result across all matching users.
    """
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

        all_users = db.query(models.User).all()
        logger.info(f"Starting sync cycle for {len(all_users)} total users...")

        # Group users by distinct roll number to avoid redundant calls
        roll_to_users: Dict[str, List[models.User]] = defaultdict(list)
        for u in all_users:
            roll_to_users[u.roll_no.strip().upper()].append(u)

        logger.info(f"Unique roll numbers across all teams: {len(roll_to_users)}")

        overall_reachable = True
        failed_count = 0

        for roll_no, users_list in roll_to_users.items():
            try:
                # Fetch once for this roll number
                fetched = await gradio_fetcher.fetch_member_data(roll_no)
                if not fetched["source_reachable"]:
                    overall_reachable = False
                    failed_count += 1

                # Share the result across all users having this roll number
                for user in users_list:
                    try:
                        await process_user_snapshot(db, user, fetched)
                    except Exception as ue:
                        logger.error(f"Error processing user {user.id} ({roll_no}): {ue}")

            except Exception as e:
                logger.error(f"Error fetching roll_no {roll_no}: {e}")
                failed_count += 1

            # Polite delay between external Gradio calls
            await asyncio.sleep(FETCH_DELAY_SECONDS)

        total_rolls = len(roll_to_users)
        status_row.status = "success" if failed_count == 0 else ("partial" if failed_count < total_rolls else "error")
        status_row.last_sync_finish = datetime.utcnow()
        status_row.source_reachable = overall_reachable
        if failed_count == total_rolls and total_rolls > 0:
            status_row.last_error = "All student queries failed or Gradio Space unreachable"
        db.commit()

        await event_manager.broadcast("sync_status", {
            "status": status_row.status,
            "last_sync_finish": status_row.last_sync_finish.isoformat(),
            "source_reachable": status_row.source_reachable,
            "last_error": status_row.last_error
        })
        logger.info("Sync cycle completed.")

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
