# Database Schema — CareDock AI

All tables are defined as SQLAlchemy models under `backend/app/models/`. On backend
startup, `Base.metadata.create_all()` creates any missing tables in the configured
PostgreSQL database (see README section 3 for the note on switching to Alembic for
production).

## Tables

| Table                | Model file             | Purpose |
|----------------------|-------------------------|---------|
| `users`              | `models/user.py`        | Core login identity for all 4 roles |
| `patients`           | `models/profiles.py`    | Patient profile, linked device_id, assigned doctor/caregiver |
| `doctors`            | `models/profiles.py`    | Doctor profile, specialization, hospital link |
| `caregivers`         | `models/profiles.py`    | Caregiver profile, relationship to patient |
| `hospitals`          | `models/profiles.py`    | Hospital directory |
| `medicine_schedules` | `models/medicine.py`    | Recurring dose schedule per patient |
| `medicine_history`   | `models/medicine.py`    | Individual dose events (taken/missed) from ESP32 or manual entry |
| `medicine_compliance`| `models/medicine.py`    | Daily rollup of doses scheduled vs. taken |
| `activity_logs`      | `models/monitoring.py`  | PIR motion readings / inactivity duration |
| `recovery_scores`    | `models/monitoring.py`  | ML-computed risk score + level over time |
| `alerts`             | `models/monitoring.py`  | SOS, missed medicine, inactivity, anomaly alerts |
| `recommendations`    | `models/monitoring.py`  | Decision-tree-generated wellness guidance |
| `appointments`       | `models/monitoring.py`  | Scheduled doctor visits |
| `chat_history`       | `models/monitoring.py`  | Patient <-> Gemma 3 chatbot messages |
| `audit_logs`         | `models/monitoring.py`  | General action audit trail |

Emergency contact fields live directly on `patients` (`emergency_contact_name`,
`emergency_contact_phone`) rather than a separate table, for simplicity — split
this out into its own table if a patient needs multiple emergency contacts.

## Entity relationships (high level)

```
User (1) ── (1) Patient ── (N) MedicineSchedule ── (N) MedicineHistory
                 │
                 ├── (N) ActivityLog
                 ├── (N) RecoveryScore
                 ├── (N) Alert
                 ├── (N) Appointment
                 └── (N) ChatMessage

User (1) ── (1) Doctor ── (N) Patient (assigned_doctor)
User (1) ── (1) Caregiver ── (N) Patient (assigned_caregiver)
Hospital (1) ── (N) Doctor
```

## Adding a migration tool (recommended before production)

```bash
cd backend
pip install alembic
alembic init alembic
# edit alembic/env.py to import Base from app.core.database and app.models
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```
