# CareDock AI — Smart Post-Discharge Patient Monitoring System

A full-stack healthcare monitoring platform pairing an **ESP32-based smart medicine box**
with an **AI-powered web application** to track medication adherence, patient activity,
and recovery risk after hospital discharge — while explicitly discouraging
self-diagnosis in favor of contacting real healthcare professionals.

---

## 1. What's in this folder

```
caredock-ai/
├── backend/            FastAPI application (auth, models, APIs, ML integration)
│   ├── app/
│   │   ├── core/       config, database session, security (JWT/bcrypt), RBAC deps
│   │   ├── models/     SQLAlchemy tables (users, patients, medicine, alerts, etc.)
│   │   ├── schemas/    Pydantic request/response schemas
│   │   ├── routers/    API endpoints per domain (auth, patient, doctor, caregiver,
│   │   │               admin, esp32, ml, chatbot)
│   │   ├── services/   Ollama/Gemma 3 chatbot service
│   │   └── ml/         Risk engine wrapper + trained model artifacts
│   ├── requirements.txt
│   └── .env.example
├── frontend/           React + Vite + Tailwind SPA
│   └── src/
│       ├── pages/      landing, login/register, patient/doctor/caregiver/admin dashboards
│       ├── components/ Navbar, DashboardLayout, shared UI, ProtectedRoute
│       ├── context/    AuthContext (JWT session state)
│       └── api/        Axios client + endpoint helpers
├── ml/                 Synthetic data generator + model training script
│   ├── train_models.py
│   └── data/
├── esp32-firmware/     Arduino .ino firmware for the smart medicine box
├── docker/             Dockerfiles for backend & frontend
├── docker-compose.yml  One-command local stack (Postgres + backend + frontend)
├── database/           (reserved for SQL migration scripts / seed data)
└── docs/               Additional documentation
```

---

## 2. Tech stack (as specified)

| Layer      | Technology |
|------------|------------|
| Frontend   | React.js, Vite, Tailwind CSS, React Router DOM, Axios, React Hook Form, Recharts, Framer Motion |
| Backend    | Python, FastAPI, SQLAlchemy ORM, Pydantic, JWT, bcrypt, Uvicorn |
| Database   | PostgreSQL |
| ML         | Scikit-learn, XGBoost, Isolation Forest, Decision Tree |
| LLM        | Ollama + Gemma 3 (fully local, no API keys, no paid services) |
| Hardware   | ESP32 WROOM, HX711 + load cell, DS3231 RTC, OLED, buzzer, RGB LEDs, push buttons, PIR sensor |

Everything runs locally — no OpenAI/Gemini API keys are used anywhere.

---

## 3. What is fully implemented vs. what you need to finish

### ✅ Fully implemented and tested
- **Auth**: register/login, JWT issuance, bcrypt hashing, `/api/auth/me`, role-based
  access control (`patient`, `doctor`, `caregiver`, `admin`) — verified end-to-end.
- **Database models**: all 15 tables from the spec (Users, Patients, Doctors,
  Caregivers, Medicine Schedule/History/Compliance, Activity Logs, Recovery Scores,
  Alerts, Recommendations, Appointments, Chat History, Emergency Contacts (fields on
  Patient), Hospitals, Audit Logs).
- **ESP32 ingestion API** (`/api/esp32/ingest`): authenticates the device by shared
  secret, logs medicine-taken/missed events, activity from PIR, raises SOS alerts,
  runs anomaly detection, and returns buzzer/LED/OLED control instructions.
- **ML risk engine**: XGBoost (recovery risk classification), Isolation Forest
  (anomaly detection), and a Decision Tree (explainable recommendation text) —
  trained on a generated synthetic dataset and verified working (~95% test accuracy).
  A transparent rule-based fallback runs automatically if model artifacts are ever
  missing, so the API never breaks.
- **Ollama/Gemma 3 chatbot**: strict system prompt that explains medicines/discharge
  instructions but refuses to diagnose or prescribe, and always redirects medical
  concerns to the patient's care team. Includes a friendly fallback message if Ollama
  isn't running.
- **Frontend**: builds cleanly with `npm run build`. Landing page (hero, overview,
  features, how-it-works, hardware, AI features, dashboard previews, benefits,
  testimonials, contact, footer), login/register, and all four role dashboards
  (Patient, Doctor, Caregiver, Admin) wired to real API calls with loading/empty/error
  states and Recharts visualizations.
- **ESP32 firmware**: complete `.ino` sketch wiring all listed sensors/actuators to
  the backend's ingestion endpoint.

### 🔧 You will need to finish for a production deployment
1. **Patient/Doctor/Caregiver profile creation flow in the UI.** The backend supports
   creating these profiles (`POST /api/patient/`, admin/doctor endpoints), but there's
   no admin UI screen yet to create hospitals, assign doctors/caregivers to patients,
   or link a `device_id` to a patient. Today this is easiest to do via the
   interactive API docs at `http://localhost:8000/docs`.
2. **Resolving "my patient/caregiver ID" from the logged-in user.** The dashboards
   currently assume `patient_id`/`caregiver_id` of `1` for demo purposes (see the
   `NOTE` comments in `PatientDashboard.jsx` and `CaregiverDashboard.jsx`). Add a
   `/api/patient/by-user/{user_id}` lookup (trivial addition to `patient.py`) and
   wire it into `AuthContext` once you have real multi-patient data.
3. **Alembic migrations.** The backend currently calls `Base.metadata.create_all()`
   on startup for hackathon speed. For production, initialize Alembic
   (`alembic init alembic`) and generate real migrations instead.
4. **Recurring recovery-score computation.** `POST /api/ml/{patient_id}/recompute-risk`
   is manual/on-demand right now (also triggerable from the Patient dashboard button).
   Wire it to a scheduled job (e.g. APScheduler or a cron container) to run nightly
   per patient automatically.
5. **Per-device provisioning security.** The ESP32 shared-secret model is
   intentionally simple for a hackathon. For real deployments, issue each device its
   own signed token/certificate instead of one global secret.
6. **Real hospital/doctor/caregiver assignment UI** in the Admin dashboard (currently
   read-only lists + hospital creation only).

---

## 4. Running it locally (fastest path)

### Option A — Docker Compose (recommended)
```bash
docker compose up --build
```
This starts Postgres, the FastAPI backend (port 8000), and the built frontend
(port 5173, served via nginx). Then visit `http://localhost:5173`.

> Ollama runs on your host machine, not in Docker, since it needs GPU/CPU access to
> the local model. See section 6.

### Option B — Manual (better for active development)

**1. Database**
```bash
docker run --name caredock_db -e POSTGRES_USER=caredock -e POSTGRES_PASSWORD=caredock \
  -e POSTGRES_DB=caredock_db -p 5432:5432 -d postgres:16-alpine
```

**2. Backend**
```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # edit values if needed
uvicorn app.main:app --reload --port 8000
```
Visit `http://localhost:8000/docs` for interactive Swagger API docs.

**3. Train the ML models** (once — creates the joblib artifacts the backend loads)
```bash
cd ml
pip install pandas scikit-learn xgboost joblib
python train_models.py
```
This writes `xgb_risk_model.joblib`, `isolation_forest.joblib`, and
`decision_tree.joblib` into `backend/app/ml/artifacts/`. Re-run any time you want to
retrain on new data.

**4. Frontend**
```bash
cd frontend
npm install
cp .env.example .env   # points to your backend URL
npm run dev
```
Visit `http://localhost:5173`.

---

## 5. Connecting your ESP32 hardware

1. Open `esp32-firmware/CareDockBox.ino` in the Arduino IDE (or PlatformIO).
2. Install libraries: `HX711`, `RTClib`, `Adafruit_SSD1306`, `Adafruit_GFX`,
   `ArduinoJson` (via Library Manager).
3. Edit the config block at the top of the file:
   ```cpp
   const char* WIFI_SSID     = "YOUR_WIFI_SSID";
   const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
   const char* BACKEND_URL   = "http://<YOUR_BACKEND_IP>:8000/api/esp32/ingest";
   const char* DEVICE_ID     = "caredock-box-001";
   const char* DEVICE_SECRET = "change_this_device_secret"; // must match backend .env
   ```
   Your backend machine's IP must be reachable from the ESP32's Wi-Fi network (i.e.
   same LAN, or expose via a tunnel for remote testing).
4. Wire components per the pin map documented in the comment header of the `.ino`
   file (HX711, DS3231/OLED share the I2C bus, buzzer, 3 LEDs, 2 buttons, PIR).
5. In the backend, create a `Patient` row with `device_id = "caredock-box-001"`
   (matching step 3) via `POST /api/patient/` or the `/docs` UI, so incoming sensor
   data resolves to the correct patient.
6. Flash the ESP32, open the Serial Monitor at 115200 baud to confirm Wi-Fi connects,
   and watch `/api/esp32/ingest` requests arrive in your backend's uvicorn logs.

The endpoint already implements: SOS alert triggering, medicine-taken/missed
detection, PIR-based activity logging, and anomaly-triggered alerts, returning
`buzzer` / `led_color` / `oled_message` fields the firmware applies to the hardware.

---

## 6. Setting up Ollama + Gemma 3 (chatbot)

```bash
# Install Ollama: https://ollama.com/download
ollama pull gemma3
ollama run gemma3   # leaves a local server running on :11434
```
The backend's `OLLAMA_BASE_URL` (default `http://localhost:11434`) and
`OLLAMA_MODEL` (default `gemma3`) in `.env` should match. If Ollama isn't running,
the chatbot endpoint still responds gracefully with a fallback message instead of
crashing — useful during demos.

---

## 7. Default test credentials

There are no seeded users. Create your first users via the Register page (or
`POST /api/auth/register`), e.g.:
- One `admin` account first (create hospitals, oversee the system)
- One `doctor` account (gets assigned patients)
- One `patient` account, then create a linked `Patient` profile via
  `POST /api/patient/` with that user's `user_id` (requires doctor/admin token)
- One `caregiver` account, similarly linked

---

## 8. Security notes

- JWTs expire after `ACCESS_TOKEN_EXPIRE_MINUTES` (default 24h) — configurable in `.env`.
- Passwords are hashed with bcrypt (never stored in plaintext).
- All non-auth endpoints require a valid bearer token; role-sensitive endpoints use
  `require_roles(...)` guards.
- The ESP32 shared secret in `.env` (`ESP32_SHARED_SECRET`) must match the firmware's
  `DEVICE_SECRET` constant — treat it like a password.
- **Change all default secrets in `.env` before any real-world deployment.**

---

## 9. AI safety guardrails (chatbot)

The Gemma 3 system prompt (`backend/app/services/ollama_service.py`) explicitly
instructs the model to:
- Explain already-prescribed medicines and discharge instructions
- Answer general wellness/recovery questions
- **Never** diagnose, prescribe, or interpret symptoms/vitals/labs
- Always redirect medical concerns to the patient's doctor or care team

This is prompt-level guidance, not a hard technical guarantee — for a clinical
deployment, add output-side keyword/intent filtering as an additional safety layer.

---

## 10. License / disclaimer

This is a hackathon-grade reference implementation, not a certified medical device
or HIPAA-compliant system. Do not use it to make real clinical decisions without
substantial additional security, compliance, and clinical validation work.
