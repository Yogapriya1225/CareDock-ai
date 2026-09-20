from datetime import datetime, timedelta
from typing import Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.medicine import MedicineHistory
from app.models.monitoring import ActivityLog, RecoveryScore
from app.models.profiles import Patient

class FeatureService:
    @staticmethod
    def build_features(db: Session, patient_id: int) -> Dict[str, Any]:
        """
        Builds the 5 required features for the risk engine.
        Handles missing/insufficient data gracefully.
        """
        week_ago = datetime.utcnow() - timedelta(days=7)

        # 1. & 3. Medicine Adherence and Missed Count (7 days)
        total_doses = db.query(func.count(MedicineHistory.id)).filter(
            MedicineHistory.patient_id == patient_id,
            MedicineHistory.recorded_at >= week_ago
        ).scalar() or 0
        
        if total_doses > 0:
            taken_doses = db.query(func.count(MedicineHistory.id)).filter(
                MedicineHistory.patient_id == patient_id,
                MedicineHistory.taken == True,
                MedicineHistory.recorded_at >= week_ago
            ).scalar() or 0
            
            missed_doses = db.query(func.count(MedicineHistory.id)).filter(
                MedicineHistory.patient_id == patient_id,
                MedicineHistory.missed == True,
                MedicineHistory.recorded_at >= week_ago
            ).scalar() or 0
            
            medicine_adherence_percent = round((taken_doses / total_doses) * 100.0, 1)
        else:
            # Safe documented default for insufficient history
            medicine_adherence_percent = 100.0
            missed_doses = 0

        # 2. & 4. Activity Score and Inactivity Minutes
        avg_inactivity = db.query(func.avg(ActivityLog.inactivity_minutes)).filter(
            ActivityLog.patient_id == patient_id,
            ActivityLog.recorded_at >= week_ago
        ).scalar()
        
        if avg_inactivity is not None:
            inactivity_minutes_avg = float(avg_inactivity)
            # Assuming 0 inactivity = 100 score, max out at some limit or scale inversely
            activity_score = max(0.0, 100.0 - (inactivity_minutes_avg / 4.0)) # Example scaling
        else:
            inactivity_minutes_avg = 0.0
            activity_score = 100.0
            
        # 5. Recovery History Score
        last_score = db.query(RecoveryScore).filter(
            RecoveryScore.patient_id == patient_id
        ).order_by(RecoveryScore.computed_at.desc()).first()
        
        if last_score:
            recovery_history_score = last_score.prototype_recovery_score
        else:
            recovery_history_score = 70.0 # Safe default baseline for a new patient

        return {
            "medicine_adherence_percent": medicine_adherence_percent,
            "activity_score": activity_score,
            "missed_medicine_count_7d": missed_doses,
            "inactivity_minutes_avg": inactivity_minutes_avg,
            "recovery_history_score": recovery_history_score
        }

feature_service = FeatureService()
