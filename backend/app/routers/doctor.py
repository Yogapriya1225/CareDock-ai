"""
Doctor-facing endpoints: patient list/search, risk overview, recommendations.
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles, get_current_user
from app.models.user import UserRole, User
from app.models.profiles import Patient, Doctor
from app.models.monitoring import RecoveryScore, Alert
from app.schemas.doctor import DoctorCreate, DoctorUpdate, DoctorOut

router = APIRouter(prefix="/api/doctor", tags=["Doctor"])


@router.post("/", response_model=DoctorOut)
def create_doctor_profile(
    payload: DoctorCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = payload.model_dump()
    if not data.get("user_id"):
        data["user_id"] = current_user.id
    if db.query(Doctor).filter(Doctor.user_id == data["user_id"]).first():
        raise HTTPException(status_code=400, detail="Profile already exists for this user")
    doctor = Doctor(**data)
    db.add(doctor)
    db.commit()
    db.refresh(doctor)
    return doctor


@router.get("/by-user/{user_id}", response_model=DoctorOut)
def get_doctor_by_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    doctor = db.query(Doctor).filter(Doctor.user_id == user_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")
    return doctor


@router.patch("/me", response_model=DoctorOut)
def update_my_doctor_profile(
    payload: DoctorUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Doctor updates their own profile."""
    doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(doctor, field, value)
    db.commit()
    db.refresh(doctor)
    return doctor


@router.get("/directory")
def get_doctor_directory(db: Session = Depends(get_db)):
    """List doctors so patients can easily choose/assign their doctor."""
    doctors = db.query(Doctor).all()
    return [
        {
            "id": d.id,
            "name": d.user.full_name if d.user else f"Doctor #{d.id}",
            "specialization": d.specialization or "General Practice",
            "license_number": d.license_number or "Licensed",
        }
        for d in doctors
    ]


@router.post("/link-patient/{patient_id}")
def link_patient_to_doctor(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DOCTOR, UserRole.ADMIN)),
):
    doctor = db.query(Doctor).filter(Doctor.user_id == current_user.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor profile not found")
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    patient.assigned_doctor_id = doctor.id
    db.commit()
    return {"message": "Patient linked to doctor successfully", "patient_id": patient_id, "doctor_id": doctor.id}


@router.get("/patients")
def list_patients(
    search: str | None = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.DOCTOR, UserRole.ADMIN)),
):
    query = db.query(Patient)
    if search:
        query = query.join(User, Patient.user_id == User.id).filter(User.full_name.ilike(f"%{search}%"))
    patients = query.all()

    results = []
    for p in patients:
        latest_score = (
            db.query(RecoveryScore)
            .filter(RecoveryScore.patient_id == p.id)
            .order_by(RecoveryScore.computed_at.desc())
            .first()
        )
        results.append(
            {
                "patient_id": p.id,
                "name": p.user.full_name if p.user else f"Patient #{p.id}",
                "diagnosis": p.diagnosis or "Not specified",
                "risk_level": latest_score.risk_level if latest_score else "unknown",
                "recovery_score": latest_score.prototype_recovery_score if latest_score else None,
                "risk_probability": latest_score.risk_probability if latest_score else None,
                "is_anomaly": latest_score.is_anomaly if latest_score else False,
                "emergency_contact_name": p.emergency_contact_name,
                "emergency_contact_phone": p.emergency_contact_phone,
                "device_id": p.device_id,
                "discharge_date": str(p.discharge_date) if p.discharge_date else None,
                "assigned_doctor_id": p.assigned_doctor_id,
                "assigned_caregiver_id": p.assigned_caregiver_id,
                "caregiver_name": p.assigned_caregiver.user.full_name if p.assigned_caregiver and p.assigned_caregiver.user else None,
            }
        )
    return results


@router.get("/high-risk-patients")
def high_risk_patients(db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.DOCTOR, UserRole.ADMIN))):
    subq = (
        db.query(RecoveryScore.patient_id, RecoveryScore.risk_level, RecoveryScore.prototype_recovery_score)
        .filter(RecoveryScore.risk_level == "high")
        .order_by(RecoveryScore.computed_at.desc())
        .all()
    )
    return [{"patient_id": r.patient_id, "risk_level": r.risk_level, "score": r.prototype_recovery_score} for r in subq]


@router.get("/alerts/live")
def live_alerts(db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.DOCTOR, UserRole.ADMIN))):
    return db.query(Alert).filter(Alert.resolved == False).order_by(Alert.created_at.desc()).all()  # noqa: E712
