from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse
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
from pydantic import BaseModel

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


@router.get("/verify-email", response_class=HTMLResponse)
async def verify_email_from_link(
    token: str = Query(..., min_length=20, max_length=255),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> HTMLResponse:
    try:
        user = await service.verify_email_token(db, token)
    except HTTPException as exc:
        return HTMLResponse(
            service.build_auth_result_page(
                title="Lien invalide ou expire",
                message="La verification email ne peut pas etre terminee avec ce lien.",
                tone="error",
                detail=str(exc.detail),
            ),
            status_code=exc.status_code,
        )

    admin_approved = (
        not user.get("requires_admin_approval")
        or user.get("admin_status") == "approved"
    )
    message = (
        "Votre email est confirme et votre compte est accepte. Vous pouvez vous connecter."
        if admin_approved
        else "Votre email est confirme. Votre compte attend maintenant l'acceptation de l'administrateur."
    )
    return HTMLResponse(
        service.build_auth_result_page(
            title="Email confirme",
            message=message,
        )
    )


@router.post("/verify-email", response_model=MessageResponse)
async def verify_email(
    payload: VerifyEmailRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> MessageResponse:
    await service.verify_email_token(db, payload.token)
    return MessageResponse(message="Email verified successfully.")


@router.get("/admin/approve-user", response_class=HTMLResponse)
async def approve_user_from_admin_email(
    token: str = Query(..., min_length=20, max_length=255),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> HTMLResponse:
    try:
        user = await service.approve_user_from_admin_token(db, token)
    except HTTPException as exc:
        return HTMLResponse(
            service.build_auth_result_page(
                title="Lien admin invalide ou expire",
                message="L'acceptation du compte ne peut pas etre terminee avec ce lien.",
                tone="error",
                detail=str(exc.detail),
            ),
            status_code=exc.status_code,
        )

    message = (
        "Compte accepte. L'utilisateur a deja confirme son email et peut maintenant se connecter."
        if user.get("is_verified")
        else "Compte accepte. L'utilisateur doit encore confirmer son email avant de pouvoir se connecter."
    )
    return HTMLResponse(
        service.build_auth_result_page(
            title="Compte accepte",
            message=message,
        )
    )


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

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    payload: ChangePasswordRequest,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: service.UserDocument = Depends(service.get_current_user),
) -> MessageResponse:
    await service.change_password(db, current_user, payload.current_password, payload.new_password)
    return MessageResponse(message="Password changed successfully.")


@router.get("/me", response_model=UserResponse)
async def me(current_user: service.UserDocument = Depends(service.get_current_user)) -> service.UserDocument:
    return current_user
