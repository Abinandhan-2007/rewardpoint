import pytest
from fastapi.testclient import TestClient
from main import app
from database import SessionLocal, init_db
import models

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    init_db()
    yield

def test_captain_signup_and_team_generation():
    signup_data = {
        "captain_name": "Captain Steve",
        "roll_no": "7376TEST01",
        "password": "pass-steve-123",
        "team_name": "Avengers Squad"
    }
    res = client.post("/api/auth/signup", json=signup_data)
    assert res.status_code == 200
    data = res.json()
    assert "token" in data
    assert data["role"] == "captain"
    assert data["team"]["name"] == "Avengers Squad"
    assert data["team"]["team_id"].startswith("TEAM-")
    assert data["user"]["roll_no"] == "7376TEST01"

def test_login_flow():
    # Login with seeded captain
    res = client.post("/api/auth/login", json={
        "team_id": "TEAM-ALPHA",
        "roll_no": "7376241CS280",
        "password": "captain2026"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["role"] == "captain"
    assert "token" in data

    # Login with seeded member
    res_m = client.post("/api/auth/login", json={
        "team_id": "TEAM-ALPHA",
        "roll_no": "7376231CS101",
        "password": "member123"
    })
    assert res_m.status_code == 200
    assert res_m.json()["role"] == "member"

def test_invalid_login_credentials():
    res = client.post("/api/auth/login", json={
        "team_id": "TEAM-ALPHA",
        "roll_no": "7376241CS280",
        "password": "wrong-password-here"
    })
    assert res.status_code == 401

    res2 = client.post("/api/auth/login", json={
        "team_id": "TEAM-DOES-NOT-EXIST",
        "roll_no": "7376241CS280",
        "password": "captain2026"
    })
    assert res2.status_code == 401

def test_member_cannot_access_captain_routes():
    # 1. Login as Member
    res_m = client.post("/api/auth/login", json={
        "team_id": "TEAM-ALPHA",
        "roll_no": "7376231CS101",
        "password": "member123"
    })
    member_token = res_m.json()["token"]
    headers = {"Authorization": f"Bearer {member_token}"}

    # Member cannot view captain team members list
    res = client.get("/api/team/members", headers=headers)
    assert res.status_code == 403
    assert "Captain privileges required" in res.json()["detail"]

    # Member cannot add a member
    res = client.post("/api/team/members", json={"roll_no": "7376999CS999"}, headers=headers)
    assert res.status_code == 403

    # Member cannot delete a member
    res = client.delete("/api/team/members/3", headers=headers)
    assert res.status_code == 403

    # Member cannot reset another member's password
    res = client.post("/api/team/members/3/reset-password", json={}, headers=headers)
    assert res.status_code == 403

    # Member cannot export team CSV
    res = client.get("/api/team/export/csv", headers=headers)
    assert res.status_code == 403

    # Member cannot refresh team
    res = client.post("/api/team/refresh", headers=headers)
    assert res.status_code == 403

    # BUT Member CAN view their own details and team summary
    res_self = client.get("/api/member/me", headers=headers)
    assert res_self.status_code == 200
    assert res_self.json()["user"]["roll_no"] == "7376231CS101"

    res_summary = client.get("/api/team/summary", headers=headers)
    assert res_summary.status_code == 200
    assert "leaderboard" in res_summary.json()
    assert res_summary.json()["team_id"] == "TEAM-ALPHA"

def test_cross_team_data_isolation():
    # 1. Create Team Blue with Captain Blue
    res_blue = client.post("/api/auth/signup", json={
        "captain_name": "Captain Blue",
        "roll_no": "7376BLUE01",
        "password": "pass-blue-123",
        "team_name": "Team Blue"
    })
    token_blue = res_blue.json()["token"]
    headers_blue = {"Authorization": f"Bearer {token_blue}"}

    # Captain Blue adds a member to Team Blue
    add_m = client.post("/api/team/members", json={"roll_no": "7376BLUE02", "name": "Blue Cadet"}, headers=headers_blue)
    assert add_m.status_code == 200
    blue_cadet_id = add_m.json()["id"]

    # 2. Create Team Red with Captain Red
    res_red = client.post("/api/auth/signup", json={
        "captain_name": "Captain Red",
        "roll_no": "7376RED01",
        "password": "pass-red-123",
        "team_name": "Team Red"
    })
    token_red = res_red.json()["token"]
    headers_red = {"Authorization": f"Bearer {token_red}"}

    # 3. Captain Red tries to view Blue Cadet's details -> 404 (Not found in your team)
    res_cross_view = client.get(f"/api/team/members/{blue_cadet_id}/details", headers=headers_red)
    assert res_cross_view.status_code == 404

    # 4. Captain Red tries to delete Blue Cadet -> 404
    res_cross_del = client.delete(f"/api/team/members/{blue_cadet_id}", headers=headers_red)
    assert res_cross_del.status_code == 404

    # 5. Captain Red tries to reset Blue Cadet's password -> 404
    res_cross_reset = client.post(f"/api/team/members/{blue_cadet_id}/reset-password", json={}, headers=headers_red)
    assert res_cross_reset.status_code == 404

    # 6. Captain Red's members list should NOT contain any Team Blue members
    res_red_members = client.get("/api/team/members", headers=headers_red)
    assert res_red_members.status_code == 200
    red_rolls = [m["roll_no"] for m in res_red_members.json()]
    assert "7376RED01" in red_rolls
    assert "7376BLUE01" not in red_rolls
    assert "7376BLUE02" not in red_rolls

def test_change_password_route():
    # Dedicated signup for password change test
    res_t = client.post("/api/auth/signup", json={
        "captain_name": "Pass Tester",
        "roll_no": "7376PASSCAP",
        "password": "initialpassword123",
        "team_name": "Password Team"
    })
    token = res_t.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    team_code = res_t.json()["team"]["team_id"]

    # Change password
    res_ch = client.post("/api/auth/change-password", json={
        "current_password": "initialpassword123",
        "new_password": "newpassword456"
    }, headers=headers)
    assert res_ch.status_code == 200

    # Old password fails
    res_old = client.post("/api/auth/login", json={
        "team_id": team_code,
        "roll_no": "7376PASSCAP",
        "password": "initialpassword123"
    })
    assert res_old.status_code == 401

    # New password succeeds
    res_new = client.post("/api/auth/login", json={
        "team_id": team_code,
        "roll_no": "7376PASSCAP",
        "password": "newpassword456"
    })
    assert res_new.status_code == 200

def test_login_rate_limiting():
    # 5 failed attempts triggers 429 Too Many Requests
    test_roll = "7376RATELIMIT"
    for _ in range(5):
        client.post("/api/auth/login", json={
            "team_id": "TEAM-ALPHA",
            "roll_no": test_roll,
            "password": "wrong"
        })
    res_limited = client.post("/api/auth/login", json={
        "team_id": "TEAM-ALPHA",
        "roll_no": test_roll,
        "password": "wrong"
    })
    assert res_limited.status_code == 429
    assert "Too many failed login attempts" in res_limited.json()["detail"]

