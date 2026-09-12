"""
Schemas for ESP32 device payloads and chatbot interaction.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class ESP32Payload(BaseModel):
    device_id: str
    device_secret: str
    weight_grams: Optional[float] = None
    medicine_taken_button: bool = False
    pir_motion: bool = False
    sos_pressed: bool = False
    timestamp: Optional[datetime] = None


class ESP32Response(BaseModel):
    buzzer: bool = False
    led_color: str = "green"  # green | yellow | red
    oled_message: str = "All good"
    alert_triggered: bool = False


class ChatRequest(BaseModel):
    patient_id: int
    message: str


class ChatResponse(BaseModel):
    reply: str
