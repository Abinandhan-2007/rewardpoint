import re
import json
from datetime import datetime
from typing import Dict, Any, List, Optional

def generate_semester_timeline(snapshot) -> Dict[str, Any]:
    """
    Extract whole-semester points progression timeline from snapshot's
    activities, carry-over points, and redemption records.
    """
    if not snapshot:
        return {
            "initial_points": 0.0,
            "semester_earned": 0.0,
            "redeemed_points": 0.0,
            "current_balance": 0.0,
            "timeline": []
        }

    breakdown = {}
    activities = []
    try:
        if snapshot.breakdown_json:
            breakdown = json.loads(snapshot.breakdown_json)
        if snapshot.activities_json:
            activities = json.loads(snapshot.activities_json)
    except Exception:
        pass

    # 1. Initial Carry-Over Points
    carry_over = 0.0
    if "INITIAL POINTS / CARRY-OVER" in breakdown:
        try:
            carry_over = float(breakdown["INITIAL POINTS / CARRY-OVER"].get("points", 0.0))
        except (ValueError, TypeError):
            carry_over = 0.0

    redeemed = snapshot.redeemed_points or 0.0
    current_balance = snapshot.balance_points or 0.0
    total_cumulative = snapshot.cumulative_points or (carry_over + sum(float(a.get("points", 0)) for a in activities))

    timeline: List[Dict[str, Any]] = []

    # Point 0: Semester Start (Carry Over)
    timeline.append({
        "step": 0,
        "label": "Semester Start (Carry-Over)",
        "short_title": "Carry-Over",
        "date_str": "Sem Start",
        "date_sort": "2026-05-01",
        "points_added": carry_over,
        "cumulative_points": carry_over,
        "balance_estimate": carry_over,
        "type": "Carry-Over",
        "description": f"Carried over from previous semester: {carry_over:.2f} pts"
    })

    running_cumul = carry_over
    parsed_activities = []

    # Sort activities by date if possible
    for idx, act in enumerate(activities, 1):
        desc = act.get("description", "")
        pts = float(act.get("points", 0.0))
        act_type = act.get("type", "Activity")

        # Extract dates like (20/06/2026 - 25/06/2026) or (11/07/2026)
        dates = re.findall(r"(\d{2})/(\d{2})/(\d{4})", desc)
        if dates:
            day, month, year = dates[-1]  # Take completion date
            date_sort = f"{year}-{month}-{day}"
            try:
                date_obj = datetime.strptime(date_sort, "%Y-%m-%d")
                date_str = date_obj.strftime("%b %d")
            except Exception:
                date_str = f"{day}/{month}"
        else:
            # Fallback date estimation
            lower_desc = desc.lower()
            if "august" in lower_desc:
                date_sort = "2026-08-20"
                date_str = "Aug 20"
            elif "july" in lower_desc:
                date_sort = "2026-07-20"
                date_str = "Jul 20"
            elif "september" in lower_desc:
                date_sort = "2026-09-05"
                date_str = "Sep 05"
            elif "june" in lower_desc:
                date_sort = "2026-06-20"
                date_str = "Jun 20"
            elif "may" in lower_desc:
                date_sort = "2026-05-25"
                date_str = "May 25"
            else:
                date_sort = f"2026-08-{min(idx+5, 28):02d}"
                date_str = f"Event #{idx}"

        # Clean short title
        clean_title = desc.split(" - (")[0].strip()
        if len(clean_title) > 28:
            clean_title = clean_title[:25] + "..."

        parsed_activities.append({
            "index": idx,
            "label": f"{act_type}: {clean_title}",
            "short_title": clean_title,
            "full_description": desc,
            "date_str": date_str,
            "date_sort": date_sort,
            "points_added": pts,
            "type": act_type
        })

    # Sort parsed activities chronologically by date
    parsed_activities.sort(key=lambda x: x["date_sort"])

    # Compute running cumulative and balance progression
    for idx, act in enumerate(parsed_activities, 1):
        running_cumul += act["points_added"]
        # Running balance estimate (accounting for when redemption occurred, usually around late August/September)
        timeline.append({
            "step": idx,
            "label": act["label"],
            "short_title": act["short_title"],
            "full_description": act["full_description"],
            "date_str": act["date_str"],
            "date_sort": act["date_sort"],
            "points_added": act["points_added"],
            "cumulative_points": running_cumul,
            "type": act["type"],
            "description": f"+{act['points_added']:.0f} pts from {act['short_title']} ({act['date_str']})"
        })

    # Final Point: Current Standing
    semester_earned = running_cumul - carry_over
    timeline.append({
        "step": len(timeline),
        "label": "Current Standing (Balance)",
        "short_title": "Current Standing",
        "date_str": "Current",
        "date_sort": "2026-09-30",
        "points_added": 0,
        "cumulative_points": total_cumulative,
        "balance_estimate": current_balance,
        "type": "Standing",
        "description": f"Cumulative: {total_cumulative:.0f} pts | Redeemed: -{redeemed:.0f} pts | Balance: {current_balance:.0f} pts"
    })

    return {
        "initial_points": carry_over,
        "semester_earned": semester_earned,
        "redeemed_points": redeemed,
        "current_balance": current_balance,
        "total_cumulative": total_cumulative,
        "activities_count": len(activities),
        "timeline": timeline
    }
