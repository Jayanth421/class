from pydantic import BaseModel
from typing import Optional

class OtpEntry(BaseModel):
    email: str
    otp: str
    expires_at: float
    purpose: Optional[str] = None
