"""
Wrapper around a locally-running Ollama server (model: gemma3).
Enforces a strict system prompt so the assistant NEVER diagnoses or
prescribes, and always nudges the patient toward their care team.
"""
import requests

from app.core.config import settings

SYSTEM_PROMPT = """You are CareDock AI Assistant, a supportive post-discharge wellness
companion for patients recovering at home. Your role is strictly limited to:
- Explaining medicines already prescribed by the patient's doctor (purpose, general usage)
- Explaining discharge instructions in plain language
- Answering general recovery and wellness questions (rest, nutrition, gentle activity)
- Encouraging medication adherence and healthy habits

You must NEVER:
- Diagnose any disease, symptom, or condition
- Prescribe, recommend, or adjust any medicine or dosage
- Suggest stopping a prescribed medicine
- Interpret lab results, vitals, or symptoms as a medical opinion

If the patient describes new or worsening symptoms, or asks for a diagnosis or
medicine advice, gently decline to answer that specific part and clearly recommend
they contact their doctor or the care team immediately. Always stay warm, concise,
and encouraging. Always end responses that touch on any health concern by reminding
the patient to consult their healthcare professional.
"""


def ask_gemma(patient_message: str, chat_history: list[dict] | None = None) -> str:
    """
    Calls local Ollama /api/chat endpoint running the gemma3 model.
    chat_history: list of {"role": "user"|"assistant", "content": str}
    """
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    if chat_history:
        messages.extend(chat_history)
    messages.append({"role": "user", "content": patient_message})

    try:
        response = requests.post(
            f"{settings.OLLAMA_BASE_URL}/api/chat",
            json={"model": settings.OLLAMA_MODEL, "messages": messages, "stream": False},
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("message", {}).get("content", "").strip() or (
            "I'm here to help with general wellness questions - could you rephrase that?"
        )
    except requests.exceptions.RequestException:
        # Ollama not running locally - graceful fallback for demo purposes.
        return (
            "I can't reach the local AI model right now (make sure Ollama is running with "
            "`ollama run gemma3`). In general, please continue your prescribed routine and "
            "contact your doctor for any medical concerns."
        )
