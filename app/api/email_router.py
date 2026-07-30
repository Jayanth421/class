from fastapi import APIRouter, HTTPException, Depends
from app.schemas.email_schemas import (
    SendEmailSchema,
    OtpSchema,
    WelcomeSchema,
    VerifySchema,
    ResetPasswordSchema,
    ContactSchema,
    NewsletterSchema,
)
from app.services.email_service import EmailService
from app.config.settings import settings

router = APIRouter()
service = EmailService(api_key=settings.RESEND_API_KEY, default_from=settings.RESEND_FROM)


@router.post("/send")
async def send_email(payload: SendEmailSchema):
    try:
        result = await service.send_email(payload)
        return {"ok": True, "result": result}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/otp")
async def send_otp(payload: OtpSchema):
    try:
        result = await service.send_otp(payload.email, purpose=payload.purpose)
        return {"ok": True, "result": result}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/welcome")
async def send_welcome(payload: WelcomeSchema):
    try:
        result = await service.send_welcome(payload.email, name=payload.name)
        return {"ok": True, "result": result}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/verify")
async def send_verify(payload: VerifySchema):
    try:
        result = await service.send_verify(payload.email, token=payload.token)
        return {"ok": True, "result": result}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/reset-password")
async def send_reset(payload: ResetPasswordSchema):
    try:
        result = await service.send_reset_password(payload.email, token=payload.token)
        return {"ok": True, "result": result}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/contact")
async def contact(payload: ContactSchema):
    try:
        result = await service.send_contact(payload)
        return {"ok": True, "result": result}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.post("/newsletter")
async def newsletter(payload: NewsletterSchema):
    try:
        result = await service.send_newsletter(payload)
        return {"ok": True, "result": result}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc))
