"""
Core Users table. All roles (patient, doctor, caregiver, admin) authenticate
through this single table; role-specific data lives in linked profile tables.
"""
import enum
from datetime import datetime

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum
from sqlalchemy.orm import relationship

from app.core.database import Base


class UserRole(str, enum.Enum):
    PATIENT = "patient"
    DOCTOR = "doctor"
    CAREGIVER = "caregiver"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(120), nullable=False)
    email = Column(String(150), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.PATIENT)
    phone = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient_profile = relationship("Patient", back_populates="user", uselist=False)
    doctor_profile = relationship("Doctor", back_populates="user", uselist=False)
    caregiver_profile = relationship("Caregiver", back_populates="user", uselist=False)

    @property
    def patient_profile_id(self):
        return self.patient_profile.id if self.patient_profile else None

    @property
    def doctor_profile_id(self):
        return self.doctor_profile.id if self.doctor_profile else None

    @property
    def caregiver_profile_id(self):
        return self.caregiver_profile.id if self.caregiver_profile else None
