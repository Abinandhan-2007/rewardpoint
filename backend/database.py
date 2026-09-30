import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from config import (
    DATABASE_URL,
    ENABLE_SEED,
    SEED_TEAM_NAME,
    SEED_CAPTAIN_ROLL,
    SEED_CAPTAIN_PASSWORD,
    SEED_CAPTAIN_NAME
)

logger = logging.getLogger("database")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def seed_default_team_if_empty(db):
    """
    Optionally create first captain and team from env vars when database is empty.
    """
    import models
    from auth import hash_password

    teams_count = db.query(models.Team).count()
    if teams_count > 0:
        return

    logger.info("Empty database detected. Seeding initial team and captain...")
    
    # 1. Create Default Seed Team
    seed_team = models.Team(
        team_id="TEAM-ALPHA",
        name="TEAM-ALPHA"
    )
    db.add(seed_team)
    db.flush()

    # 2. Create Default Captain
    captain = models.User(
        team_id=seed_team.id,
        name=SEED_CAPTAIN_NAME or "Monish JB",
        roll_no=(SEED_CAPTAIN_ROLL or "7376241CS280").strip().upper(),
        password_hash=hash_password(SEED_CAPTAIN_PASSWORD or "captain2026"),
        role="captain"
    )
    db.add(captain)

    # 3. Seed Sample Team Members (Members need no password)
    sample_members = [
        ("7376231CS101", "AAMINA A"),
        ("7376241CS106", "ABINANDHAN K"),
        ("7376242IT306", "sivanagu e"),
    ]

    for roll, name in sample_members:
        member_user = models.User(
            team_id=seed_team.id,
            name=name,
            roll_no=roll.strip().upper(),
            password_hash="",
            role="member"
        )
        db.add(member_user)

    db.commit()
    logger.info(f"Seeded initial team '{seed_team.name}' ({seed_team.team_id}) with captain {captain.roll_no} and {len(sample_members)} members.")

def init_db():
    import models
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        status_row = db.query(models.SyncStatus).filter_by(id=1).first()
        if not status_row:
            status_row = models.SyncStatus(
                id=1,
                status="idle",
                source_reachable=True,
                last_error=None
            )
            db.add(status_row)
            db.commit()

        # Seed initial team and users if empty and enabled
        if ENABLE_SEED:
            seed_default_team_if_empty(db)
    finally:
        db.close()

# Alias for backwards compatibility
seed_default_members_if_empty = seed_default_team_if_empty

