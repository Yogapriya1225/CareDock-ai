from typing import Optional
from pydantic import BaseModel

class CaregiverCreate(BaseModel):
    user_id: Optional[int] = None
    relationship_to_patient: Optional[str] = None

class CaregiverUpdate(BaseModel):
    relationship_to_patient: Optional[str] = None

class CaregiverOut(CaregiverCreate):
    id: int
    user_id: int

    class Config:
        from_attributes = True
