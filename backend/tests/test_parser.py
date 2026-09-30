import pytest
import sys
from pathlib import Path

# Add backend directory to sys.path so parser can be imported
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from parser import parse_student_details, parse_subjects_and_marks, clean_num

SAMPLE_STUDENT_TEXT = """Hello AAMINA A 👋
================================================================================
YOUR DETAILS
================================================================================
ROLL NO.                 : 7376231CS101
STUDENT NAME             : AAMINA A
YEAR                     : IV
DEPARTMENT               : COMPUTER SCIENCE AND ENGINEERING
MENTOR NAME              : Mrs. CHITRADEVI T N CSE
CUMULATIVE REWARD POINTS : 1,845.00
REEDEMED POINTS          : 1,420.00
BALANCE POINTS           : 425.00

================================================================================
AVERAGE REWARD POINTS FOR YEAR IV
================================================================================
Average Points for Year IV      : 710

🎯 POINTS NEEDED TO REACH AVERAGE: 285 points

💡 WAYS TO EARN POINTS:
   • PS Activities
   • TAC
   • Hackathons / Technical Events
   • Project Competitions
   • Refer Reward points Breakdown for more details
📋 DETAILED ACTIVITY LIST
================================================================================
 1. P SKILL: OOPS - (CSE - Core concept) Level 1 - (25/05/2026 - 12/06/2026) - 100.00 pts
 2. P SKILL: DBMS Level 1 - (CSE - core concept) - (13/06/2026 - 19/06/2026) - 100.00 pts
 3. P SKILL: DBMS Level 2 - (CSE - core concept) - (01/08/2026 - 07/08/2026) - 100.00 pts
 4. P SKILL: Database Programming Level - 4 - (15/08/2026 - 21/08/2026) - 400.00 pts
 5. STUDENT INITIATIVES: Company Specific Training - 730.00 pts
 6. P SKILL: IPR-Patent Search - Level 0 - (12/09/2026 - 18/09/2026) - 100.00 pts
 7. STUDENT INITIATIVES: August GP Challenge - Industry Discovery Problems - 300.00 pts
================================================================================
🎯 TOTAL REWARD POINTS FROM ACTIVITIES: 1830.00
================================================================================

🏆 REWARD POINTS BREAKDOWN
================================================================================
📋 **INITIAL POINTS / CARRY-OVER**
   Count: -  |  Points: 15.00
📋 **TECHNICAL EVENTS**
   Count: 0  |  Points: 0.00
📋 **P SKILL**
   Count: 5  |  Points: 800.00
📋 **STUDENT INITIATIVES**
   Count: 2  |  Points: 1030.00
📋 **CUMULATIVE POINTS**
   Count: -  |  Points: 1845.00
📋 **BALANCE POINTS**
   Count: -  |  Points: 425.00
================================================================================

------------------------------------------------------------
LAST UPDATE INFO
------------------------------------------------------------
POINTS LAST UPDATED on Wed Sep 30 2026 00:42:23 GMT+0530 (India Standard Time)

================================================================================
"""

SAMPLE_SUBJECTS_TEXT = """
🏆 INNOVATIVE PRACTICE (IP) SUMMARY
================================================================================

📚 THEORY SUBJECTS (3 subjects)
--------------------------------------------------

🔹 22CS701
   Reward Points: IP-1: 510.00 | Total: 510.00
   Internal Marks: IP-1: 15.00 | Total: 15.00

🔹 22CS702
   Reward Points: IP-1: 510.00 | Total: 510.00
   Internal Marks: IP-1: 15.00 | Total: 15.00

🔹 22CS020
   Reward Points: IP-1: 400.00 | Total: 400.00
   Internal Marks: IP-1: 14.00 | Total: 14.00

================================================================================
📊 OVERALL SUMMARY
================================================================================

🏅 REWARD POINTS BREAKDOWN:
   Theory Subjects: 1420.00 points
     ➤ IP-1: 1420.00

🎯 TOTAL REWARD POINTS: 1420.00

📝 INTERNAL MARKS BREAKDOWN:
   Theory Subjects: 44.00 marks
     ➤ IP-1: 44.00

📊 TOTAL INTERNAL MARKS: 44.00

📚 TOTAL SUBJECTS: 3

================================================================================
"""

SAMPLE_NOT_FOUND_TEXT = "❌ Roll No '7376222AL181' not found in any sheet"

def test_clean_num():
    assert clean_num("1,845.00") == 1845.0
    assert clean_num("0.00") == 0.0
    assert clean_num("-") == 0.0
    assert clean_num("") == 0.0
    assert clean_num(None) == 0.0

def test_parse_student_details_success():
    data = parse_student_details(SAMPLE_STUDENT_TEXT)
    assert data["status"] == "success"
    assert data["roll_no"] == "7376231CS101"
    assert data["student_name"] == "AAMINA A"
    assert data["year"] == "IV"
    assert data["department"] == "COMPUTER SCIENCE AND ENGINEERING"
    assert data["mentor_name"] == "Mrs. CHITRADEVI T N CSE"
    assert data["balance_points"] == 425.0
    assert data["cumulative_points"] == 1845.0
    assert data["redeemed_points"] == 1420.0
    assert data["average_points"] == 710.0
    assert data["points_needed_for_average"] == 285.0
    assert len(data["activities"]) == 7
    assert data["activities"][0]["type"] == "P SKILL"
    assert data["activities"][0]["points"] == 100.0
    assert "INITIAL POINTS / CARRY-OVER" in data["breakdown"]
    assert data["breakdown"]["INITIAL POINTS / CARRY-OVER"]["points"] == 15.0
    assert data["raw_text"] == SAMPLE_STUDENT_TEXT
    assert "POINTS LAST UPDATED" in data["last_updated_raw"]

def test_parse_subjects_and_marks_success():
    data = parse_subjects_and_marks(SAMPLE_SUBJECTS_TEXT)
    assert data["status"] == "success"
    assert len(data["subjects"]) == 3
    assert data["subjects"][0]["code"] == "22CS701"
    assert data["subjects"][0]["type"] == "theory"
    assert data["subjects"][0]["ip1_points"] == 510.0
    assert data["subjects"][0]["total_points"] == 510.0
    assert data["subjects"][0]["ip1_marks"] == 15.0
    assert data["subjects"][0]["total_marks"] == 15.0
    assert data["total_reward_points"] == 1420.0
    assert data["total_internal_marks"] == 44.0
    assert data["total_subjects"] == 3
    assert data["raw_text"] == SAMPLE_SUBJECTS_TEXT

def test_parse_student_not_found():
    data = parse_student_details(SAMPLE_NOT_FOUND_TEXT)
    assert data["status"] == "not_found"
    assert "not found" in data["error_message"].lower()
    assert data["raw_text"] == SAMPLE_NOT_FOUND_TEXT

def test_parse_subjects_empty():
    data = parse_subjects_and_marks("")
    assert data["status"] == "error"
    assert "empty" in data["error_message"].lower()

def test_parse_partial_data():
    minimal_text = """
    ROLL NO. : 12345
    STUDENT NAME : Test Student
    BALANCE POINTS : 50.00
    """
    data = parse_student_details(minimal_text)
    assert data["status"] == "success"
    assert data["roll_no"] == "12345"
    assert data["student_name"] == "Test Student"
    assert data["balance_points"] == 50.0
