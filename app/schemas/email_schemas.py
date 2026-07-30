from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional

class SendEmailSchema(BaseModel):
    to: List[EmailStr]
    subject: str = Field(..., min_length=1)
    html: Optional[str] = None
    text: Optional[str] = None

class OtpSchema(BaseModel):
    email: EmailStr
    purpose: Optional[str] = "registration"

class WelcomeSchema(BaseModel):
    email: EmailStr
    name: Optional[str] = None

class VerifySchema(BaseModel):
    email: EmailStr
    token: str

class ResetPasswordSchema(BaseModel):
    email: EmailStr
    token: str

class ContactSchema(BaseModel):
    name: str
    email: EmailStr
    message: str

class NewsletterSchema(BaseModel):
    subject: str
    html: Optional[str] = None
    text: Optional[str] = None
