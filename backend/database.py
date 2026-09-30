from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from config import DATABASE_URL

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
    finally:
        db.close()
