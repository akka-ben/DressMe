import hashlib
import html
import secrets
from datetime import datetime, timedelta, timezone
from smtplib import SMTPException
from typing import Any
from urllib.parse import quote
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
    raw_admin_approval_token = generate_secure_token()
    now = utc_now()
    token_expiration = now + timedelta(hours=settings.email_verification_token_expire_hours)
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
        "requires_admin_approval": True,
        "admin_status": "pending",
        "admin_approval_token": hash_token(raw_admin_approval_token),
        "admin_approval_token_expiration": token_expiration,
        "otp_code": None,
        "otp_expiration": None,
        "reset_token": None,
        "reset_token_expiration": None,
        "verification_token": hash_token(raw_verification_token),
        "verification_token_expiration": token_expiration,
        "avatar_url": None,
        "bio": None,
        "is_private": False,
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

    approval_url = build_admin_action_url("/auth/admin/approve-user", raw_admin_approval_token)
    await notify_security_email(
        db,
        event_type="account_registration",
        subject="[DressMe Security] Nouvelle creation de compte",
        fields={
            "Evenement": "Creation de compte",
            "User ID": user_id,
            "Nom": f"{payload.first_name} {payload.last_name}".strip(),
            "Email": payload.email,
            "Email verifie": "Non",
            "Statut admin": "En attente",
            "Date": now.isoformat(),
        },
        actions=[
            {
                "label": "Accepter le compte",
                "url": approval_url,
                "kind": "primary",
            }
        ],
    )

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
    if user.get("requires_admin_approval") and user.get("admin_status") != "approved":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is pending admin approval",
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

    verified_at = utc_now()
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "is_verified": True,
                "email_verified_at": verified_at,
                "updated_at": verified_at,
            },
            "$unset": {"verification_token": "", "verification_token_expiration": ""},
        },
    )
    updated = normalize_user(await db.users.find_one({"_id": user["_id"]}))
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    await notify_security_email(
        db,
        event_type="email_verified",
        subject="[DressMe Security] Email utilisateur verifie",
        fields={
            "Evenement": "Verification email",
            "User ID": updated.get("id") or updated.get("_id"),
            "Nom": display_user_name(updated),
            "Email": updated.get("email") or "Non renseigne",
            "Date": utc_now().isoformat(),
        },
        user=updated,
    )
    return updated


async def approve_user_from_admin_token(db: AsyncIOMotorDatabase, token: str) -> UserDocument:
    user = normalize_user(
        await db.users.find_one({"admin_approval_token": hash_token(token)})
    )
    expires_at = as_aware_utc(user.get("admin_approval_token_expiration")) if user else None

    if not user or not expires_at or expires_at < utc_now():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired admin approval token",
        )

    approved_at = utc_now()
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "requires_admin_approval": False,
                "admin_status": "approved",
                "admin_approved_at": approved_at,
                "updated_at": approved_at,
            },
            "$unset": {
                "admin_approval_token": "",
                "admin_approval_token_expiration": "",
            },
        },
    )
    updated = normalize_user(await db.users.find_one({"_id": user["_id"]}))
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    await notify_security_email(
        db,
        event_type="account_approved",
        subject="[DressMe Security] Compte accepte",
        fields={
            "Evenement": "Compte accepte par admin",
            "User ID": updated.get("id") or updated.get("_id"),
            "Nom": display_user_name(updated),
            "Email": updated.get("email") or "Non renseigne",
            "Email verifie": "Oui" if updated.get("is_verified") else "Non",
            "Statut admin": "Approuve",
            "Date": approved_at.isoformat(),
        },
        user=updated,
    )
    return updated


async def forgot_password(db: AsyncIOMotorDatabase, payload: ForgotPasswordRequest) -> None:
    user = await find_user_by_email(db, payload.email)
    if not user:
        await notify_security_email(
            db,
            event_type="password_reset_requested_unknown_email",
            subject="[DressMe Security] Demande reset pour email inconnu",
            fields={
                "Evenement": "Demande de reset mot de passe",
                "Email demande": payload.email,
                "Statut": "Aucun compte trouve",
                "Date": utc_now().isoformat(),
            },
        )
        return

    raw_reset_token = generate_secure_token()
    requested_at = utc_now()
    await db.users.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "reset_token": hash_token(raw_reset_token),
                "reset_token_expiration": requested_at
                + timedelta(minutes=settings.password_reset_token_expire_minutes),
                "updated_at": requested_at,
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

    await notify_security_email(
        db,
        event_type="password_reset_requested",
        subject="[DressMe Security] Demande de reset mot de passe",
        fields={
            "Evenement": "Demande de reset mot de passe",
            "User ID": user.get("id") or user.get("_id"),
            "Nom": display_user_name(user),
            "Email": user.get("email") or payload.email,
            "Expiration lien": (
                requested_at + timedelta(minutes=settings.password_reset_token_expire_minutes)
            ).isoformat(),
            "Date": requested_at.isoformat(),
        },
        user=user,
    )


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
    await notify_security_email(
        db,
        event_type="password_reset_completed",
        subject="[DressMe Security] Mot de passe reinitialise",
        fields={
            "Evenement": "Reset mot de passe termine",
            "User ID": updated.get("id") or updated.get("_id"),
            "Nom": display_user_name(updated),
            "Email": updated.get("email") or "Non renseigne",
            "Date": utc_now().isoformat(),
        },
        user=updated,
    )
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
    await notify_security_email(
        db,
        event_type="password_changed",
        subject="[DressMe Security] Changement de mot de passe",
        fields={
            "Evenement": "Changement mot de passe depuis profil",
            "User ID": current_user.get("id") or current_user.get("_id"),
            "Nom": display_user_name(current_user),
            "Email": current_user.get("email") or "Non renseigne",
            "Date": utc_now().isoformat(),
        },
        user=current_user,
    )


async def notify_security_email(
    db: AsyncIOMotorDatabase,
    *,
    event_type: str,
    subject: str,
    fields: dict[str, Any],
    user: UserDocument | None = None,
    actions: list[dict[str, str]] | None = None,
) -> None:
    now = utc_now()
    event_id = str(uuid4())
    recipient = str(settings.security_email_to)
    event: dict[str, Any] = {
        "_id": event_id,
        "id": event_id,
        "event_type": event_type,
        "recipient": recipient,
        "user_id": str((user or {}).get("_id") or (user or {}).get("id") or ""),
        "user_email": (user or {}).get("email") or fields.get("Email") or fields.get("Email demande"),
        "fields": fields,
        "actions": actions or [],
        "email_status": "pending",
        "created_at": now,
        "updated_at": now,
    }
    await db.security_email_events.insert_one(event)

    try:
        await email_service.send_email(
            to_email=recipient,
            subject=subject,
            html_body=build_security_event_email(
                event_type=event_type,
                fields=fields,
                actions=actions or [],
            ),
        )
    except Exception as exc:
        await db.security_email_events.update_one(
            {"_id": event_id},
            {
                "$set": {
                    "email_status": "failed",
                    "email_error": str(exc),
                    "updated_at": utc_now(),
                }
            },
        )
        return

    await db.security_email_events.update_one(
        {"_id": event_id},
        {"$set": {"email_status": "sent", "updated_at": utc_now()}},
    )


def build_security_event_email(
    *,
    event_type: str,
    fields: dict[str, Any],
    actions: list[dict[str, str]] | None = None,
) -> str:
    rows = "".join(
        "<tr>"
        f"<td style=\"padding:10px 12px;border-bottom:1px solid #eee;color:#666;font-weight:700;\">{html.escape(str(label))}</td>"
        f"<td style=\"padding:10px 12px;border-bottom:1px solid #eee;color:#111;word-break:break-word;\">{html.escape(str(value))}</td>"
        "</tr>"
        for label, value in fields.items()
    )
    action_buttons = "".join(
        "<a "
        f"href=\"{html.escape(action.get('url', ''), quote=True)}\" "
        "style=\"display:inline-block;margin:18px 10px 0 0;padding:12px 18px;"
        "border-radius:8px;text-decoration:none;font-weight:800;"
        "background:#7a2032;color:#ffffff;\">"
        f"{html.escape(action.get('label', 'Ouvrir'))}"
        "</a>"
        for action in actions or []
        if action.get("url")
    )
    safe_event_type = html.escape(event_type)

    return f"""
    <!doctype html>
    <html lang="fr">
      <body style="margin:0;background:#f6f1eb;font-family:Arial,sans-serif;color:#151515;">
        <div style="max-width:680px;margin:0 auto;padding:28px 14px;">
          <div style="background:#ffffff;border:1px solid #eadfd5;border-radius:12px;padding:24px;">
            <h1 style="margin:0 0 6px;font-size:24px;color:#7a2032;">DressMe - Connexion et securite</h1>
            <p style="margin:0 0 20px;color:#666;line-height:1.5;">
              Evenement auth/security detecte: <strong>{safe_event_type}</strong>.
            </p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#fff;">
              {rows}
            </table>
            {f'<div>{action_buttons}</div>' if action_buttons else ''}
          </div>
        </div>
      </body>
    </html>
    """


def build_admin_action_url(path: str, token: str) -> str:
    return (
        f"{settings.api_base_url.rstrip('/')}"
        f"{settings.api_v1_prefix.rstrip('/')}"
        f"{path}?token={quote(token)}"
    )


def build_auth_result_page(
    *,
    title: str,
    message: str,
    tone: str = "success",
    detail: str | None = None,
) -> str:
    is_success = tone == "success"
    accent = "#7a2032" if is_success else "#b42318"
    icon = "&#10003;" if is_success else "!"
    safe_title = html.escape(title)
    safe_message = html.escape(message)
    safe_detail = html.escape(detail or "")
    detail_html = (
        f"<p class=\"detail\">{safe_detail}</p>"
        if safe_detail
        else ""
    )

    return f"""
    <!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>{safe_title}</title>
        <style>
          :root {{
            color-scheme: light;
            --accent: {accent};
            --paper: #fffaf6;
            --text: #171717;
            --muted: #6f6964;
            --line: #eadfd5;
          }}
          * {{ box-sizing: border-box; }}
          body {{
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background: linear-gradient(180deg, #f7efe8 0%, #ffffff 100%);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
            color: var(--text);
            padding: 22px;
          }}
          main {{
            width: min(100%, 520px);
            background: rgba(255, 255, 255, 0.96);
            border: 1px solid var(--line);
            border-radius: 24px;
            padding: 30px 22px;
            text-align: center;
            box-shadow: 0 18px 48px rgba(69, 42, 30, 0.14);
          }}
          .brand {{
            margin: 0 0 18px;
            color: #7a2032;
            font-family: Georgia, "Times New Roman", serif;
            font-size: 42px;
            font-weight: 800;
          }}
          .icon {{
            width: 76px;
            height: 76px;
            margin: 0 auto 18px;
            display: grid;
            place-items: center;
            border-radius: 999px;
            background: color-mix(in srgb, var(--accent) 12%, white);
            color: var(--accent);
            border: 2px solid color-mix(in srgb, var(--accent) 28%, white);
            font-size: 42px;
            font-weight: 900;
          }}
          h1 {{
            margin: 0 0 12px;
            font-size: 28px;
            line-height: 1.15;
          }}
          p {{
            margin: 0 auto;
            color: var(--muted);
            font-size: 17px;
            line-height: 1.5;
            max-width: 420px;
          }}
          .detail {{
            margin-top: 12px;
            font-size: 14px;
            color: #8a8179;
            word-break: break-word;
          }}
          .actions {{
            display: grid;
            gap: 12px;
            margin-top: 28px;
          }}
          a, button {{
            width: 100%;
            min-height: 50px;
            border-radius: 14px;
            border: 0;
            font-size: 16px;
            font-weight: 800;
            text-decoration: none;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          }}
          a {{
            background: var(--accent);
            color: white;
          }}
          button {{
            background: #f2ece6;
            color: #5b5250;
          }}
        </style>
      </head>
      <body>
        <main>
          <p class="brand">DressMe</p>
          <div class="icon">{icon}</div>
          <h1>{safe_title}</h1>
          <p>{safe_message}</p>
          {detail_html}
          <div class="actions">
            <a href="dressme://">Retour a DressMe</a>
            <button type="button" onclick="history.back()">Retour</button>
          </div>
        </main>
      </body>
    </html>
    """


def display_user_name(user: UserDocument | None) -> str:
    if not user:
        return "Utilisateur inconnu"
    first_name = str(user.get("first_name") or "").strip()
    last_name = str(user.get("last_name") or "").strip()
    return f"{first_name} {last_name}".strip() or str(user.get("email") or "Utilisateur DressMe")
