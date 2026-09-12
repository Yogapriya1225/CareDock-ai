"""
Pydantic schemas for patient profile, medicine, and activity data.
"""
from datetime import date, datetime, time
from typing import Optional
from pydantic import BaseModel


class PatientCreate(BaseModel):
    user_id: Optional[int] = None
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    diagnosis: Optional[str] = None
    discharge_date: Optional[date] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    device_id: Optional[str] = None
    assigned_doctor_id: Optional[int] = None
    assigned_caregiver_id: Optional[int] = None


class PatientUpdate(BaseModel):
    """All fields optional — used for PATCH (partial update)."""
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    diagnosis: Optional[str] = None
    discharge_date: Optional[date] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    device_id: Optional[str] = None
    assigned_doctor_id: Optional[int] = None
    assigned_caregiver_id: Optional[int] = None


class PatientOut(BaseModel):
    id: int
    user_id: int
    date_of_birth: Optional[date] = None
    gender: Optional[str] = None
    diagnosis: Optional[str] = None
    discharge_date: Optional[date] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    device_id: Optional[str] = None
    assigned_doctor_id: Optional[int] = None
    assigned_caregiver_id: Optional[int] = None

    class Config:
        from_attributes = True


class MedicineScheduleCreate(BaseModel):
    patient_id: int
    medicine_name: str
    dosage: Optional[str] = None
    scheduled_time: time
    frequency: str = "daily"
    expected_weight_drop_grams: Optional[float] = None


class MedicineScheduleOut(MedicineScheduleCreate):
    id: int
    active: bool

    class Config:
        from_attributes = True


class MedicineHistoryOut(BaseModel):
    id: int
    patient_id: int
    taken: bool
    missed: bool
    weight_reading_grams: Optional[float]
    recorded_at: datetime
    source: str

    class Config:
        from_attributes = True


class ActivityLogOut(BaseModel):
    id: int
    patient_id: int
    motion_detected: bool
    inactivity_minutes: float
    recorded_at: datetime

    class Config:
        from_attributes = True


class RecoveryScoreOut(BaseModel):
    id: int
    patient_id: int
    score: float
    risk_level: str
    computed_at: datetime

    class Config:
        from_attributes = True


class AlertOut(BaseModel):
    id: int
    patient_id: int
    alert_type: str
    message: str
    severity: str
    resolved: bool
    created_at: datetime

    class Config:
        from_attributes = True
