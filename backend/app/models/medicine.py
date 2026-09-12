"""
Medicine scheduling, dose history, and compliance summary tables.
"""
from datetime import datetime

from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Time, ForeignKey
from sqlalchemy.orm import relationship

from app.core.database import Base


class MedicineSchedule(Base):
    __tablename__ = "medicine_schedules"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    medicine_name = Column(String(150), nullable=False)
    dosage = Column(String(80), nullable=True)
    scheduled_time = Column(Time, nullable=False)
    frequency = Column(String(80), default="daily")  # daily, twice_daily, weekly...
    expected_weight_drop_grams = Column(Float, nullable=True)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("Patient", back_populates="medicine_schedules")


class MedicineHistory(Base):
    __tablename__ = "medicine_history"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    schedule_id = Column(Integer, ForeignKey("medicine_schedules.id"), nullable=True)
    taken = Column(Boolean, default=False)
    missed = Column(Boolean, default=False)
    weight_reading_grams = Column(Float, nullable=True)
    recorded_at = Column(DateTime, default=datetime.utcnow)
    source = Column(String(40), default="esp32")  # esp32 | manual

    patient = relationship("Patient", back_populates="medicine_history")


class MedicineCompliance(Base):
    __tablename__ = "medicine_compliance"

    id = Column(Integer, primary_key=True, index=True)
    patient_id = Column(Integer, ForeignKey("patients.id"), nullable=False)
    date = Column(DateTime, nullable=False)
    doses_scheduled = Column(Integer, default=0)
    doses_taken = Column(Integer, default=0)
    compliance_percent = Column(Float, default=0.0)
