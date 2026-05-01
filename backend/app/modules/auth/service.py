import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from smtplib import SMTPException
import token

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.db.session import get_db
from app.models.user import User
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


def build_token_response(user: User) -> TokenResponse:
    token, expires_at = create_access_token(user.id)
    expires_in = max(0, int((expires_at - utc_now()).total_seconds()))
    return TokenResponse(
        access_token=token,
        expires_at=expires_at,
        expires_in=expires_in,
        user=UserResponse.model_validate(user),
    )


async def find_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email.lower()))
    return result.scalar_one_or_none()


async def find_user_by_phone(db: AsyncSession, phone_number: str) -> User | None:
    result = await db.execute(select(User).where(User.phone_number == phone_number))
    return result.scalar_one_or_none()


async def register_user(db: AsyncSession, payload: RegisterRequest) -> User:
    if await find_user_by_email(db, payload.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        )
    

    raw_verification_token = generate_secure_token()
    user = User(
        first_name=payload.first_name,
        last_name=payload.last_name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        is_verified=False,
        verification_token=hash_token(raw_verification_token),
        verification_token_expiration=utc_now()
        + timedelta(hours=settings.email_verification_token_expire_hours),
    )

    print("TOKEN GENERATED:", raw_verification_token)
    print("HASH STORED:", hash_token(raw_verification_token))

    db.add(user)
    try:
        await db.commit()
        await db.refresh(user)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email is already registered",
        ) from exc

    try:
        await email_service.send_verification_email(user.email, raw_verification_token)
    except (OSError, SMTPException) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Registration succeeded, but verification email could not be sent",
        ) from exc

    return user


async def login_with_email(db: AsyncSession, payload: LoginRequest) -> TokenResponse:
    user = await find_user_by_email(db, payload.email)
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email address is not verified",
        )

    return build_token_response(user)


async def verify_email_token(db: AsyncSession, token: str) -> User:
    result = await db.execute(
        select(User).where(User.verification_token == hash_token(token))
    )

    print("TOKEN RECEIVED:", token)
    print("HASH RECEIVED:", hash_token(token))

    user = result.scalar_one_or_none()
    expires_at = as_aware_utc(user.verification_token_expiration) if user else None

    if not user or not expires_at or expires_at < utc_now():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token",
        )

    user.is_verified = True
    user.verification_token = None
    user.verification_token_expiration = None
    await db.commit()
    await db.refresh(user)
    return user


async def forgot_password(db: AsyncSession, payload: ForgotPasswordRequest) -> None:
    user = await find_user_by_email(db, payload.email)
    if not user:
        return

    raw_reset_token = generate_secure_token()
    user.reset_token = hash_token(raw_reset_token)
    user.reset_token_expiration = utc_now() + timedelta(
        minutes=settings.password_reset_token_expire_minutes
    )
    await db.commit()

    try:
        await email_service.send_password_reset_email(payload.email, raw_reset_token)
    except (OSError, SMTPException) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password reset email could not be sent",
        ) from exc


async def reset_password(db: AsyncSession, payload: ResetPasswordRequest) -> User:
    result = await db.execute(select(User).where(User.reset_token == hash_token(payload.token)))
    user = result.scalar_one_or_none()
    expires_at = as_aware_utc(user.reset_token_expiration) if user else None

    if not user or not expires_at or expires_at < utc_now():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token",
        )

    user.password_hash = hash_password(payload.new_password)
    user.reset_token = None
    user.reset_token_expiration = None
    await db.commit()
    await db.refresh(user)
    return user


async def send_otp(db: AsyncSession, payload: SendOTPRequest) -> None:
    user = await find_user_by_phone(db, payload.phone_number)
    if not user:
        user = User(phone_number=payload.phone_number, is_verified=False)
        db.add(user)

    otp_code = generate_otp_code()
    user.otp_code = hash_password(otp_code)
    user.otp_expiration = utc_now() + timedelta(minutes=settings.otp_expire_minutes)

    try:
        await db.commit()
        await db.refresh(user)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Phone number is already registered",
        ) from exc

    await sms_service.send_otp(payload.phone_number, otp_code)


async def verify_otp(db: AsyncSession, payload: VerifyOTPRequest) -> TokenResponse:
    user = await find_user_by_phone(db, payload.phone_number)
    expires_at = as_aware_utc(user.otp_expiration) if user else None

    if (
        not user
        or not user.otp_code
        or not expires_at
        or expires_at < utc_now()
        or not verify_password(payload.otp_code, user.otp_code)
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OTP code",
        )

    user.otp_code = None
    user.otp_expiration = None
    user.is_verified = True
    await db.commit()
    await db.refresh(user)
    return build_token_response(user)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
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

    user = await db.get(User, str(user_id))
    if not user:
        raise auth_error
    return user
