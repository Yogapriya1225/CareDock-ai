"""
Role-specific profile tables: Patient, Doctor, Caregiver, Hospital.
"""
from datetime import datetime

from sqlalchemy import Column, Integer, String, Date, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship

from app.core.database import Base


class Hospital(Base):
    __tablename__ = "hospitals"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    address = Column(String(255), nullable=True)
    contact_number = Column(String(20), nullable=True)

    doctors = relationship("Doctor", back_populates="hospital")


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    specialization = Column(String(120), nullable=True)
    license_number = Column(String(80), nullable=True)
    hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=True)

    user = relationship("User", back_populates="doctor_profile")
    hospital = relationship("Hospital", back_populates="doctors")
    patients = relationship("Patient", back_populates="assigned_doctor")


class Caregiver(Base):
    __tablename__ = "caregivers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    relationship_to_patient = Column(String(80), nullable=True)

    user = relationship("User", back_populates="caregiver_profile")
    patients = relationship("Patient", back_populates="assigned_caregiver")


class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    date_of_birth = Column(Date, nullable=True)
    gender = Column(String(20), nullable=True)
    diagnosis = Column(String(255), nullable=True)
    discharge_date = Column(Date, nullable=True)
    emergency_contact_name = Column(String(120), nullable=True)
    emergency_contact_phone = Column(String(20), nullable=True)
    device_id = Column(String(80), unique=True, nullable=True)  # ESP32 device identifier

    assigned_doctor_id = Column(Integer, ForeignKey("doctors.id"), nullable=True)
    assigned_caregiver_id = Column(Integer, ForeignKey("caregivers.id"), nullable=True)

    user = relationship("User", back_populates="patient_profile")
    assigned_doctor = relationship("Doctor", back_populates="patients")
    assigned_caregiver = relationship("Caregiver", back_populates="patients")

    medicine_schedules = relationship("MedicineSchedule", back_populates="patient")
    medicine_history = relationship("MedicineHistory", back_populates="patient")
    activity_logs = relationship("ActivityLog", back_populates="patient")
    recovery_scores = relationship("RecoveryScore", back_populates="patient")
    alerts = relationship("Alert", back_populates="patient")
    appointments = relationship("Appointment", back_populates="patient")
    chat_history = relationship("ChatMessage", back_populates="patient")
