"""
Risk engine wrapping three models:

1. XGBoost classifier -> Recovery Risk (low / medium / high)
2. Isolation Forest    -> Anomaly detection (inactivity, repeated missed doses)
3. Decision Tree       -> Explainable recommendation text

Models are trained by `ml/train_models.py` (see /ml folder) and saved to
backend/app/ml/artifacts/*.joblib. If artifacts are missing (fresh clone),
this module falls back to a transparent rule-based heuristic so the API
never breaks during a hackathon demo.
"""
import os
from pathlib import Path
from typing import Optional

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


def _rule_based_risk(features: dict) -> str:
    """Transparent fallback used only if no trained model artifact exists."""
    adherence = features["medicine_adherence_percent"]
    missed = features["missed_medicine_count_7d"]
    inactivity = features["inactivity_minutes_avg"]

    if adherence < 50 or missed >= 5 or inactivity > 300:
        return "high"
    if adherence < 80 or missed >= 2 or inactivity > 120:
        return "medium"
    return "low"


def predict_recovery_risk(features: dict) -> dict:
    """
    features: dict matching FEATURE_ORDER keys.
    Returns {"risk_level": str, "score": float (0-100), "model": str}
    """
    vector = np.array([[features[f] for f in FEATURE_ORDER]])

    if _xgb_model is not None:
        proba = _xgb_model.predict_proba(vector)[0]
        classes = _xgb_model.classes_
        risk_level = classes[int(np.argmax(proba))]
        # Map risk to a 0-100 "recovery score" (inverse of risk confidence)
        risk_to_base = {"low": 85, "medium": 60, "high": 30}
        score = risk_to_base.get(risk_level, 50)
        return {"risk_level": str(risk_level), "score": float(score), "model": "xgboost"}

    risk_level = _rule_based_risk(features)
    score_map = {"low": 85.0, "medium": 60.0, "high": 30.0}
    return {"risk_level": risk_level, "score": score_map[risk_level], "model": "rule_based_fallback"}


def detect_anomaly(features: dict) -> dict:
    """
    Returns {"is_anomaly": bool, "model": str}
    Anomaly = unusual inactivity or repeated missed medicine pattern.
    """
    vector = np.array([[features[f] for f in FEATURE_ORDER]])

    if _iforest_model is not None:
        prediction = _iforest_model.predict(vector)[0]  # -1 = anomaly, 1 = normal
        return {"is_anomaly": prediction == -1, "model": "isolation_forest"}

    is_anomaly = features["inactivity_minutes_avg"] > 240 or features["missed_medicine_count_7d"] >= 4
    return {"is_anomaly": bool(is_anomaly), "model": "rule_based_fallback"}


def generate_recommendation(features: dict, risk_level: str) -> str:
    """
    Uses the trained Decision Tree (if available) purely to pick an explainable
    path/leaf; otherwise falls back to a rule-based explainable message.
    Recommendations are wellness/adherence nudges only - never medical diagnoses.
    """
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
