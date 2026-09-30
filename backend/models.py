from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base

class Member(Base):
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, index=True)
    roll_no = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    snapshots = relationship("Snapshot", back_populates="member", cascade="all, delete-orphan", order_by="desc(Snapshot.timestamp)")
    change_logs = relationship("ChangeLog", back_populates="member", cascade="all, delete-orphan", order_by="desc(ChangeLog.timestamp)")

class Snapshot(Base):
    __tablename__ = "snapshots"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False, index=True)
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

    member = relationship("Member", back_populates="snapshots")

class ChangeLog(Base):
    __tablename__ = "change_logs"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("members.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    field_name = Column(String(50), nullable=False)  # "balance_points", "total_marks", "cumulative_points", "subjects"
    old_value = Column(String(255), nullable=True)
    new_value = Column(String(255), nullable=True)
    description = Column(String(255), nullable=False)

    member = relationship("Member", back_populates="change_logs")

class SyncStatus(Base):
    __tablename__ = "sync_status"

    id = Column(Integer, primary_key=True, default=1)
    last_sync_start = Column(DateTime, nullable=True)
    last_sync_finish = Column(DateTime, nullable=True)
    status = Column(String(30), default="idle")  # "idle", "running", "success", "error"
    last_error = Column(Text, nullable=True)
    source_reachable = Column(Boolean, default=True)
