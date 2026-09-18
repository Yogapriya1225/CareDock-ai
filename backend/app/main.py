"""
CareDock AI - FastAPI application entrypoint.
Run with: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.database import Base, engine
import app.models  # noqa: F401  (ensures all models register with Base.metadata)

from app.routers import auth, patient, doctor, caregiver, admin, esp32, ml, chatbot

app = FastAPI(
    title="CareDock AI",
    description="Smart Post-Discharge Patient Monitoring System",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    # For a hackathon demo, auto-create tables. In production, use Alembic migrations instead.
    Base.metadata.create_all(bind=engine)


@app.get("/")
def root():
    return {"status": "ok", "service": "CareDock AI Backend"}


@app.get("/health")
def health_check():
    return {"status": "healthy"}


app.include_router(auth.router)
app.include_router(patient.router)
app.include_router(doctor.router)
app.include_router(caregiver.router)
app.include_router(admin.router)
app.include_router(esp32.router)
app.include_router(ml.router)
app.include_router(chatbot.router)
