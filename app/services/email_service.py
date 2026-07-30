import logging
import time
import asyncio
from typing import List, Optional

from resend import Resend
from jinja2 import Environment, FileSystemLoader, select_autoescape

from app.config.settings import settings
from app.schemas.email_schemas import SendEmailSchema

logger = logging.getLogger("email_service")

# Simple in-memory OTP store: {email: (otp, expires_at)}
_otp_store = {}

env = Environment(
    loader=FileSystemLoader("app/templates"),
    autoescape=select_autoescape(["html", "xml"]),
)

class EmailService:
    def __init__(self, api_key: str, default_from: str):
        self.client = Resend(api_key)
        self.default_from = default_from

    async def send_email(self, payload: SendEmailSchema):
        message = {
            "from": self.default_from,
            "to": payload.to,
            "subject": payload.subject,
            "html": payload.html or payload.text or "",
            "text": payload.text or "",
        }
        return await asyncio.to_thread(self._send_sync, message)

    def _send_sync(self, message: dict):
        logger.debug("Sending email via Resend: %s", {"to": message.get("to")})
        resp = self.client.emails.send(
            from_email=message["from"],
            to=message["to"],
            subject=message["subject"],
            html=message.get("html"),
            text=message.get("text"),
        )
        return {"ok": True, "id": getattr(resp, "id", None)}

    async def send_otp(self, email: str, purpose: str = "registration"):
        otp = f"{int(time.time()) % 1000000:06d}"
        expires_at = time.time() + settings.OTP_TTL_SECONDS
        _otp_store[email] = (otp, expires_at, purpose)

        template = env.get_template("otp.html")
        html = template.render(otp=otp, ttl=settings.OTP_TTL_SECONDS, purpose=purpose)
        subject = f"Your OTP for {purpose}"

        return await self.send_email(SendEmailSchema(to=[email], subject=subject, html=html))

    async def verify_otp(self, email: str, token: str):
        entry = _otp_store.get(email)
        if not entry:
            return {"ok": False, "error": "OTP not found"}
        otp, expires_at, purpose = entry
        if time.time() > expires_at:
            del _otp_store[email]
            return {"ok": False, "error": "OTP expired"}
        if token != otp:
            return {"ok": False, "error": "Invalid OTP"}
        del _otp_store[email]
        return {"ok": True}

    async def send_welcome(self, email: str, name: Optional[str] = None):
        template = env.get_template("welcome.html")
        html = template.render(name=name or "")
        subject = "Welcome to CMR Smart Presentation Portal"
        return await self.send_email(SendEmailSchema(to=[email], subject=subject, html=html))

    async def send_verify(self, email: str, token: str):
        template = env.get_template("verify.html")
        html = template.render(token=token)
        subject = "Verify your email"
        return await self.send_email(SendEmailSchema(to=[email], subject=subject, html=html))

    async def send_reset_password(self, email: str, token: str):
        template = env.get_template("reset.html")
        html = template.render(token=token)
        subject = "Reset your password"
        return await self.send_email(SendEmailSchema(to=[email], subject=subject, html=html))

    async def send_contact(self, payload):
        # Send contact form to default_from (admin) and ack to sender
        template_admin = env.get_template("contact_admin.html")
        html_admin = template_admin.render(name=payload.name, email=payload.email, message=payload.message)
        subject_admin = f"Contact form: {payload.name}"
        await self.send_email(SendEmailSchema(to=[self.default_from], subject=subject_admin, html=html_admin))

        template_user = env.get_template("contact_user.html")
        html_user = template_user.render(name=payload.name)
        await self.send_email(SendEmailSchema(to=[payload.email], subject="We received your message", html=html_user))
        return {"ok": True}

    async def send_newsletter(self, payload):
        # payload: subject, html, text
        return await self.send_email(payload)
