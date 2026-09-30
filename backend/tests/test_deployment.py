import os
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch, AsyncMock
import pytest
from fastapi.testclient import TestClient

# Add backend directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import database
import models
from main import app

@pytest.fixture
def client():
    # Patch scheduler so unit tests don't initiate live external network calls
    with patch("main.scheduler.start"), patch("main.scheduler.stop"):
        with TestClient(app) as test_client:
            yield test_client

def test_health_endpoint(client):
    """GET /health must return 200 with status ok for uptime monitoring"""
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}

def test_api_health_endpoint(client):
    """GET /api/health should also return 200"""
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}

def test_api_404_not_masked_by_spa(client):
    """Non-existent /api routes must return 404 JSON, NOT index.html"""
    res = client.get("/api/nonexistent-route-xyz")
    assert res.status_code == 404
    data = res.json()
    assert "detail" in data

def test_spa_root_serves_html(client):
    """Root GET / should serve the React SPA index.html"""
    res = client.get("/")
    assert res.status_code == 200
    assert "text/html" in res.headers.get("content-type", "")

def test_spa_client_side_routing(client):
    """Client-side subroutes should serve index.html for React router"""
    res = client.get("/members/view/7376231CS101")
    assert res.status_code == 200
    assert "text/html" in res.headers.get("content-type", "")

def test_db_path_env_var_and_seeding():
    """Verify that DB_PATH creates the database file in custom path and seeds when empty"""
    with TemporaryDirectory() as tmp_dir:
        custom_db = os.path.join(tmp_dir, "custom_subfolder", "test_tracker.db")
        Path(custom_db).parent.mkdir(parents=True, exist_ok=True)
        os.environ["DB_PATH"] = custom_db
        
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        
        test_engine = create_engine(f"sqlite:///{Path(custom_db).resolve().as_posix()}", connect_args={"check_same_thread": False})
        models.Base.metadata.create_all(bind=test_engine)
        
        Session = sessionmaker(bind=test_engine)
        session = Session()
        
        try:
            database.seed_default_members_if_empty(session)
            members = session.query(models.Member).all()
            assert len(members) >= 5
            roll_numbers = [m.roll_no for m in members]
            assert "7376231CS101" in roll_numbers
            assert "7376241CS106" in roll_numbers
        finally:
            session.close()
            test_engine.dispose()
            del os.environ["DB_PATH"]

