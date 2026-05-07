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
    )


# ─── GET /users/me/followers ─────────────────────────────────────────────────

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


# ─── GET /users/{user_id} — Profil public ────────────────────────────────────

@router.get("/{user_id}", response_model=ProfileDTO)
async def get_user_profile(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> ProfileDTO:
    user = await get_user_or_404(db, user_id)
    return await build_profile_dto(db, user)


# ─── PUT /users/{user_id}/profile — Modifier le profil ───────────────────────

@router.put("/{user_id}/profile", response_model=ProfileDTO)
async def update_profile(
    user_id: str,
    data: UpdateProfileInput,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> ProfileDTO:
    if str(current_user["_id"]) != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Action non autorisée")

    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Aucune donnée à mettre à jour")

    update_data["updated_at"] = utc_now()
    await db.users.update_one({"_id": user_id}, {"$set": update_data})
    user = await get_user_or_404(db, user_id)
    return await build_profile_dto(db, user)


# ─── POST /users/{user_id}/follow ────────────────────────────────────────────

@router.post("/{user_id}/follow")
async def follow_user(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> dict[str, bool]:
    current_id = str(current_user["_id"])

    if current_id == user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tu ne peux pas te suivre toi-même")

    await get_user_or_404(db, user_id)

    existing = await db.follows.find_one({"follower_id": current_id, "following_id": user_id})
    if existing:
        return {"following": True}

    follow_id = str(uuid4())
    await db.follows.insert_one({
        "_id": follow_id,
        "follower_id": current_id,
        "following_id": user_id,
        "created_at": utc_now(),
    })
    return {"following": True}


# ─── POST /users/{user_id}/unfollow ──────────────────────────────────────────

@router.post("/{user_id}/unfollow")
async def unfollow_user(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> dict[str, bool]:
    current_id = str(current_user["_id"])
    await db.follows.delete_one({"follower_id": current_id, "following_id": user_id})
    return {"following": False}


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
    follow_docs = await db


# GET /users/me/ping — mettre à jour last_seen
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