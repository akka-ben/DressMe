from datetime import datetime
from typing import TypedDict


class UserDocument(TypedDict, total=False):
    _id: str
    id: str
    first_name: str | None
    last_name: str | None
    email: str | None
    phone_number: str | None
    password_hash: str | None
    is_verified: bool
    otp_code: str | None
    otp_expiration: datetime | None
    reset_token: str | None
    reset_token_expiration: datetime | None
    verification_token: str | None
    verification_token_expiration: datetime | None
    avatar_url: str | None
    bio: str | None
    created_at: datetime
    updated_at: datetime


USERS_COLLECTION = "users"
