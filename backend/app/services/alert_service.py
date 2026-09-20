from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.monitoring import Alert

class AlertService:
    @staticmethod
    def create_alert(db: Session, patient_id: int, alert_type: str, message: str, severity: str = "medium") -> Alert:
        """
        Creates an alert if an identical unresolved alert hasn't been created recently.
        """
        # Deduplication: check if a similar unresolved alert exists in the last 12 hours
        twelve_hours_ago = datetime.utcnow() - timedelta(hours=12)
        existing_alert = db.query(Alert).filter(
            Alert.patient_id == patient_id,
            Alert.alert_type == alert_type,
            Alert.resolved == False,
            Alert.created_at >= twelve_hours_ago
        ).first()

        if existing_alert:
            # Avoid spamming duplicate alerts
            return existing_alert
            
        new_alert = Alert(
            patient_id=patient_id,
            alert_type=alert_type,
            message=message,
            severity=severity
        )
        db.add(new_alert)
        db.commit()
        db.refresh(new_alert)
        return new_alert

alert_service = AlertService()
