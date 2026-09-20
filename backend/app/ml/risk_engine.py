"""
Risk engine wrapping three models:

1. XGBoost classifier -> Recovery Risk (low / medium / high) & probability
2. Isolation Forest    -> Anomaly detection (inactivity, repeated missed doses)
3. Decision Tree       -> Explainable recommendation text (extracting decision paths)

Models are trained by `ml/train_models.py` (see /ml folder) and saved to
backend/app/ml/artifacts/*.joblib. If artifacts are missing (fresh clone),
this module falls back to a transparent rule-based heuristic so the API
never breaks during a hackathon demo.
"""
import os
from pathlib import Path
from typing import Optional, Dict, Any

import joblib
import numpy as np

ARTIFACT_DIR = Path(__file__).parent / "artifacts"
XGB_PATH = ARTIFACT_DIR / "xgb_risk_model.joblib"
IFOREST_PATH = ARTIFACT_DIR / "isolation_forest.joblib"
DTREE_PATH = ARTIFACT_DIR / "decision_tree.joblib"

FEATURE_ORDER = [
    "medicine_adherence_percent",
    "activity_score",
    "missed_medicine_count_7d",
    "inactivity_minutes_avg",
    "recovery_history_score",
]


class LabeledXGB:
    """Wraps an XGBClassifier so predict()/predict_proba() work with string
    risk-level labels. Defined here (not in the training script) so joblib
    can locate this class by import path when unpickling the saved model."""

    def __init__(self, inner, label_map):
        self.inner = inner
        self.classes_ = np.array(["low", "medium", "high"])
        self.label_map = label_map
        self.inv_label_map = {v: k for k, v in label_map.items()}

    def predict_proba(self, X):
        return self.inner.predict_proba(X)

    def predict(self, X):
        nums = self.inner.predict(X)
        return np.array([self.inv_label_map[n] for n in nums])


def _load(path: Path):
    return joblib.load(path) if path.exists() else None


_xgb_model = _load(XGB_PATH)
_iforest_model = _load(IFOREST_PATH)
_dtree_model = _load(DTREE_PATH)


def _rule_based_risk(features: dict) -> dict:
    """Transparent fallback used only if no trained model artifact exists."""
    adherence = features["medicine_adherence_percent"]
    missed = features["missed_medicine_count_7d"]
    inactivity = features["inactivity_minutes_avg"]

    if adherence < 50 or missed >= 5 or inactivity > 300:
        return {"risk_level": "high", "probability": 0.9}
    if adherence < 80 or missed >= 2 or inactivity > 120:
        return {"risk_level": "medium", "probability": 0.65}
    return {"risk_level": "low", "probability": 0.2}


def _get_dtree_recommendation(features: dict, vector: np.ndarray, risk_level: str) -> str:
    """
    Traces the decision path to find the most impactful feature,
    generating an explainable recommendation.
    """
    if _dtree_model is None:
        return _fallback_recommendation(risk_level)

    try:
        path = _dtree_model.decision_path(vector)
        node_index = path.indices
        feature_indices = _dtree_model.tree_.feature

        # Find the first valid feature used to split this sample
        dominant_feature_idx = None
        for node_id in node_index:
            if feature_indices[node_id] != -2:  # -2 means leaf node
                dominant_feature_idx = feature_indices[node_id]
                break
        
        if dominant_feature_idx is None:
            return _fallback_recommendation(risk_level)
            
        feature_name = FEATURE_ORDER[dominant_feature_idx]
        val = features[feature_name]
        
        if feature_name == "medicine_adherence_percent" and val < 80:
            return "Your medicine adherence is a bit low. Setting daily reminders might help keep you on track for a smoother recovery."
        elif feature_name == "missed_medicine_count_7d" and val > 0:
            return f"You've missed {val} doses recently. Please reach out to your care team to ensure this doesn't impact your recovery."
        elif feature_name == "inactivity_minutes_avg" and val > 120:
            return "We noticed prolonged periods of inactivity. If approved by your doctor, try incorporating light movement into your day."
        elif feature_name == "activity_score" and val < 50:
            return "Your activity levels are lower than expected. Focus on small, safe movements and consult your doctor if you feel unwell."
        
        return _fallback_recommendation(risk_level)
    except Exception:
        return _fallback_recommendation(risk_level)


def _fallback_recommendation(risk_level: str) -> str:
    if risk_level == "high":
        return (
            "Recovery indicators suggest elevated risk. Please contact your care team soon, "
            "ensure all scheduled medicines are taken on time, and try to move around gently "
            "if your doctor has approved light activity."
        )
    if risk_level == "medium":
        return (
            "A few missed doses or reduced activity were noticed. Try setting reminders for "
            "medicine times and take a short walk if you feel able to. Reach out to your doctor "
            "if symptoms change."
        )
    return (
        "Great progress! Keep following your medicine schedule and stay gently active. "
        "Continue reporting how you feel to your care team."
    )


def evaluate(features: dict) -> Dict[str, Any]:
    """
    Evaluates risk and anomalies in a single pass.
    features: dict matching FEATURE_ORDER keys.
    """
    vector = np.array([[features[f] for f in FEATURE_ORDER]])
    result = {
        "model_versions": {
            "xgboost": "v1.0" if _xgb_model else "fallback",
            "isolation_forest": "v1.0" if _iforest_model else "fallback",
            "decision_tree": "v1.0" if _dtree_model else "fallback",
        }
    }

    # 1. Evaluate Risk (XGBoost)
    if _xgb_model is not None:
        proba = _xgb_model.predict_proba(vector)[0]
        classes = _xgb_model.classes_
        max_idx = int(np.argmax(proba))
        risk_level = str(classes[max_idx])
        risk_probability = float(proba[max_idx])
    else:
        fb = _rule_based_risk(features)
        risk_level = fb["risk_level"]
        risk_probability = fb["probability"]

    result["risk_level"] = risk_level
    result["risk_probability"] = risk_probability

    # Prototype recovery score mapping (NOT clinically validated)
    risk_to_base = {"low": 85.0, "medium": 60.0, "high": 30.0}
    result["prototype_recovery_score"] = risk_to_base.get(risk_level, 50.0)

    # 2. Evaluate Anomaly (Isolation Forest)
    if _iforest_model is not None:
        prediction = _iforest_model.predict(vector)[0]  # -1 = anomaly, 1 = normal
        result["is_anomaly"] = bool(prediction == -1)
    else:
        result["is_anomaly"] = bool(features["inactivity_minutes_avg"] > 240 or features["missed_medicine_count_7d"] >= 4)

    # 3. Generate Recommendation (Decision Tree)
    result["recommendation"] = _get_dtree_recommendation(features, vector, risk_level)

    return result
