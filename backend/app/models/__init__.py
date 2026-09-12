"""
Import all models here so Base.metadata is aware of every table
when Base.metadata.create_all() runs.
"""
from app.models.user import User, UserRole
from app.models.profiles import Patient, Doctor, Caregiver, Hospital
from app.models.medicine import MedicineSchedule, MedicineHistory, MedicineCompliance
from app.models.monitoring import (
    ActivityLog,
    RecoveryScore,
    Alert,
    Recommendation,
    Appointment,
    ChatMessage,
    AuditLog,
)
