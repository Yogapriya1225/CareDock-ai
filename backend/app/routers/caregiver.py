"""
Caregiver-facing endpoints: linked patient status snapshot.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_roles, get_current_user
from app.models.user import UserRole, User
from app.models.profiles import Caregiver
from app.models.medicine import MedicineHistory
from app.models.monitoring import ActivityLog, Alert, RecoveryScore
from app.schemas.caregiver import CaregiverCreate, CaregiverUpdate, CaregiverOut

router = APIRouter(prefix="/api/caregiver", tags=["Caregiver"])


@router.post("/", response_model=CaregiverOut)
def create_caregiver_profile(
    payload: CaregiverCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = payload.model_dump()
    if not data.get("user_id"):
        data["user_id"] = current_user.id
    if db.query(Caregiver).filter(Caregiver.user_id == data["user_id"]).first():
        raise HTTPException(status_code=400, detail="Profile already exists for this user")
    caregiver = Caregiver(**data)
    db.add(caregiver)
    db.commit()
    db.refresh(caregiver)
    return caregiver


@router.get("/by-user/{user_id}", response_model=CaregiverOut)
def get_caregiver_by_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    caregiver = db.query(Caregiver).filter(Caregiver.user_id == user_id).first()
    if not caregiver:
        raise HTTPException(status_code=404, detail="Caregiver profile not found")
    return caregiver


@router.patch("/me", response_model=CaregiverOut)
def update_my_caregiver_profile(
    payload: CaregiverUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Caregiver updates their own profile."""
    caregiver = db.query(Caregiver).filter(Caregiver.user_id == current_user.id).first()
    if not caregiver:
        raise HTTPException(status_code=404, detail="Caregiver profile not found")
    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(caregiver, field, value)
    db.commit()
    db.refresh(caregiver)
    return caregiver


@router.get("/directory")
def get_caregiver_directory(db: Session = Depends(get_db)):
    """List caregivers so patients can choose/assign their caregiver."""
    caregivers = db.query(Caregiver).all()
    return [
        {
            "id": c.id,
            "name": c.user.full_name if c.user else f"Caregiver #{c.id}",
            "relationship": c.relationship_to_patient or "Caregiver",
        }
        for c in caregivers
    ]


@router.get("/all-patients")
def get_all_patients_for_caregiver(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CAREGIVER, UserRole.ADMIN)),
):
    """List all patients so caregiver can connect/link with a patient."""
    from app.models.profiles import Patient
    patients = db.query(Patient).all()
    return [
        {
            "patient_id": p.id,
            "name": p.user.full_name if p.user else f"Patient #{p.id}",
            "diagnosis": p.diagnosis or "Not specified",
            "assigned_caregiver_id": p.assigned_caregiver_id,
        }
        for p in patients
    ]


@router.post("/link-patient/{patient_id}")
def link_patient_to_caregiver(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.CAREGIVER, UserRole.ADMIN)),
):
    from app.models.profiles import Patient
    caregiver = db.query(Caregiver).filter(Caregiver.user_id == current_user.id).first()
    if not caregiver:
        raise HTTPException(status_code=404, detail="Caregiver profile not found")
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    patient.assigned_caregiver_id = caregiver.id
    db.commit()
    return {"message": "Patient linked to caregiver successfully", "patient_id": patient_id, "caregiver_id": caregiver.id}


@router.get("/{caregiver_id}/patients")
def get_caregiver_patients(caregiver_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_roles(UserRole.CAREGIVER, UserRole.ADMIN))):
    caregiver = db.query(Caregiver).filter(Caregiver.id == caregiver_id).first()
    if not caregiver:
        return []

    results = []
    for p in caregiver.patients:
        latest_score = (
            db.query(RecoveryScore).filter(RecoveryScore.patient_id == p.id).order_by(RecoveryScore.computed_at.desc()).first()
        )
        recent_missed = (
            db.query(MedicineHistory)
            .filter(MedicineHistory.patient_id == p.id, MedicineHistory.missed == True)  # noqa: E712
            .count()
        )
        unresolved_alerts = db.query(Alert).filter(Alert.patient_id == p.id, Alert.resolved == False).count()  # noqa: E712

        results.append(
            {
                "patient_id": p.id,
                "name": p.user.full_name if p.user else f"Patient #{p.id}",
                "diagnosis": p.diagnosis or "Not specified",
                "recovery_score": latest_score.score if latest_score else None,
                "risk_level": latest_score.risk_level if latest_score else "unknown",
                "missed_medicine_count": recent_missed,
                "unresolved_alerts": unresolved_alerts,
                "emergency_contact_name": p.emergency_contact_name,
                "emergency_contact_phone": p.emergency_contact_phone,
                "device_id": p.device_id,
                "assigned_doctor_name": p.assigned_doctor.user.full_name if p.assigned_doctor and p.assigned_doctor.user else None,
            }
        )
    return results
