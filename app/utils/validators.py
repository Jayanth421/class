from pydantic import EmailStr


def is_valid_email(value: str) -> bool:
    try:
        EmailStr.validate(value)
        return True
    except Exception:
        return False
