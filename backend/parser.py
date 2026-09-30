import re
from typing import Dict, Any, List, Optional

def clean_num(val_str: str) -> float:
    """Helper to cleanly parse float from string with commas, dashes, etc."""
    if not val_str:
        return 0.0
    val_str = str(val_str).replace(",", "").strip()
    if val_str in ["-", "", "N/A", "None", "null"]:
        return 0.0
    try:
        return float(val_str)
    except (ValueError, TypeError):
        return 0.0

def parse_student_details(text: str) -> Dict[str, Any]:
    """
    Robust parser for /search_student plain text output.
    Extracts student info, reward points (balance, cumulative, redeemed),
    activities, breakdown, and year-specific comparisons.
    Preserves raw text for fallback.
    """
    result: Dict[str, Any] = {
        "status": "success",
        "roll_no": "",
        "student_name": "",
        "year": "",
        "department": "",
        "mentor_name": "",
        "cumulative_points": 0.0,
        "redeemed_points": 0.0,
        "balance_points": 0.0,
        "average_points": None,
        "points_needed_for_average": None,
        "activities": [],
        "breakdown": {},
        "last_updated_raw": "",
        "raw_text": text or "",
        "error_message": None
    }

    if not text or not text.strip():
        result["status"] = "error"
        result["error_message"] = "Empty response received from source"
        return result

    # Check for failure/not found indicators
    if "❌" in text or "not found" in text.lower() or "not available" in text.lower():
        result["status"] = "not_found"
        # Extract first line or clean summary of error
        err_line = text.strip().splitlines()[0]
        result["error_message"] = err_line.replace("❌", "").strip() or "Student not found"
        return result

    # 1. Greeting extraction: "Hello {Name} 👋"
    hello_match = re.search(r"Hello\s+(.+?)\s*👋", text)
    if hello_match:
        result["student_name"] = hello_match.group(1).strip()

    # 2. Key-Value pairs under YOUR DETAILS
    # Matches lines like: "FIELD NAME   : VALUE"
    kv_pattern = re.compile(r"^([A-Z0-9\.\s\-\/\(\)]+?)\s*:\s*(.+)$", re.MULTILINE)
    for match in kv_pattern.finditer(text):
        key = match.group(1).strip().upper()
        val = match.group(2).strip()

        if key in ["ROLL NO.", "ROLL NO", "ROLL NUMBER", "ROLL_NO"]:
            result["roll_no"] = val
        elif key in ["STUDENT NAME", "NAME", "STUDENT_NAME"]:
            # Prefer this over greeting if available
            result["student_name"] = val
        elif key == "YEAR":
            result["year"] = val
        elif key in ["DEPARTMENT", "DEPT"]:
            result["department"] = val
        elif key in ["MENTOR NAME", "MENTOR"]:
            result["mentor_name"] = val
        elif "CUMULATIVE" in key and "POINTS" in key:
            result["cumulative_points"] = clean_num(val)
        elif ("REEDEMED" in key or "REDEEMED" in key) and "POINTS" in key:
            result["redeemed_points"] = clean_num(val)
        elif "BALANCE" in key and "POINTS" in key:
            result["balance_points"] = clean_num(val)

    # 3. Average points for year section
    # e.g.: Average Points for Year IV      : 710
    avg_match = re.search(r"Average Points for Year[^\:]*:\s*([\d\.,]+)", text, re.IGNORECASE)
    if avg_match:
        result["average_points"] = clean_num(avg_match.group(1))

    # 4. Points needed to reach average / points above
    needed_match = re.search(r"POINTS NEEDED TO REACH AVERAGE:\s*([\d\.,]+)", text, re.IGNORECASE)
    if needed_match:
        result["points_needed_for_average"] = clean_num(needed_match.group(1))

    # 5. Parse Detailed Activity List
    # e.g.:
    #  1. P SKILL: OOPS - (CSE - Core concept) Level 1 - (25/05/2026 - 12/06/2026) - 100.00 pts
    activity_section = re.search(r"📋 DETAILED ACTIVITY LIST\s*={10,}(.*?)(?:={10,}|🎯|$)", text, re.DOTALL)
    if activity_section:
        activity_lines = activity_section.group(1).strip().splitlines()
        for line in activity_lines:
            line = line.strip()
            # 1. Type: Description - 100.00 pts
            act_match = re.match(r"^(\d+)\.\s*(?:([^:]+):\s*)?(.*?)\s*-\s*([\d\.,]+)\s*pts", line)
            if act_match:
                result["activities"].append({
                    "index": int(act_match.group(1)),
                    "type": (act_match.group(2) or "Activity").strip(),
                    "description": act_match.group(3).strip(),
                    "points": clean_num(act_match.group(4))
                })

    # 6. Parse Reward Points Breakdown
    # e.g.:
    # 📋 **TECHNICAL EVENTS**
    #    Count: 0  |  Points: 0.00
    breakdown_section = re.search(r"🏆 REWARD POINTS BREAKDOWN\s*={10,}(.*?)(?:={10,}|LAST UPDATE|$)", text, re.DOTALL)
    if breakdown_section:
        bd_text = breakdown_section.group(1)
        cat_matches = re.finditer(r"📋\s*\*\*([^*]+)\*\*\s*\n\s*Count:\s*([^\s|]+)\s*\|\s*Points:\s*([\d\.,\-]+)", bd_text)
        for cm in cat_matches:
            category = cm.group(1).strip()
            count = cm.group(2).strip()
            pts = clean_num(cm.group(3))
            result["breakdown"][category] = {
                "count": count,
                "points": pts
            }

    # 7. Last updated timestamp
    last_up_match = re.search(r"POINTS LAST UPDATED[^\n]*", text, re.IGNORECASE)
    if last_up_match:
        result["last_updated_raw"] = last_up_match.group(0).strip()

    return result


def parse_subjects_and_marks(text: str) -> Dict[str, Any]:
    """
    Robust parser for /extract_subjects_and_marks_for_gradio plain text output.
    Extracts individual subjects (Theory & Lab), IP-1 & IP-2 points/marks,
    and overall totals.
    Preserves raw text for fallback.
    """
    result: Dict[str, Any] = {
        "status": "success",
        "subjects": [],
        "total_reward_points": 0.0,
        "total_internal_marks": 0.0,
        "total_subjects": 0,
        "raw_text": text or "",
        "error_message": None
    }

    if not text or not text.strip():
        result["status"] = "error"
        result["error_message"] = "Empty response received from source"
        return result

    if "❌" in text or "not found" in text.lower() or "not available" in text.lower():
        result["status"] = "not_found"
        err_line = text.strip().splitlines()[0]
        result["error_message"] = err_line.replace("❌", "").strip() or "Subject details not found"
        return result

    lines = text.splitlines()
    current_subject: Optional[Dict[str, Any]] = None
    current_type = "theory"

    for line in lines:
        line_clean = line.strip()
        if "THEORY SUBJECTS" in line_clean.upper():
            current_type = "theory"
        elif "LAB SUBJECTS" in line_clean.upper():
            current_type = "lab"
        elif line_clean.startswith("🔹"):
            if current_subject:
                result["subjects"].append(current_subject)
            sub_code = line_clean.replace("🔹", "").strip()
            current_subject = {
                "code": sub_code,
                "type": current_type,
                "ip1_points": 0.0,
                "ip2_points": 0.0,
                "total_points": 0.0,
                "ip1_marks": 0.0,
                "ip2_marks": 0.0,
                "total_marks": 0.0
            }
        elif current_subject and "Reward Points:" in line_clean:
            ip1_m = re.search(r"IP-1:\s*([\d\.,]+)", line_clean)
            if ip1_m:
                current_subject["ip1_points"] = clean_num(ip1_m.group(1))
            ip2_m = re.search(r"IP-2:\s*([\d\.,]+)", line_clean)
            if ip2_m:
                current_subject["ip2_points"] = clean_num(ip2_m.group(1))
            tot_m = re.search(r"Total:\s*([\d\.,]+)", line_clean)
            if tot_m:
                current_subject["total_points"] = clean_num(tot_m.group(1))
            else:
                current_subject["total_points"] = current_subject["ip1_points"] + current_subject["ip2_points"]
        elif current_subject and "Internal Marks:" in line_clean:
            ip1_m = re.search(r"IP-1:\s*([\d\.,]+)", line_clean)
            if ip1_m:
                current_subject["ip1_marks"] = clean_num(ip1_m.group(1))
            ip2_m = re.search(r"IP-2:\s*([\d\.,]+)", line_clean)
            if ip2_m:
                current_subject["ip2_marks"] = clean_num(ip2_m.group(1))
            tot_m = re.search(r"Total:\s*([\d\.,]+)", line_clean)
            if tot_m:
                current_subject["total_marks"] = clean_num(tot_m.group(1))
            else:
                current_subject["total_marks"] = current_subject["ip1_marks"] + current_subject["ip2_marks"]

    if current_subject:
        result["subjects"].append(current_subject)

    # Parse Totals from OVERALL SUMMARY section
    pts_tot = re.search(r"TOTAL REWARD POINTS:\s*([\d\.,]+)", text, re.IGNORECASE)
    if pts_tot:
        result["total_reward_points"] = clean_num(pts_tot.group(1))
    elif result["subjects"]:
        result["total_reward_points"] = sum(s["total_points"] for s in result["subjects"])

    marks_tot = re.search(r"TOTAL INTERNAL MARKS:\s*([\d\.,]+)", text, re.IGNORECASE)
    if marks_tot:
        result["total_internal_marks"] = clean_num(marks_tot.group(1))
    elif result["subjects"]:
        result["total_internal_marks"] = sum(s["total_marks"] for s in result["subjects"])

    subs_tot = re.search(r"TOTAL SUBJECTS:\s*(\d+)", text, re.IGNORECASE)
    if subs_tot:
        result["total_subjects"] = int(subs_tot.group(1))
    else:
        result["total_subjects"] = len(result["subjects"])

    return result
