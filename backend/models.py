from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Text,
    UniqueConstraint
)
from sqlalchemy.orm import relationship
from database import Base

class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(String(50), unique=True, index=True, nullable=False)  # e.g. "TEAM-4F9K2"
    name = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    users = relationship("User", back_populates="team", cascade="all, delete-orphan")
    snapshots = relationship("Snapshot", back_populates="team", cascade="all, delete-orphan")
    change_logs = relationship("ChangeLog", back_populates="team", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    roll_no = Column(String(50), nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="member")  # "captain" | "member"
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Roll number must be unique within a team
    __table_args__ = (
        UniqueConstraint("team_id", "roll_no", name="uq_team_user_roll"),
    )

    team = relationship("Team", back_populates="users")
    snapshots = relationship("Snapshot", back_populates="user", cascade="all, delete-orphan", order_by="desc(Snapshot.timestamp)")
    change_logs = relationship("ChangeLog", back_populates="user", cascade="all, delete-orphan", order_by="desc(ChangeLog.timestamp)")


class Snapshot(Base):
    __tablename__ = "snapshots"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Points metrics
    balance_points = Column(Float, default=0.0)
    cumulative_points = Column(Float, default=0.0)
    redeemed_points = Column(Float, default=0.0)
    
    # Academic & Marks metrics
    total_marks = Column(Float, default=0.0)
    total_subjects = Column(Integer, default=0)
    
    # Metadata
    year = Column(String(20), nullable=True)
    department = Column(String(100), nullable=True)
    mentor_name = Column(String(100), nullable=True)
    average_points = Column(Float, nullable=True)
    points_needed = Column(Float, nullable=True)

    # Detailed structured JSON data
    subjects_json = Column(Text, nullable=True)     # list of subjects with marks and points
    activities_json = Column(Text, nullable=True)   # list of activity items
    breakdown_json = Column(Text, nullable=True)    # category breakdown counts & points

    # Raw texts preserved for transparency & fallback
    raw_student_text = Column(Text, nullable=True)
    raw_subjects_text = Column(Text, nullable=True)

    fetch_status = Column(String(20), default="success")  # "success", "not_found", "error"
    error_message = Column(Text, nullable=True)

    user = relationship("User", back_populates="snapshots")
    team = relationship("Team", back_populates="snapshots")


class ChangeLog(Base):
    __tablename__ = "change_logs"

    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    field_name = Column(String(50), nullable=False)  # "balance_points", "total_marks", "cumulative_points", etc.
    old_value = Column(String(255), nullable=True)
    new_value = Column(String(255), nullable=True)
    description = Column(String(255), nullable=False)

    user = relationship("User", back_populates="change_logs")
    team = relationship("Team", back_populates="change_logs")


class SyncStatus(Base):
    __tablename__ = "sync_status"

    id = Column(Integer, primary_key=True, default=1)
    last_sync_start = Column(DateTime, nullable=True)
    last_sync_finish = Column(DateTime, nullable=True)
    status = Column(String(30), default="idle")  # "idle", "running", "success", "error"
    last_error = Column(Text, nullable=True)
    source_reachable = Column(Boolean, default=True)


# Backwards compatibility alias
Member = User

