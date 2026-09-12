"""
Chatbot endpoint: patient <-> Gemma 3 (via Ollama), with persisted history.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.monitoring import ChatMessage
from app.schemas.device import ChatRequest, ChatResponse
from app.services.ollama_service import ask_gemma

router = APIRouter(prefix="/api/chatbot", tags=["Chatbot"])


@router.post("/ask", response_model=ChatResponse)
def ask(payload: ChatRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    history_rows = (
        db.query(ChatMessage)
        .filter(ChatMessage.patient_id == payload.patient_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(10)
        .all()
    )
    history = [{"role": m.role, "content": m.message} for m in reversed(history_rows)]

    reply = ask_gemma(payload.message, history)

    db.add(ChatMessage(patient_id=payload.patient_id, role="user", message=payload.message))
    db.add(ChatMessage(patient_id=payload.patient_id, role="assistant", message=reply))
    db.commit()

    return ChatResponse(reply=reply)


@router.get("/{patient_id}/history")
def get_chat_history(patient_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return (
        db.query(ChatMessage)
        .filter(ChatMessage.patient_id == patient_id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
