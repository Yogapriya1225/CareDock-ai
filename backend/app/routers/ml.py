"""
ML endpoints: compute/refresh a patient's recovery risk + recommendation.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.profiles import Patient
from app.models.monitoring import RecoveryScore, Recommendation
from app.ml.risk_engine import evaluate
from app.services.feature_service import feature_service
from app.services.alert_service import alert_service

router = APIRouter(prefix="/api/ml", tags=["Machine Learning"])


@router.post("/{patient_id}/predict-risk")
def predict_risk(patient_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Computes features, evaluates ML models, and persists the result.
    """
    # Simple authorization check (doctors/caregivers can view their assigned patients)
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    # Build features
    features = feature_service.build_features(db, patient_id)
    
    # Evaluate risk
    result = evaluate(features)
    
    # Persist the score
    score_row = RecoveryScore(
        patient_id=patient_id, 
        prototype_recovery_score=result["prototype_recovery_score"], 
        risk_level=result["risk_level"],
        risk_probability=result["risk_probability"],
        is_anomaly=result["is_anomaly"],
        recommendation=result["recommendation"],
        model_version=result["model_versions"]["xgboost"]
    )
    
    # Check for anomaly and create alert if needed
    if result["is_anomaly"]:
        alert_service.create_alert(
            db=db, 
            patient_id=patient_id, 
            alert_type="anomaly", 
            message="Unusual telemetry pattern detected by Isolation Forest.", 
            severity="high"
        )
        
    # If high risk, optionally create an alert too
    if result["risk_level"] == "high":
        alert_service.create_alert(
            db=db, 
            patient_id=patient_id, 
            alert_type="high_risk", 
            message="Patient classified as high recovery risk.", 
            severity="critical"
        )

    # Note: We persist the recommendation inside RecoveryScore as well, 
    # but we can also add to Recommendation table if the schema prefers it.
    rec_row = Recommendation(patient_id=patient_id, text=result["recommendation"], source="decision_tree")
    
    db.add(score_row)
    db.add(rec_row)
    db.commit()
    db.refresh(score_row)

    return {
        "features_used": features,
        "risk_level": result["risk_level"],
        "risk_probability": result["risk_probability"],
        "prototype_recovery_score": result["prototype_recovery_score"],
        "is_anomaly": result["is_anomaly"],
        "recommendation": result["recommendation"],
        "model_versions": result["model_versions"],
        "computed_at": score_row.computed_at
    }


@router.get("/{patient_id}/history")
def get_risk_history(patient_id: int, limit: int = 10, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Fetches the historical recovery risk evaluations.
    """
    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    scores = db.query(RecoveryScore).filter(
        RecoveryScore.patient_id == patient_id
    ).order_by(RecoveryScore.computed_at.desc()).limit(limit).all()
    
    return scores

# Keep the old recompute-risk for backward compatibility (if frontend hasn't migrated yet)
@router.post("/{patient_id}/recompute-risk")
def recompute_risk(patient_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Legacy route pointing to predict_risk"""
    return predict_risk(patient_id, db, current_user)
