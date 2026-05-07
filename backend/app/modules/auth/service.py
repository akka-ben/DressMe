import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from smtplib import SMTPException
from typing import Any
from uuid import uuid4

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from motor.motor_asyncio import AsyncIOMotorDatabase
from pymongo.errors import DuplicateKeyError

from app.core.config import settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.modules.auth.email_service import email_service
from app.modules.auth.sms_service import sms_service
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    SendOTPRequest,
    TokenResponse,
    UserResponse,
    VerifyOTPRequest,
)


UserDocument = dict[str, Any]
bearer_scheme = HTTPBearer(auto_error=False)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def as_aware_utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def generate_secure_token() -> str:
    return secrets.token_urlsafe(48)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def generate_otp_code() -> str:
    upper_bound = 10**settings.otp_length
    return f"{secrets.randbelow(upper_bound):0{settings.otp_length}d}"


def normalize_user(document: UserDocument | None) -> UserDocument | None:
    if not document:
        return None
    document["id"] = str(document.get("id") or document.get("_id"))
    return document


def build_token_response(user: UserDocument) -> TokenResponse:
    token, expires_at = create_access_token(user["id"])
    expires_in = max(0, int((expires_at - utc_now()).total_seconds()))
    return TokenResponse(
        access_token=token,
        expires_at=expires_at,
        expires_in=expires_in,
        user=UserResponse.model_validate(user),
    )


async def find_user_by_email(db: AsyncIOMotorDatabase, email: str) -> UserDocument | None:
    return normalize_user(await db.users.find_one({"email": email.lower()}))


async def find_user_by_phone(db: AsyncIOMotorDatabase, phone_number: str) -> UserDocument | None:
    return normalize_user(await db.users.find_one({"phone_number": phone_number}))


async def register_user(db: AsyncIOMotorDatabase, payload: RegisterRequest) -> UserDocument:
    if await find_user_by_email(db, payload.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        )

    raw_verification_token = generate_secure_token()
    now = utc_now()
    user_id = str(uuid4())
    user: UserDocument = {
        "_id": user_id,
        "id": user_id,
        "first_name": payload.first_name,
        "last_name": payload.last_name,
        "email": payload.email,
        "phone_number": None,
        "password_hash": hash_password(payload.password),
        "is_verified": False,
        "otp_code": None,
        "otp_expiration": None,
        "reset_token": None,
        "reset_token_expiration": None,
        "verification_token": hash_token(raw_verification_token),
        "verification_token_expiration": now
        + timedelta(hours=settings.email_verification_token_expire_hours),
        "avatar_url": None,
        "bio": None,
        "created_at": now,
        "updated_at": now,
    }

    try:
        await db.users.insert_one(user)
    except DuplicateKeyError as exc:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        ) from exc

    try:
        await email_service.send_verification_email(payload.email, raw_verification_token)
    except (OSError, SMTPException) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Registration succeeded, but verification email could not be sent",
        ) from exc

    return user


async def login_with_email(db: AsyncIOMotorDatabase, payload: LoginRequest) -> TokenResponse:
    user = await find_user_by_email(db, payload.email)
    if not user or not verify_password(payload.password, user.get("password_hash")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.get("is_verified"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email address is not verified",
        )

    return build_token_response(user)


async def verify_email_token(db: AsyncIOMotorDatabase, token: str) -> UserDocument:
    user = normalize_user(
        await db.users.find_one({"verification_token": hash_token(token)})
    )
    expires_at = as_aware_utc(user.get("verification_token_expiration")) if user else None

    if not user or not expires_at or expires_at < utc_now():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token",
        )

    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"is_verified": True, "updated_at": utc_now()},
            "$unset": {"verification_token": "", "verification_token_expiration": ""},
        },
    )
    updated = normalize_user(await db.users.find_one({"_id": user["_id"]}))
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return updated


async def forgot_password(db: AsyncIOMotorDatabase, payload: ForgotPasswordRequest) -> None:
    user = await find_user_by_email(db, payload.email)
    if not user:
        return

    raw_reset_token = generate_secure_token()
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "reset_token": hash_token(raw_reset_token),
                "reset_token_expiration": utc_now()
                + timedelta(minutes=settings.password_reset_token_expire_minutes),
                "updated_at": utc_now(),
            }
        },
    )

    try:
        await email_service.send_password_reset_email(payload.email, raw_reset_token)
    except (OSError, SMTPException) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password reset email could not be sent",
        ) from exc


async def reset_password(db: AsyncIOMotorDatabase, payload: ResetPasswordRequest) -> UserDocument:
    user = normalize_user(await db.users.find_one({"reset_token": hash_token(payload.token)}))
    expires_at = as_aware_utc(user.get("reset_token_expiration")) if user else None

    if not user or not expires_at or expires_at < utc_now():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token",
        )

    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password_hash": hash_password(payload.new_password),
                "updated_at": utc_now(),
            },
            "$unset": {"reset_token": "", "reset_token_expiration": ""},
        },
    )
    updated = normalize_user(await db.users.find_one({"_id": user["_id"]}))
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return updated


async def send_otp(db: AsyncIOMotorDatabase, payload: SendOTPRequest) -> None:
    user = await find_user_by_phone(db, payload.phone_number)
    otp_code = generate_otp_code()
    now = utc_now()
    otp_update = {
        "otp_code": hash_password(otp_code),
        "otp_expiration": now + timedelta(minutes=settings.otp_expire_minutes),
        "updated_at": now,
    }

    if user:
        await db.users.update_one({"_id": user["_id"]}, {"$set": otp_update})
    else:
        user_id = str(uuid4())
        try:
            await db.users.insert_one(
                {
                    "_id": user_id,
                    "id": user_id,
                    "first_name": None,
                    "last_name": None,
                    "email": None,
                    "phone_number": payload.phone_number,
                    "password_hash": None,
                    "is_verified": False,
                    "reset_token": None,
                    "reset_token_expiration": None,
                    "verification_token": None,
                    "verification_token_expiration": None,
                    "avatar_url": None,
                    "bio": None,
                    "created_at": now,
                    **otp_update,
                }
            )
        except DuplicateKeyError as exc:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Phone number is already registered",
            ) from exc

    await sms_service.send_otp(payload.phone_number, otp_code)


async def verify_otp(db: AsyncIOMotorDatabase, payload: VerifyOTPRequest) -> TokenResponse:
    user = await find_user_by_phone(db, payload.phone_number)
    expires_at = as_aware_utc(user.get("otp_expiration")) if user else None

    if (
        not user
        or not user.get("otp_code")
        or not expires_at
        or expires_at < utc_now()
        or not verify_password(payload.otp_code, user["otp_code"])
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP code",
        )

    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {"is_verified": True, "updated_at": utc_now()},
            "$unset": {"otp_code": "", "otp_expiration": ""},
        },
    )
    updated = normalize_user(await db.users.find_one({"_id": user["_id"]}))
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return build_token_response(updated)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> UserDocument:
    auth_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise auth_error

    try:
        payload = decode_access_token(credentials.credentials)
        user_id = payload.get("sub") or payload.get("user_id")
        if not user_id:
            raise auth_error
    except JWTError as exc:
        raise auth_error from exc

    user = normalize_user(await db.users.find_one({"_id": str(user_id)}))
    if not user:
        raise auth_error
    return user

async def change_password(
    db: AsyncIOMotorDatabase,
    current_user: UserDocument,
    current_password: str,
    new_password: str,
) -> None:
    if not verify_password(current_password, current_user.get("password_hash")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Mot de passe actuel incorrect",
        )
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"password_hash": hash_password(new_password), "updated_at": utc_now()}},
    )
