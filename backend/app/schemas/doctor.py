from typing import Optional
from pydantic import BaseModel

class DoctorCreate(BaseModel):
    user_id: Optional[int] = None
    specialization: Optional[str] = None
    license_number: Optional[str] = None
    hospital_id: Optional[int] = None

class DoctorUpdate(BaseModel):
    specialization: Optional[str] = None
    license_number: Optional[str] = None

class DoctorOut(DoctorCreate):
    id: int
    user_id: int

    class Config:
        from_attributes = True
