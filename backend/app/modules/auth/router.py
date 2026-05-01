from fastapi import APIRouter, Depends, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.session import get_db
from app.modules.auth import service
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RegisterRequest,
    ResetPasswordRequest,
    SendOTPRequest,
    TokenResponse,
    UserResponse,
    VerifyEmailRequest,
    VerifyOTPRequest,
)

router = APIRouter()


@router.post(
    "/register",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    payload: RegisterRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> MessageResponse:
    await service.register_user(db, payload)
    return MessageResponse(
        message="Registration successful. Check your email to verify your account."
    )


@router.post("/login", response_model=TokenResponse)
async def login(
    payload: LoginRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> TokenResponse:
    return await service.login_with_email(db, payload)


@router.get("/verify-email", response_model=MessageResponse)
async def verify_email_from_link(
    token: str = Query(..., min_length=20, max_length=255),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> MessageResponse:
    await service.verify_email_token(db, token)
    return MessageResponse(message="Email verified successfully.")


@router.post("/verify-email", response_model=MessageResponse)
async def verify_email(
    payload: VerifyEmailRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> MessageResponse:
    await service.verify_email_token(db, payload.token)
    return MessageResponse(message="Email verified successfully.")


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(
    payload: ForgotPasswordRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> MessageResponse:
    await service.forgot_password(db, payload)
    return MessageResponse(
        message="If an account exists for that email, a reset link has been sent."
    )


@router.post("/reset-password", response_model=MessageResponse)
async def reset_password(
    payload: ResetPasswordRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> MessageResponse:
    await service.reset_password(db, payload)
    return MessageResponse(message="Password has been reset successfully.")


@router.post("/send-otp", response_model=MessageResponse)
async def send_otp(
    payload: SendOTPRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> MessageResponse:
    await service.send_otp(db, payload)
    return MessageResponse(message="OTP code sent.")


@router.post("/verify-otp", response_model=TokenResponse)
async def verify_otp(
    payload: VerifyOTPRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> TokenResponse:
    return await service.verify_otp(db, payload)


@router.get("/me", response_model=UserResponse)
async def me(current_user: service.UserDocument = Depends(service.get_current_user)) -> service.UserDocument:
    return current_user
