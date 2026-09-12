"""
Generates synthetic post-discharge patient data and trains:
  1. XGBoost classifier          -> recovery risk (low/medium/high)
  2. Isolation Forest            -> anomaly detector
  3. Decision Tree               -> explainable companion model

Run:  python ml/train_models.py
Outputs joblib artifacts into backend/app/ml/artifacts/, which risk_engine.py
loads automatically at API startup. Safe to re-run any time to retrain.
"""
import os
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.tree import DecisionTreeClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import xgboost as xgb
import joblib
import sys

# Import the wrapper class from the backend so the pickled artifact's class
# path resolves to backend.app.ml.risk_engine.LabeledXGB at load time.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))
from app.ml.risk_engine import LabeledXGB  # noqa: E402

FEATURE_ORDER = [
    "medicine_adherence_percent",
    "activity_score",
    "missed_medicine_count_7d",
    "inactivity_minutes_avg",
    "recovery_history_score",
]

ARTIFACT_DIR = Path(__file__).resolve().parent.parent / "backend" / "app" / "ml" / "artifacts"
ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)


def generate_synthetic_dataset(n=3000, seed=42) -> pd.DataFrame:
    rng = np.random.default_rng(seed)

    adherence = rng.uniform(20, 100, n)
    activity = rng.uniform(0, 100, n)
    missed = rng.integers(0, 10, n)
    inactivity = rng.uniform(0, 400, n)
    history = rng.uniform(20, 100, n)

    risk = []
    for a, act, m, inact, h in zip(adherence, activity, missed, inactivity, history):
        risk_score = (100 - a) * 0.35 + (100 - act) * 0.2 + m * 5 + (inact / 400) * 100 * 0.25 + (100 - h) * 0.2
        if risk_score > 65:
            risk.append("high")
        elif risk_score > 35:
            risk.append("medium")
        else:
            risk.append("low")

    df = pd.DataFrame(
        {
            "medicine_adherence_percent": adherence,
            "activity_score": activity,
            "missed_medicine_count_7d": missed,
            "inactivity_minutes_avg": inactivity,
            "recovery_history_score": history,
            "risk_level": risk,
        }
    )
    return df


def train_xgboost(df: pd.DataFrame):
    X = df[FEATURE_ORDER]
    y = df["risk_level"]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    model = xgb.XGBClassifier(
        n_estimators=150, max_depth=4, learning_rate=0.1, objective="multi:softprob", eval_metric="mlogloss"
    )
    # XGBoost needs numeric labels internally but we keep string classes via a wrapper-friendly approach:
    label_map = {"low": 0, "medium": 1, "high": 2}
    inv_label_map = {v: k for k, v in label_map.items()}
    y_train_num = y_train.map(label_map)
    y_test_num = y_test.map(label_map)

    model.fit(X_train, y_train_num)
    preds = model.predict(X_test)
    print("XGBoost Recovery Risk Classifier")
    print(classification_report(y_test_num, preds, target_names=["low", "medium", "high"]))

    wrapped = LabeledXGB(model, label_map)
    joblib.dump(wrapped, ARTIFACT_DIR / "xgb_risk_model.joblib")
    print(f"Saved -> {ARTIFACT_DIR / 'xgb_risk_model.joblib'}")


def train_isolation_forest(df: pd.DataFrame):
    X = df[FEATURE_ORDER]
    model = IsolationForest(n_estimators=200, contamination=0.1, random_state=42)
    model.fit(X)
    joblib.dump(model, ARTIFACT_DIR / "isolation_forest.joblib")
    print(f"Saved -> {ARTIFACT_DIR / 'isolation_forest.joblib'}")


def train_decision_tree(df: pd.DataFrame):
    X = df[FEATURE_ORDER]
    y = df["risk_level"]
    model = DecisionTreeClassifier(max_depth=4, random_state=42)
    model.fit(X, y)
    joblib.dump(model, ARTIFACT_DIR / "decision_tree.joblib")
    print(f"Saved -> {ARTIFACT_DIR / 'decision_tree.joblib'}")


if __name__ == "__main__":
    print("Generating synthetic training data...")
    dataset = generate_synthetic_dataset()
    dataset.to_csv(Path(__file__).parent / "data" / "synthetic_patient_data.csv", index=False)

    print("\nTraining XGBoost...")
    train_xgboost(dataset)

    print("\nTraining Isolation Forest...")
    train_isolation_forest(dataset)

    print("\nTraining Decision Tree...")
    train_decision_tree(dataset)

    print("\nAll models trained and saved to:", ARTIFACT_DIR)
