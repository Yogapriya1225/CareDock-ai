"""
Admin endpoints: manage doctors, patients, caregivers, hospitals; view analytics.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.deps import require_roles
from app.models.user import UserRole, User
from app.models.profiles import Patient, Doctor, Caregiver, Hospital
from app.models.monitoring import Alert, RecoveryScore

router = APIRouter(prefix="/api/admin", tags=["Admin"])
admin_only = require_roles(UserRole.ADMIN)


@router.get("/users")
def list_users(db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    return db.query(User).all()


@router.get("/hospitals")
def list_hospitals(db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    return db.query(Hospital).all()


@router.post("/hospitals")
def create_hospital(name: str, address: str = "", contact_number: str = "", db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    hospital = Hospital(name=name, address=address, contact_number=contact_number)
    db.add(hospital)
    db.commit()
    db.refresh(hospital)
    return hospital


@router.get("/analytics/overview")
def analytics_overview(db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    total_patients = db.query(func.count(Patient.id)).scalar()
    total_doctors = db.query(func.count(Doctor.id)).scalar()
    total_caregivers = db.query(func.count(Caregiver.id)).scalar()
    unresolved_alerts = db.query(func.count(Alert.id)).filter(Alert.resolved == False).scalar()  # noqa: E712
    high_risk = db.query(func.count(RecoveryScore.id)).filter(RecoveryScore.risk_level == "high").scalar()

    return {
        "total_patients": total_patients,
        "total_doctors": total_doctors,
        "total_caregivers": total_caregivers,
        "unresolved_alerts": unresolved_alerts,
        "high_risk_patients": high_risk,
    }
