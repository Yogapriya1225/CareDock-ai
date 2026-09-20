# CareDock AI — ML Architecture Documentation

> **⚠️ Prototype Disclaimer**: CareDock AI is a healthcare monitoring prototype for post-discharge patient tracking. It is **not** a clinically validated diagnostic system. The ML models were trained on synthetic data. No predictions should be used as medical advice. Always consult a qualified medical professional.

---

## ML Pipeline Architecture

```
Patient / ESP32 data
        ↓
PostgreSQL (MedicineHistory, ActivityLog, etc.)
        ↓
feature_service.py  ← builds 5 features from real DB records
        ↓
risk_engine.evaluate(features)
        ↓
  XGBoost        → risk_level, risk_probability
  Isolation Forest → is_anomaly
  Decision Tree  → recommendation (path-based explanation)
        ↓
RecoveryScore persisted to DB
        ↓
alert_service.py  ← deduplicating alert generation
        ↓
FastAPI Routers  → JSON responses
        ↓
React Dashboards
```

---

## Feature Definitions

All five features are computed server-side from actual patient records. The frontend never submits raw feature vectors.

| Feature | Calculation | Fallback |
|---|---|---|
| `medicine_adherence_percent` | `(taken_doses / total_doses) * 100` over last 7 days | `100.0` if no history |
| `activity_score` | `100 - (avg_inactivity_minutes / 4.0)`, floored at 0 | `100.0` if no activity data |
| `missed_medicine_count_7d` | Count of `MedicineHistory` rows with `missed=True` in last 7 days | `0` if no history |
| `inactivity_minutes_avg` | `AVG(ActivityLog.inactivity_minutes)` over last 7 days | `0.0` if no logs |
| `recovery_history_score` | Most recent `RecoveryScore.prototype_recovery_score` | `70.0` documented default |

---

## Model Responsibilities

### XGBoost Classifier (`xgb_risk_model.joblib`)
- **Input**: 5-feature vector
- **Output**: `risk_level` (low / medium / high) + `risk_probability` (0-1)
- **Trained on**: Synthetic data (3000 samples, rule-derived labels)
- **Limitation**: Labels derived from same rules used for features → prototype-grade only

### Isolation Forest (`isolation_forest.joblib`)
- **Input**: 5-feature vector
- **Output**: `is_anomaly` (bool)
- **Purpose**: Detect unusual patterns distinct from normal population
- **Important**: Anomaly ≠ High Risk. They are independent signals.

### Decision Tree (`decision_tree.joblib`)
- **Input**: 5-feature vector
- **Output**: Decision path → dominant feature → targeted recommendation text
- **Note**: The Decision Tree was trained to predict `risk_level`, same as XGBoost. Its purpose here is **explainability** — tracing which feature split first is most influential for a given patient.

---

## Prototype Recovery Score

The `prototype_recovery_score` (0-100) is **NOT** a medically validated recovery metric. It is a display convenience derived from risk level:

| Risk Level | Prototype Score |
|---|---|
| low | 85 |
| medium | 60 |
| high | 30 |

The actual probabilistic model output (`risk_probability`) is also surfaced separately for transparency.

---

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/ml/{patient_id}/predict-risk` | Compute + persist full ML evaluation |
| `GET` | `/api/ml/{patient_id}/history` | Historical recovery score trajectory |
| `POST` | `/api/ml/{patient_id}/recompute-risk` | Legacy alias for `predict-risk` |
| `POST` | `/api/esp32/ingest` | Device telemetry ingestion |
| `GET` | `/api/patient/{patient_id}/dashboard` | Patient dashboard summary |
| `GET` | `/api/patient/{patient_id}/recovery-scores` | Full recovery score history |
| `GET` | `/api/doctor/patients` | Doctor's patient roster |
| `GET` | `/api/doctor/high-risk-patients` | DB-driven high-risk list |

---

## Data Flow: ESP32 → ML

```
ESP32 POST /api/esp32/ingest
        ↓
Persist: MedicineHistory (taken/missed), ActivityLog (PIR), Alert (SOS)
        ↓
Lightweight anomaly check (Isolation Forest on telemetry snapshot)
        ↓
If anomaly: alert_service.create_alert() [with 12h deduplication]
        ↓
Return hardware instructions (LED color, OLED, buzzer)

→ Full ML risk evaluation happens separately on-demand via /api/ml/{id}/predict-risk
```

---

## Alert System

Alerts are generated from multiple independent sources:

| Source | Type | Severity |
|---|---|---|
| SOS button | `sos` | critical |
| Missed medication (schedule window) | `missed_medicine` | medium |
| Isolation Forest anomaly | `anomaly` | high |
| XGBoost high risk | `high_risk` | critical |

**Deduplication**: `alert_service.create_alert()` checks for an identical unresolved alert within the last 12 hours before creating a new one. This prevents dashboard flooding on repeated polling.

---

## Training Pipeline Notes (train_models.py)

- **Dataset**: Synthetic (3000 patients, `generate_synthetic_dataset()`)
- **Label generation**: Rule-based formula on the same 5 features → **Target Leakage** present
- **Train/test split**: 80/20 stratified
- **No external validation dataset**: All metrics are in-sample

### Known Limitations
1. **Target leakage**: Labels derived from same feature formula → XGBoost learns the rule, not a real clinical pattern
2. **No patient-level split**: Rows are individual readings, not unique patients
3. **No temporal validation**: No held-out time period for backtesting
4. **Synthetic data**: No real post-discharge patient outcomes were used

These are documented prototype limitations. For production use, real labelled clinical data with proper temporal validation would be required.

---

## Ollama / Gemma Role

Ollama/Gemma is used **only** as a natural language explainer:
- Explains what an alert means
- Summarizes adherence trends
- Answers general health questions
- Encourages contacting care team

Gemma does **NOT** determine risk level, override XGBoost/Isolation Forest, or make diagnostic decisions.

---

## Safety Limitations

- No recommendations constitute medical advice
- No diagnoses are made
- "Prototype Recovery Score" is explicitly labeled as non-clinical
- Anomaly and risk are surfaced as separate, independent signals
- All recommendations encourage contacting the care team for clinical concerns
