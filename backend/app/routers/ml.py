"""
ML endpoints: compute/refresh a patient's recovery risk + recommendation.
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.profiles import Patient
from app.models.medicine import MedicineHistory
from app.models.monitoring import ActivityLog, RecoveryScore, Recommendation
from app.ml.risk_engine import predict_recovery_risk, generate_recommendation

router = APIRouter(prefix="/api/ml", tags=["Machine Learning"])


@router.post("/{patient_id}/recompute-risk")
def recompute_risk(patient_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    week_ago = datetime.utcnow() - timedelta(days=7)

    total_doses = db.query(func.count(MedicineHistory.id)).filter(
        MedicineHistory.patient_id == patient_id, MedicineHistory.recorded_at >= week_ago
    ).scalar() or 1
    taken_doses = db.query(func.count(MedicineHistory.id)).filter(
        MedicineHistory.patient_id == patient_id,
        MedicineHistory.taken == True,  # noqa: E712
        MedicineHistory.recorded_at >= week_ago,
    ).scalar()
    missed_doses = db.query(func.count(MedicineHistory.id)).filter(
        MedicineHistory.patient_id == patient_id,
        MedicineHistory.missed == True,  # noqa: E712
        MedicineHistory.recorded_at >= week_ago,
    ).scalar()

    avg_inactivity = db.query(func.avg(ActivityLog.inactivity_minutes)).filter(
        ActivityLog.patient_id == patient_id, ActivityLog.recorded_at >= week_ago
    ).scalar() or 0.0

    features = {
        "medicine_adherence_percent": round((taken_doses / total_doses) * 100, 1),
        "activity_score": max(0.0, 100.0 - float(avg_inactivity)),
        "missed_medicine_count_7d": missed_doses,
        "inactivity_minutes_avg": float(avg_inactivity),
        "recovery_history_score": 70.0,  # placeholder until longitudinal history model is trained
    }

    risk_result = predict_recovery_risk(features)
    recommendation_text = generate_recommendation(features, risk_result["risk_level"])

    score_row = RecoveryScore(patient_id=patient_id, score=risk_result["score"], risk_level=risk_result["risk_level"])
    rec_row = Recommendation(patient_id=patient_id, text=recommendation_text, source="decision_tree")
    db.add(score_row)
    db.add(rec_row)
    db.commit()
    db.refresh(score_row)

    return {
        "features_used": features,
        "risk_level": risk_result["risk_level"],
        "score": risk_result["score"],
        "model": risk_result["model"],
        "recommendation": recommendation_text,
    }
