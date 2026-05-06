from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.session import get_db
from app.modules.auth import service as auth_service
from app.modules.social.service import post_to_dto, user_to_dto
from app.schemas.contracts import PostDTO, ProfileDTO, UserDTO


router = APIRouter()

FollowStatus = Literal["self", "not_following", "following", "requested"]


async def optional_current_user(
    credentials=Depends(auth_service.bearer_scheme),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> auth_service.UserDocument | None:
    if credentials is None:
        return None
    return await auth_service.get_current_user(credentials=credentials, db=db)


async def find_user_or_404(db: AsyncIOMotorDatabase, user_id: str) -> auth_service.UserDocument:
    user = await db.users.find_one({"_id": user_id})
    if not user:
        user = await db.users.find_one({"id": user_id})
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return auth_service.normalize_user(user) or user


def is_private_user(user: auth_service.UserDocument) -> bool:
    privacy = str(user.get("privacy") or user.get("account_type") or "").lower()
    return bool(user.get("is_private") or user.get("private") or privacy == "private")


async def get_follow_status(
    db: AsyncIOMotorDatabase,
    current_user_id: str | None,
    target_user_id: str,
) -> FollowStatus:
    if not current_user_id:
        return "not_following"
    if current_user_id == target_user_id:
        return "self"

    existing_follow = await db.follows.find_one(
        {"follower_id": current_user_id, "following_id": target_user_id}
    )
    if existing_follow:
        return "following"

    existing_request = await db.follow_requests.find_one(
        {
            "follower_id": current_user_id,
            "following_id": target_user_id,
            "status": "pending",
        }
    )
    if existing_request:
        return "requested"

    return "not_following"


async def build_profile_dto(
    db: AsyncIOMotorDatabase,
    user: auth_service.UserDocument,
    current_user_id: str | None,
) -> ProfileDTO:
    resolved_user_id = str(user.get("_id") or user.get("id"))
    follow_status = await get_follow_status(db, current_user_id, resolved_user_id)
    is_private = is_private_user(user)
    can_view_posts = not is_private or follow_status in {"self", "following"}

    actual_follower_count = await db.follows.count_documents({"following_id": resolved_user_id})
    actual_following_count = await db.follows.count_documents({"follower_id": resolved_user_id})
    follower_count = int(actual_follower_count or user.get("followers_count") or 0)
    following_count = int(actual_following_count or user.get("following_count") or 0)
    post_count = int(
        user.get("posts_count")
        if user.get("posts_count") is not None
        else await db.posts.count_documents({"author_id": resolved_user_id})
    )
    user_dto = user_to_dto(user, resolved_user_id)

    return ProfileDTO(
        **user_dto.model_dump(),
        follower_count=follower_count,
        following_count=following_count,
        post_count=post_count,
        is_private=is_private,
        follow_status=follow_status,
        can_view_posts=can_view_posts,
    )


@router.get("/me/followers", response_model=list[UserDTO])
async def get_my_followers(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> list[UserDTO]:
    user_id = str(current_user["_id"])
    follow_docs = await db.follows.find({"following_id": user_id}).to_list(length=100)
    follower_ids = [str(item.get("follower_id")) for item in follow_docs if item.get("follower_id")]

    if follower_ids:
        cursor = db.users.find({"_id": {"$in": follower_ids}}).limit(50)
    else:
        cursor = db.users.find({"_id": {"$ne": user_id}}).limit(50)

    users = await cursor.to_list(length=50)
    return [user_to_dto(user, str(user.get("_id"))) for user in users]


@router.get("/{user_id}", response_model=ProfileDTO)
async def get_user(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument | None = Depends(optional_current_user),
) -> ProfileDTO:
    user = await find_user_or_404(db, user_id)
    current_user_id = str(current_user["_id"]) if current_user else None
    return await build_profile_dto(db, user, current_user_id)


@router.get("/{user_id}/posts", response_model=list[PostDTO])
async def get_user_posts(
    user_id: str,
    limit: int = Query(default=30, ge=1, le=60),
    offset: int = Query(default=0, ge=0),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument | None = Depends(optional_current_user),
) -> list[PostDTO]:
    user = await find_user_or_404(db, user_id)
    target_user_id = str(user.get("_id") or user.get("id"))
    current_user_id = str(current_user["_id"]) if current_user else None
    follow_status = await get_follow_status(db, current_user_id, target_user_id)
    if is_private_user(user) and follow_status not in {"self", "following"}:
        return []

    posts = await (
        db.posts.find({"author_id": target_user_id})
        .sort("created_at", -1)
        .skip(offset)
        .limit(limit)
        .to_list(length=limit)
    )
    return [await post_to_dto(db, post, current_user_id) for post in posts]


@router.post("/{user_id}/follow", response_model=ProfileDTO)
async def follow_user(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> ProfileDTO:
    target_user = await find_user_or_404(db, user_id)
    target_user_id = str(target_user.get("_id") or target_user.get("id"))
    current_user_id = str(current_user["_id"])
    if current_user_id == target_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot follow yourself")

    now = datetime.now(timezone.utc)
    relation_id = f"{current_user_id}:{target_user_id}"
    if is_private_user(target_user):
        await db.follow_requests.update_one(
            {"_id": relation_id},
            {
                "$set": {
                    "follower_id": current_user_id,
                    "following_id": target_user_id,
                    "status": "pending",
                    "updated_at": now,
                },
                "$setOnInsert": {"id": relation_id, "created_at": now},
            },
            upsert=True,
        )
    else:
        await db.follow_requests.delete_one(
            {"follower_id": current_user_id, "following_id": target_user_id}
        )
        await db.follows.update_one(
            {"_id": relation_id},
            {
                "$set": {
                    "follower_id": current_user_id,
                    "following_id": target_user_id,
                    "updated_at": now,
                },
                "$setOnInsert": {"id": relation_id, "created_at": now},
            },
            upsert=True,
        )

    return await build_profile_dto(db, target_user, current_user_id)


@router.delete("/{user_id}/follow", response_model=ProfileDTO)
async def unfollow_user(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> ProfileDTO:
    target_user = await find_user_or_404(db, user_id)
    target_user_id = str(target_user.get("_id") or target_user.get("id"))
    current_user_id = str(current_user["_id"])
    relation_filter = {"follower_id": current_user_id, "following_id": target_user_id}
    await db.follows.delete_one(relation_filter)
    await db.follow_requests.delete_one(relation_filter)
    return await build_profile_dto(db, target_user, current_user_id)
