from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from config import DATABASE_URL

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

import logging
logger = logging.getLogger("database")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def seed_default_members_if_empty(db):
    import models
    import json
    from config import INITIAL_MEMBERS

    count = db.query(models.Member).count()
    if count > 0:
        return

    logger.info("Fresh database detected (disk wipe on restart). Seeding initial team members...")
    members_to_seed = []

    if INITIAL_MEMBERS:
        try:
            parsed = json.loads(INITIAL_MEMBERS)
            if isinstance(parsed, list):
                for item in parsed:
                    roll = item.get("roll_no") or item.get("roll")
                    name = item.get("name")
                    if roll and name:
                        members_to_seed.append((str(roll).strip(), str(name).strip()))
        except Exception:
            for pair in INITIAL_MEMBERS.split(","):
                if ":" in pair:
                    roll, name = pair.split(":", 1)
                    members_to_seed.append((roll.strip(), name.strip()))
                elif pair.strip():
                    members_to_seed.append((pair.strip(), pair.strip()))

    if not members_to_seed:
        members_to_seed = [
            ("7376231CS101", "AAMINA A"),
            ("7376241CS106", "ABINANDHAN K"),
            ("7376231CS102", "AANANDHA KRISHNAN A P"),
            ("7376241CS280", "monish jb"),
            ("7376242IT306", "sivanagu e"),
        ]

    for roll_no, name in members_to_seed:
        db.add(models.Member(roll_no=roll_no, name=name, is_active=True))
    db.commit()
    logger.info(f"Seeded {len(members_to_seed)} initial team members.")

def init_db():
    import models
    Base.metadata.create_all(bind=engine)
    # Ensure a SyncStatus singleton row exists
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

        # Seed members if empty (handles wiped ephemeral disk on restart)
        seed_default_members_if_empty(db)
    finally:
        db.close()

