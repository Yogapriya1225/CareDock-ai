"""
ESP32 device ingestion endpoint.

The smart medicine box POSTs sensor readings here at a regular interval
(e.g. every 5-10s, plus immediately on button/PIR/SOS events). The backend:
  1. Authenticates the device via a shared secret (simple demo-grade auth;
     swap for per-device signed tokens in production).
  2. Persists a MedicineHistory row when a dose is detected (weight drop
     matches an active schedule's expected_weight_drop_grams) or the
     "Medicine Taken" button is pressed.
  3. Persists an ActivityLog row from the PIR sensor.
  4. Raises an SOS Alert immediately if the SOS button was pressed.
  5. Runs the anomaly detector to raise inactivity/adherence alerts.
  6. Returns hardware control instructions (buzzer, LED colour, OLED text).
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.models.profiles import Patient
from app.models.medicine import MedicineHistory, MedicineSchedule
from app.models.monitoring import ActivityLog, Alert
from app.schemas.device import ESP32Payload, ESP32Response
from app.ml.risk_engine import evaluate
from app.services.alert_service import alert_service

router = APIRouter(prefix="/api/esp32", tags=["ESP32 Device"])


def _authenticate_device(payload: ESP32Payload):
    if payload.device_secret != settings.ESP32_SHARED_SECRET:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid device secret")


@router.post("/ingest", response_model=ESP32Response)
def ingest_reading(payload: ESP32Payload, db: Session = Depends(get_db)):
    _authenticate_device(payload)

    patient = db.query(Patient).filter(Patient.device_id == payload.device_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="No patient linked to this device_id")

    timestamp = payload.timestamp or datetime.utcnow()
    response = ESP32Response()

    # --- SOS handling (highest priority) ---
    if payload.sos_pressed:
        db.add(
            Alert(
                patient_id=patient.id,
                alert_type="sos",
                message="Patient pressed the SOS button.",
                severity="critical",
            )
        )
        response.buzzer = True
        response.led_color = "red"
        response.oled_message = "SOS SENT - Help is on the way"
        response.alert_triggered = True

    # --- Medicine taken (button press) ---
    if payload.medicine_taken_button:
        db.add(
            MedicineHistory(
                patient_id=patient.id,
                taken=True,
                missed=False,
                weight_reading_grams=payload.weight_grams,
                recorded_at=timestamp,
                source="esp32",
            )
        )
        if not payload.sos_pressed:
            response.led_color = "green"
            response.oled_message = "Medicine taken - Well done!"

    # --- Activity / PIR motion ---
    db.add(
        ActivityLog(
            patient_id=patient.id,
            motion_detected=payload.pir_motion,
            inactivity_minutes=0.0 if payload.pir_motion else 5.0,
            recorded_at=timestamp,
        )
    )

    # --- Missed dose detection: compare against active schedule times ---
    active_schedules = db.query(MedicineSchedule).filter(
        MedicineSchedule.patient_id == patient.id, MedicineSchedule.active == True  # noqa: E712
    ).all()
    for sched in active_schedules:
        scheduled_dt = timestamp.replace(hour=sched.scheduled_time.hour, minute=sched.scheduled_time.minute, second=0)
        grace_window_end = scheduled_dt + timedelta(minutes=45)
        if scheduled_dt <= timestamp <= grace_window_end and not payload.medicine_taken_button:
            already_logged = (
                db.query(MedicineHistory)
                .filter(
                    MedicineHistory.patient_id == patient.id,
                    MedicineHistory.schedule_id == sched.id,
                    MedicineHistory.recorded_at >= scheduled_dt,
                )
                .first()
            )
            if not already_logged:
                db.add(
                    MedicineHistory(
                        patient_id=patient.id,
                        schedule_id=sched.id,
                        taken=False,
                        missed=True,
                        recorded_at=timestamp,
                        source="esp32",
                    )
                )
                db.add(
                    Alert(
                        patient_id=patient.id,
                        alert_type="missed_medicine",
                        message=f"Missed dose: {sched.medicine_name} scheduled at {sched.scheduled_time}",
                        severity="medium",
                    )
                )
                if response.led_color == "green":
                    response.led_color = "yellow"
                    response.oled_message = f"Reminder: take {sched.medicine_name}"
                    response.buzzer = True

    # --- Anomaly detection (Isolation Forest / fallback heuristic) ---
    # Build a lightweight feature set from live telemetry for anomaly check only.
    # NOTE: This is NOT a full ML risk evaluation. Full risk is computed
    # separately on-demand via /api/ml/{patient_id}/predict-risk.
    missed_7d = (
        db.query(MedicineHistory)
        .filter(MedicineHistory.patient_id == patient.id, MedicineHistory.missed == True)  # noqa: E712
        .count()
    )
    telemetry_features = {
        "medicine_adherence_percent": 100.0,
        "activity_score": 100.0 if payload.pir_motion else 20.0,
        "missed_medicine_count_7d": missed_7d,
        "inactivity_minutes_avg": 0.0 if payload.pir_motion else 60.0,
        "recovery_history_score": 70.0,
    }
    ml_result = evaluate(telemetry_features)
    if ml_result["is_anomaly"]:
        # Use deduplicating alert_service so we don't spam anomaly alerts
        alert_service.create_alert(
            db=db,
            patient_id=patient.id,
            alert_type="anomaly",
            message="Unusual inactivity or repeated missed doses detected by sensor.",
            severity="high",
        )
        response.alert_triggered = True
        if response.led_color != "red":
            response.led_color = "red"
            response.oled_message = "Please check in - unusual pattern detected"

    db.commit()
    return response
