from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.db.session import get_db
from app.modules.auth import service as auth_service
from app.modules.social.service import user_to_dto, post_to_dto
from app.schemas.contracts import ProfileDTO, UserDTO, PostDTO

router = APIRouter()


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


# ─── Schemas ─────────────────────────────────────────────────────────────────

class UpdateProfileInput(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    bio: str | None = None
    avatar_url: str | None = None


# ─── Helpers ─────────────────────────────────────────────────────────────────

async def get_user_or_404(db: AsyncIOMotorDatabase, user_id: str) -> dict[str, Any]:
    user = await db.users.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Utilisateur introuvable")
    return user


async def build_profile_dto(db: AsyncIOMotorDatabase, user: dict[str, Any]) -> ProfileDTO:
    user_id = str(user.get("_id"))
    follower_count = await db.follows.count_documents({"following_id": user_id})
    following_count = await db.follows.count_documents({"follower_id": user_id})
    post_count = await db.posts.count_documents({"author_id": user_id})

    return ProfileDTO(
        id=user_id,
        first_name=user.get("first_name"),
        last_name=user.get("last_name"),
        email=user.get("email"),
        avatar_url=user.get("avatar_url"),
        bio=user.get("bio"),
        follower_count=follower_count,
        following_count=following_count,
        post_count=post_count,
        last_seen=user.get("last_seen"),
    )


# ─── GET /users/me/ping ───────────────────────────────────────────────────────

@router.get("/me/ping")
async def ping(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> dict[str, str]:
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"last_seen": utc_now()}}
    )
    return {"status": "ok"}


# ─── GET /users/me/followers ──────────────────────────────────────────────────

@router.get("/me/followers", response_model=list[UserDTO])
async def get_my_followers(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> list[UserDTO]:
    user_id = str(current_user["_id"])
    follow_docs = await db.follows.find({"following_id": user_id}).to_list(length=100)
    follower_ids = [str(doc["follower_id"]) for doc in follow_docs if doc.get("follower_id")]

    if not follower_ids:
        return []

    users = await db.users.find({"_id": {"$in": follower_ids}}).to_list(length=100)
    return [user_to_dto(u, str(u.get("_id"))) for u in users]


# ─── GET /users/me/following ──────────────────────────────────────────────────

@router.get("/me/following", response_model=list[UserDTO])
async def get_my_following(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> list[UserDTO]:
    user_id = str(current_user["_id"])
    follow_docs = await db.follows.find({"follower_id": user_id}).to_list(length=100)
    following_ids = [str(doc["following_id"]) for doc in follow_docs if doc.get("following_id")]

    if not following_ids:
        return []

    users = await db.users.find({"_id": {"$in": following_ids}}).to_list(length=100)
    return [user_to_dto(u, str(u.get("_id"))) for u in users]


# ─── GET /users/me/posts ──────────────────────────────────────────────────────

@router.get("/me/posts", response_model=list[PostDTO])
async def get_my_posts(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> list[PostDTO]:
    user_id = str(current_user["_id"])
    cursor = db.posts.find({"author_id": user_id}).sort("created_at", -1).limit(50)
    posts = await cursor.to_list(length=50)
    return [await post_to_dto(db, p, user_id) for p in posts]


# ─── GET /users/{user_id}/suggestions ────────────────────────────────────────

@router.get("/{user_id}/suggestions", response_model=list[UserDTO])
async def get_suggestions(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[UserDTO]:
    target_follows = await db.follows.find(
        {"follower_id": user_id}
    ).to_list(length=100)
    target_following_ids = {str(doc["following_id"]) for doc in target_follows}

    if not target_following_ids:
        return []

    second_degree = await db.follows.find(
        {"follower_id": {"$in": list(target_following_ids)}}
    ).to_list(length=200)

    score: dict[str, int] = {}
    for doc in second_degree:
        uid = str(doc.get("following_id", ""))
        if uid and uid != user_id and uid not in target_following_ids:
            score[uid] = score.get(uid, 0) + 1

    if not score:
        return []

    top_ids = sorted(score, key=lambda x: score[x], reverse=True)[:5]
    users = await db.users.find({"_id": {"$in": top_ids}}).to_list(length=5)
    return [user_to_dto(u, str(u.get("_id"))) for u in users]


# ─── GET /users/{user_id}/followers ──────────────────────────────────────────

@router.get("/{user_id}/followers", response_model=list[UserDTO])
async def get_followers(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[UserDTO]:
    follow_docs = await db.follows.find({"following_id": user_id}).to_list(length=100)
    follower_ids = [str(doc["follower_id"]) for doc in follow_docs if doc.get("follower_id")]

    if not follower_ids:
        return []

    users = await db.users.find({"_id": {"$in": follower_ids}}).to_list(length=100)
    return [user_to_dto(u, str(u.get("_id"))) for u in users]


# ─── GET /users/{user_id}/following ──────────────────────────────────────────

@router.get("/{user_id}/following", response_model=list[UserDTO])
async def get_following(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[UserDTO]:
    follow_docs = await db.follows.find({"follower_id": user_id}).to_list(length=100)
    following_ids = [str(doc["following_id"]) for doc in follow_docs if doc.get("following_id")]

    if not following_ids:
        return []

    users = await db.users.find({"_id": {"$in": following_ids}}).to_list(length=100)
    return [user_to_dto(u, str(u.get("_id"))) for u in users]


# ─── GET /users/{user_id} — Profil public ───────────────────