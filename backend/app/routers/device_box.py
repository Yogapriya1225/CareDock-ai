"""
Device endpoints: supports BLE bridge and hardware box operations.
Routes:
  - GET  /api/device/health
  - GET  /api/device/{patient_id}/schedule
  - POST /api/device/medicine
  - POST /api/device/sos
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.profiles import Patient
from app.models.medicine import MedicineSchedule, MedicineHistory
from app.models.monitoring import Alert

router = APIRouter(prefix="/api/device", tags=["ESP32 Device Bridge"])


@router.get("/health")
def device_health():
    return {"status": "device router active"}


@router.get("/{patient_id}/schedule")
def get_device_schedule(patient_id: int, db: Session = Depends(get_db)):
    """
    Returns active medicine schedules for the patient, used by BLE bridge and ESP32 box.
    """
    schedules = (
        db.query(MedicineSchedule)
        .filter(MedicineSchedule.patient_id == patient_id, MedicineSchedule.active == True)  # noqa: E712
        .all()
    )
    return [
        {
            "id": s.id,
            "medicine_name": s.medicine_name,
            "dosage": s.dosage,
            "scheduled_time": s.scheduled_time.strftime("%H:%M") if s.scheduled_time else "08:00",
            "expected_weight_drop_grams": float(s.expected_weight_drop_grams) if s.expected_weight_drop_grams else 10.0,
        }
        for s in schedules
    ]


@router.post("/medicine")
def log_device_medicine(payload: dict = Body(...), db: Session = Depends(get_db)):
    """
    Receives medicine taken events from the BLE bridge or box.
    """
    patient_id = payload.get("patient_id", 1)
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        patient = db.query(Patient).first()

    pat_id = patient.id if patient else 1
    weight = payload.get("weight") or payload.get("weight_grams")
    try:
        weight_val = float(weight) if weight is not None else None
    except (ValueError, TypeError):
        weight_val = None

    history = MedicineHistory(
        patient_id=pat_id,
        taken=bool(payload.get("taken", True)),
        missed=False,
        weight_reading_grams=weight_val,
        recorded_at=datetime.utcnow(),
        source="ble_bridge",
    )
    db.add(history)
    db.commit()
    db.refresh(history)
    return {"status": "success", "id": history.id, "message": "Medicine intake recorded successfully"}


@router.post("/sos")
def log_device_sos(payload: dict = Body(...), db: Session = Depends(get_db)):
    """
    Receives SOS alert triggers from the BLE bridge or box.
    """
    patient_id = payload.get("patient_id", 1)
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        patient = db.query(Patient).first()

    pat_id = patient.id if patient else 1
    alert = Alert(
        patient_id=pat_id,
        alert_type="sos",
        message=payload.get("message", "Emergency SOS triggered from smart box"),
        severity="critical",
        resolved=False,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return {"status": "success", "alert_id": alert.id, "message": "Emergency SOS alert created"}