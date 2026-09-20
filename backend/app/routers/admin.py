"""
Admin endpoints: manage doctors, patients, caregivers, hospitals; view analytics.
"""
from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.deps import require_roles
from app.models.user import UserRole, User
from app.models.profiles import Patient, Doctor, Caregiver, Hospital
from app.models.monitoring import Alert, RecoveryScore

router = APIRouter(prefix="/api/admin", tags=["Admin"])
admin_only = require_roles(UserRole.ADMIN)


class UserUpdate(BaseModel):
    full_name: str | None = None
    email: str | None = None
    role: UserRole | None = None
    # Profile update fields
    diagnosis: str | None = None
    discharge_date: str | None = None
    specialization: str | None = None
    license_number: str | None = None
    relationship_to_patient: str | None = None
    hospital_id: int | None = None
    assigned_doctor_id: int | None = None
    assigned_caregiver_id: int | None = None


class HospitalCreate(BaseModel):
    name: str
    address: str | None = ""
    contact_number: str | None = ""


class HospitalUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    contact_number: str | None = None


class LinkDoctorHospital(BaseModel):
    doctor_id: int
    hospital_id: int | None = None


class LinkPatientHospital(BaseModel):
    patient_id: int
    hospital_id: int | None = None


class LinkPatientDoctor(BaseModel):
    patient_id: int
    doctor_id: int | None = None


class LinkPatientCaregiver(BaseModel):
    patient_id: int
    caregiver_id: int | None = None


@router.get("/users")
def list_users(db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    return db.query(User).all()


@router.get("/users/detailed")
def list_detailed_users(db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    users = db.query(User).all()
    results = []
    for u in users:
        user_data = {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role.value if hasattr(u.role, "value") else str(u.role),
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "profile": None,
        }
        if u.role == UserRole.PATIENT:
            pat = db.query(Patient).filter(Patient.user_id == u.id).first()
            if pat:
                latest_score = db.query(RecoveryScore).filter(RecoveryScore.patient_id == pat.id).order_by(RecoveryScore.id.desc()).first()
                alert_count = db.query(Alert).filter(Alert.patient_id == pat.id, Alert.resolved == False).count()  # noqa: E712
                user_data["profile"] = {
                    "patient_id": pat.id,
                    "date_of_birth": str(pat.date_of_birth) if pat.date_of_birth else None,
                    "gender": pat.gender,
                    "diagnosis": pat.diagnosis,
                    "discharge_date": str(pat.discharge_date) if pat.discharge_date else None,
                    "emergency_contact_name": pat.emergency_contact_name,
                    "emergency_contact_phone": pat.emergency_contact_phone,
                    "device_id": pat.device_id,
                    "hospital_id": pat.hospital_id,
                    "hospital_name": pat.hospital.name if pat.hospital else None,
                    "assigned_doctor_id": pat.assigned_doctor_id,
                    "assigned_doctor_name": pat.assigned_doctor.user.full_name if pat.assigned_doctor and pat.assigned_doctor.user else None,
                    "assigned_caregiver_id": pat.assigned_caregiver_id,
                    "assigned_caregiver_name": pat.assigned_caregiver.user.full_name if pat.assigned_caregiver and pat.assigned_caregiver.user else None,
                    "risk_level": latest_score.risk_level if latest_score else "unknown",
                    "recovery_score": latest_score.score if latest_score else None,
                    "unresolved_alerts": alert_count,
                }
        elif u.role == UserRole.DOCTOR:
            doc = db.query(Doctor).filter(Doctor.user_id == u.id).first()
            if doc:
                patients_list = []
                for p in doc.patients:
                    p_score = db.query(RecoveryScore).filter(RecoveryScore.patient_id == p.id).order_by(RecoveryScore.id.desc()).first()
                    patients_list.append({
                        "id": p.id,
                        "name": p.user.full_name if p.user else f"Patient #{p.id}",
                        "diagnosis": p.diagnosis,
                        "risk_level": p_score.risk_level if p_score else "low",
                    })
                user_data["profile"] = {
                    "doctor_id": doc.id,
                    "specialization": doc.specialization,
                    "license_number": doc.license_number,
                    "hospital_id": doc.hospital_id,
                    "hospital_name": doc.hospital.name if doc.hospital else None,
                    "patients_count": len(doc.patients),
                    "patients": patients_list,
                }
        elif u.role == UserRole.CAREGIVER:
            cg = db.query(Caregiver).filter(Caregiver.user_id == u.id).first()
            if cg:
                patients_list = []
                for p in cg.patients:
                    p_score = db.query(RecoveryScore).filter(RecoveryScore.patient_id == p.id).order_by(RecoveryScore.id.desc()).first()
                    patients_list.append({
                        "id": p.id,
                        "name": p.user.full_name if p.user else f"Patient #{p.id}",
                        "diagnosis": p.diagnosis,
                        "risk_level": p_score.risk_level if p_score else "low",
                    })
                user_data["profile"] = {
                    "caregiver_id": cg.id,
                    "relationship_to_patient": cg.relationship_to_patient,
                    "patients_count": len(cg.patients),
                    "patients": patients_list,
                }
        results.append(user_data)
    return results


@router.get("/users/{user_id}/details")
def get_user_details(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_data = {
        "id": u.id,
        "email": u.email,
        "full_name": u.full_name,
        "role": u.role.value if hasattr(u.role, "value") else str(u.role),
        "is_active": u.is_active,
        "created_at": u.created_at.isoformat() if u.created_at else None,
        "profile": None,
    }
    if u.role == UserRole.PATIENT:
        pat = db.query(Patient).filter(Patient.user_id == u.id).first()
        if pat:
            latest_score = db.query(RecoveryScore).filter(RecoveryScore.patient_id == pat.id).order_by(RecoveryScore.id.desc()).first()
            alert_count = db.query(Alert).filter(Alert.patient_id == pat.id, Alert.resolved == False).count()  # noqa: E712
            user_data["profile"] = {
                "patient_id": pat.id,
                "date_of_birth": str(pat.date_of_birth) if pat.date_of_birth else None,
                "gender": pat.gender,
                "diagnosis": pat.diagnosis,
                "discharge_date": str(pat.discharge_date) if pat.discharge_date else None,
                "emergency_contact_name": pat.emergency_contact_name,
                "emergency_contact_phone": pat.emergency_contact_phone,
                "device_id": pat.device_id,
                "hospital_id": pat.hospital_id,
                "hospital_name": pat.hospital.name if pat.hospital else None,
                "assigned_doctor_id": pat.assigned_doctor_id,
                "assigned_doctor_name": pat.assigned_doctor.user.full_name if pat.assigned_doctor and pat.assigned_doctor.user else None,
                "assigned_caregiver_id": pat.assigned_caregiver_id,
                "assigned_caregiver_name": pat.assigned_caregiver.user.full_name if pat.assigned_caregiver and pat.assigned_caregiver.user else None,
                "risk_level": latest_score.risk_level if latest_score else "unknown",
                "recovery_score": latest_score.score if latest_score else None,
                "unresolved_alerts": alert_count,
            }
    elif u.role == UserRole.DOCTOR:
        doc = db.query(Doctor).filter(Doctor.user_id == u.id).first()
        if doc:
            patients_list = []
            for p in doc.patients:
                p_score = db.query(RecoveryScore).filter(RecoveryScore.patient_id == p.id).order_by(RecoveryScore.id.desc()).first()
                patients_list.append({
                    "id": p.id,
                    "name": p.user.full_name if p.user else f"Patient #{p.id}",
                    "diagnosis": p.diagnosis,
                    "risk_level": p_score.risk_level if p_score else "low",
                })
            user_data["profile"] = {
                "doctor_id": doc.id,
                "specialization": doc.specialization,
                "license_number": doc.license_number,
                "hospital_id": doc.hospital_id,
                "hospital_name": doc.hospital.name if doc.hospital else None,
                "patients_count": len(doc.patients),
                "patients": patients_list,
            }
    elif u.role == UserRole.CAREGIVER:
        cg = db.query(Caregiver).filter(Caregiver.user_id == u.id).first()
        if cg:
            patients_list = []
            for p in cg.patients:
                p_score = db.query(RecoveryScore).filter(RecoveryScore.patient_id == p.id).order_by(RecoveryScore.id.desc()).first()
                patients_list.append({
                    "id": p.id,
                    "name": p.user.full_name if p.user else f"Patient #{p.id}",
                    "diagnosis": p.diagnosis,
                    "risk_level": p_score.risk_level if p_score else "low",
                })
            user_data["profile"] = {
                "caregiver_id": cg.id,
                "relationship_to_patient": cg.relationship_to_patient,
                "patients_count": len(cg.patients),
                "patients": patients_list,
            }
    return user_data


@router.put("/users/{user_id}")
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.email is not None:
        user.email = payload.email
    if payload.role is not None:
        user.role = payload.role
        
    # Also update profile if present
    if user.role == UserRole.PATIENT:
        pat = db.query(Patient).filter(Patient.user_id == user_id).first()
        if pat:
            if payload.diagnosis is not None:
                pat.diagnosis = payload.diagnosis
            if payload.hospital_id is not None:
                pat.hospital_id = payload.hospital_id if payload.hospital_id > 0 else None
            if payload.assigned_doctor_id is not None:
                pat.assigned_doctor_id = payload.assigned_doctor_id if payload.assigned_doctor_id > 0 else None
            if payload.assigned_caregiver_id is not None:
                pat.assigned_caregiver_id = payload.assigned_caregiver_id if payload.assigned_caregiver_id > 0 else None
    elif user.role == UserRole.DOCTOR:
        doc = db.query(Doctor).filter(Doctor.user_id == user_id).first()
        if doc:
            if payload.specialization is not None:
                doc.specialization = payload.specialization
            if payload.license_number is not None:
                doc.license_number = payload.license_number
            if payload.hospital_id is not None:
                doc.hospital_id = payload.hospital_id if payload.hospital_id > 0 else None
    elif user.role == UserRole.CAREGIVER:
        cg = db.query(Caregiver).filter(Caregiver.user_id == user_id).first()
        if cg:
            if payload.relationship_to_patient is not None:
                cg.relationship_to_patient = payload.relationship_to_patient

    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Cascade cleanup for role profile
    pat = db.query(Patient).filter(Patient.user_id == user_id).first()
    if pat:
        db.query(Alert).filter(Alert.patient_id == pat.id).delete()
        db.query(RecoveryScore).filter(RecoveryScore.patient_id == pat.id).delete()
        db.delete(pat)
    
    doc = db.query(Doctor).filter(Doctor.user_id == user_id).first()
    if doc:
        for p in db.query(Patient).filter(Patient.assigned_doctor_id == doc.id).all():
            p.assigned_doctor_id = None
        db.delete(doc)
        
    cg = db.query(Caregiver).filter(Caregiver.user_id == user_id).first()
    if cg:
        for p in db.query(Patient).filter(Patient.assigned_caregiver_id == cg.id).all():
            p.assigned_caregiver_id = None
        db.delete(cg)

    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}


@router.get("/hospitals")
def list_hospitals(db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    hospitals = db.query(Hospital).all()
    results = []
    for h in hospitals:
        results.append({
            "id": h.id,
            "name": h.name,
            "address": h.address,
            "contact_number": h.contact_number,
            "doctor_count": len(h.doctors),
            "patient_count": len(h.patients),
        })
    return results


@router.post("/hospitals")
def create_hospital(payload: HospitalCreate, db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    hospital = Hospital(name=payload.name, address=payload.address or "", contact_number=payload.contact_number or "")
    db.add(hospital)
    db.commit()
    db.refresh(hospital)
    return hospital


@router.put("/hospitals/{hospital_id}")
def update_hospital(hospital_id: int, payload: HospitalUpdate, db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
    if payload.name is not None:
        hospital.name = payload.name
    if payload.address is not None:
        hospital.address = payload.address
    if payload.contact_number is not None:
        hospital.contact_number = payload.contact_number
    db.commit()
    db.refresh(hospital)
    return hospital


@router.delete("/hospitals/{hospital_id}")
def delete_hospital(hospital_id: int, db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id).first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
    
    for doc in db.query(Doctor).filter(Doctor.hospital_id == hospital_id).all():
        doc.hospital_id = None
    for pat in db.query(Patient).filter(Patient.hospital_id == hospital_id).all():
        pat.hospital_id = None

    db.delete(hospital)
    db.commit()
    return {"message": "Hospital deleted successfully"}


@router.post("/link/doctor-hospital")
def link_doctor_hospital(payload: LinkDoctorHospital, db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    doctor = db.query(Doctor).filter(Doctor.id == payload.doctor_id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    if payload.hospital_id:
        hosp = db.query(Hospital).filter(Hospital.id == payload.hospital_id).first()
        if not hosp:
            raise HTTPException(status_code=404, detail="Hospital not found")
    doctor.hospital_id = payload.hospital_id
    db.commit()
    return {"message": "Doctor hospital link updated successfully"}


@router.post("/link/patient-hospital")
def link_patient_hospital(payload: LinkPatientHospital, db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    patient = db.query(Patient).filter(Patient.id == payload.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if payload.hospital_id:
        hosp = db.query(Hospital).filter(Hospital.id == payload.hospital_id).first()
        if not hosp:
            raise HTTPException(status_code=404, detail="Hospital not found")
    patient.hospital_id = payload.hospital_id
    db.commit()
    return {"message": "Patient hospital link updated successfully"}


@router.post("/link/patient-doctor")
def link_patient_doctor(payload: LinkPatientDoctor, db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    patient = db.query(Patient).filter(Patient.id == payload.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if payload.doctor_id:
        doc = db.query(Doctor).filter(Doctor.id == payload.doctor_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Doctor not found")
    patient.assigned_doctor_id = payload.doctor_id
    db.commit()
    return {"message": "Patient doctor link updated successfully"}


@router.post("/link/patient-caregiver")
def link_patient_caregiver(payload: LinkPatientCaregiver, db: Session = Depends(get_db), current_user: User = Depends(admin_only)):
    patient = db.query(Patient).filter(Patient.id == payload.patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if payload.caregiver_id:
        cg = db.query(Caregiver).filter(Caregiver.id == payload.caregiver_id).first()
        if not cg:
            raise HTTPException(status_code=404, detail="Caregiver not found")
    patient.assigned_caregiver_id = payload.caregiver_id
    db.commit()
    return {"message": "Patient caregiver link updated successfully"}


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
