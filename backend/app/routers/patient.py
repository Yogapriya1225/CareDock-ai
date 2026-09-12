"""
Patient-facing endpoints: profile, medicine schedule, history, dashboard summary.
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.deps import require_roles, get_current_user
from app.models.user import User, UserRole
from app.models.profiles import Patient
from app.models.medicine import MedicineSchedule, MedicineHistory
from app.models.monitoring import ActivityLog, RecoveryScore, Alert, Appointment
from app.schemas.patient import (
    PatientCreate,
    PatientUpdate,
    PatientOut,
    MedicineScheduleCreate,
    MedicineScheduleOut,
    MedicineHistoryOut,
    ActivityLogOut,
    RecoveryScoreOut,
    AlertOut,
)

router = APIRouter(prefix="/api/patient", tags=["Patient"])


def _get_patient_or_404(db: Session, patient_id: int) -> Patient:
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.post("/", response_model=PatientOut)
def create_patient_profile(
    payload: PatientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = payload.model_dump()
    if not data.get("user_id"):
        data["user_id"] = current_user.id
    
    # Check if a profile already exists for this user_id
    if db.query(Patient).filter(Patient.user_id == data["user_id"]).first():
        raise HTTPException(status_code=400, detail="Profile already exists for this user")

    patient = Patient(**data)
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


@router.get("/by-user/{user_id}", response_model=PatientOut)
def get_patient_by_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    patient = db.query(Patient).filter(Patient.user_id == user_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient


@router.patch("/me", response_model=PatientOut)
def update_my_patient_profile(
    payload: "PatientUpdate",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Patient updates their own profile."""
    patient = db.query(Patient).filter(Patient.user_id == current_user.id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient profile not found")
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(patient, field, value)
    db.commit()
    db.refresh(patient)
    return patient


@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(patient_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _get_patient_or_404(db, patient_id)


@router.post("/schedule", response_model=MedicineScheduleOut)
def create_schedule(
    payload: MedicineScheduleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DOCTOR, UserRole.ADMIN)),
):
    schedule = MedicineSchedule(**payload.model_dump())
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return schedule


@router.get("/{patient_id}/schedule", response_model=list[MedicineScheduleOut])
def get_schedule(patient_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(MedicineSchedule).filter(
        MedicineSchedule.patient_id == patient_id, MedicineSchedule.active == True  # noqa: E712
    ).all()


@router.get("/{patient_id}/history", response_model=list[MedicineHistoryOut])
def get_history(patient_id: int, limit: int = 50, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return (
        db.query(MedicineHistory)
        .filter(MedicineHistory.patient_id == patient_id)
        .order_by(MedicineHistory.recorded_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/{patient_id}/activity", response_model=list[ActivityLogOut])
def get_activity(patient_id: int, limit: int = 100, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return (
        db.query(ActivityLog)
        .filter(ActivityLog.patient_id == patient_id)
        .order_by(ActivityLog.recorded_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/{patient_id}/recovery-scores", response_model=list[RecoveryScoreOut])
def get_recovery_scores(patient_id: int, limit: int = 30, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return (
        db.query(RecoveryScore)
        .filter(RecoveryScore.patient_id == patient_id)
        .order_by(RecoveryScore.computed_at.desc())
        .limit(limit)
        .all()
    )


@router.get("/{patient_id}/alerts", response_model=list[AlertOut])
def get_alerts(patient_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Alert).filter(Alert.patient_id == patient_id).order_by(Alert.created_at.desc()).all()


@router.get("/{patient_id}/dashboard")
def get_patient_dashboard(patient_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Aggregated payload for the Patient Dashboard: profile, today's schedule,
    compliance %, latest recovery score, recent alerts, upcoming appointment.
    """
    patient = _get_patient_or_404(db, patient_id)

    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    schedule = db.query(MedicineSchedule).filter(
        MedicineSchedule.patient_id == patient_id, MedicineSchedule.active == True  # noqa: E712
    ).all()

    taken_today = db.query(func.count(MedicineHistory.id)).filter(
        MedicineHistory.patient_id == patient_id,
        MedicineHistory.taken == True,  # noqa: E712
        MedicineHistory.recorded_at >= today_start,
        MedicineHistory.recorded_at < today_end,
    ).scalar()

    scheduled_count = len(schedule) or 1
    compliance_percent = round((taken_today / scheduled_count) * 100, 1)

    latest_score = (
        db.query(RecoveryScore)
        .filter(RecoveryScore.patient_id == patient_id)
        .order_by(RecoveryScore.computed_at.desc())
        .first()
    )

    recent_alerts = (
        db.query(Alert)
        .filter(Alert.patient_id == patient_id)
        .order_by(Alert.created_at.desc())
        .limit(5)
        .all()
    )

    next_appointment = (
        db.query(Appointment)
        .filter(Appointment.patient_id == patient_id, Appointment.status == "scheduled")
        .order_by(Appointment.scheduled_at.asc())
        .first()
    )

    return {
        "patient": PatientOut.model_validate(patient),
        "assigned_doctor": {
            "id": patient.assigned_doctor.id,
            "name": patient.assigned_doctor.user.full_name if patient.assigned_doctor and patient.assigned_doctor.user else f"Doctor #{patient.assigned_doctor.id}",
            "specialization": patient.assigned_doctor.specialization if patient.assigned_doctor else "General Practice",
        }
        if patient.assigned_doctor
        else None,
        "assigned_caregiver": {
            "id": patient.assigned_caregiver.id,
            "name": patient.assigned_caregiver.user.full_name if patient.assigned_caregiver and patient.assigned_caregiver.user else f"Caregiver #{patient.assigned_caregiver.id}",
            "relationship": patient.assigned_caregiver.relationship_to_patient if patient.assigned_caregiver else "Caregiver",
        }
        if patient.assigned_caregiver
        else None,
        "todays_schedule": [MedicineScheduleOut.model_validate(s) for s in schedule],
        "compliance_percent_today": compliance_percent,
        "recovery_score": RecoveryScoreOut.model_validate(latest_score) if latest_score else None,
        "recent_alerts": [AlertOut.model_validate(a) for a in recent_alerts],
        "next_appointment": {
            "id": next_appointment.id,
            "scheduled_at": next_appointment.scheduled_at,
            "reason": next_appointment.reason,
        }
        if next_appointment
        else None,
    }
