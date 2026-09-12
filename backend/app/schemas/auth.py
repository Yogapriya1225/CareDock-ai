"""
Pydantic schemas for authentication and user representation.
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr

from app.models.user import UserRole


class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str
    role: UserRole
    phone: Optional[str] = None


class UserOut(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: UserRole
    phone: Optional[str] = None
    is_active: bool
    created_at: datetime
    patient_profile_id: Optional[int] = None
    doctor_profile_id: Optional[int] = None
    caregiver_profile_id: Optional[int] = None

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
