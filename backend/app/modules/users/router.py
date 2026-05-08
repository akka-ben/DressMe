from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase
from pydantic import BaseModel

from app.db.session import get_db
from app.modules.auth import service as auth_service
from app.modules.social.service import post_to_dto, user_to_dto
from app.schemas.contracts import PostDTO, ProfileDTO, UserDTO


router = APIRouter()

FollowStatus = Literal["self", "not_following", "following", "requested"]


class UpdateProfileInput(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    bio: str | None = None
    avatar_url: str | None = None


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


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


def resolved_user_id(user: auth_service.UserDocument) -> str:
    return str(user.get("_id") or user.get("id"))


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
    user_id = resolved_user_id(user)
    follow_status = await get_follow_status(db, current_user_id, user_id)
    is_private = is_private_user(user)
    can_view_posts = not is_private or follow_status in {"self", "following"}
    user_dto = user_to_dto(user, user_id)

    return ProfileDTO(
        **user_dto.model_dump(),
        follower_count=await db.follows.count_documents({"following_id": user_id}),
        following_count=await db.follows.count_documents({"follower_id": user_id}),
        post_count=await db.posts.count_documents({"author_id": user_id}),
        is_private=is_private,
        follow_status=follow_status,
        can_view_posts=can_view_posts,
        last_seen=user.get("last_seen"),
    )


async def users_by_ids(db: AsyncIOMotorDatabase, user_ids: list[str]) -> list[UserDTO]:
    if not user_ids:
        return []

    users = await db.users.find({"_id": {"$in": user_ids}}).to_list(length=len(user_ids))
    by_id = {resolved_user_id(auth_service.normalize_user(user) or user): user for user in users}
    return [user_to_dto(by_id[user_id], user_id) for user_id in user_ids if user_id in by_id]


@router.get("/me/ping")
async def ping(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> dict[str, str]:
    await db.users.update_one(
        {"_id": current_user["_id"]},
        {"$set": {"last_seen": utc_now(), "updated_at": utc_now()}},
    )
    return {"status": "ok"}


@router.get("/me/followers", response_model=list[UserDTO])
async def get_my_followers(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> list[UserDTO]:
    user_id = str(current_user["_id"])
    follow_docs = await db.follows.find({"following_id": user_id}).to_list(length=100)
    follower_ids = [str(doc["follower_id"]) for doc in follow_docs if doc.get("follower_id")]
    return await users_by_ids(db, follower_ids)


@router.get("/me/following", response_model=list[UserDTO])
async def get_my_following(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> list[UserDTO]:
    user_id = str(current_user["_id"])
    follow_docs = await db.follows.find({"follower_id": user_id}).to_list(length=100)
    following_ids = [str(doc["following_id"]) for doc in follow_docs if doc.get("following_id")]
    return await users_by_ids(db, following_ids)


@router.get("/me/posts", response_model=list[PostDTO])
async def get_my_posts(
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> list[PostDTO]:
    user_id = str(current_user["_id"])
    posts = await (
        db.posts.find({"author_id": user_id})
        .sort("created_at", -1)
        .limit(50)
        .to_list(length=50)
    )
    return [await post_to_dto(db, post, user_id) for post in posts]


@router.get("/{user_id}/suggestions", response_model=list[UserDTO])
async def get_suggestions(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[UserDTO]:
    target_follows = await db.follows.find({"follower_id": user_id}).to_list(length=100)
    target_following_ids = {str(doc["following_id"]) for doc in target_follows if doc.get("following_id")}
    if not target_following_ids:
        return []

    second_degree = await db.follows.find(
        {"follower_id": {"$in": list(target_following_ids)}}
    ).to_list(length=200)

    score: dict[str, int] = {}
    for doc in second_degree:
        candidate_id = str(doc.get("following_id") or "")
        if candidate_id and candidate_id != user_id and candidate_id not in target_following_ids:
            score[candidate_id] = score.get(candidate_id, 0) + 1

    top_ids = sorted(score, key=lambda candidate_id: score[candidate_id], reverse=True)[:5]
    return await users_by_ids(db, top_ids)


@router.get("/{user_id}/followers", response_model=list[UserDTO])
async def get_followers(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[UserDTO]:
    await find_user_or_404(db, user_id)
    follow_docs = await db.follows.find({"following_id": user_id}).to_list(length=100)
    follower_ids = [str(doc["follower_id"]) for doc in follow_docs if doc.get("follower_id")]
    return await users_by_ids(db, follower_ids)


@router.get("/{user_id}/following", response_model=list[UserDTO])
async def get_following(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[UserDTO]:
    await find_user_or_404(db, user_id)
    follow_docs = await db.follows.find({"follower_id": user_id}).to_list(length=100)
    following_ids = [str(doc["following_id"]) for doc in follow_docs if doc.get("following_id")]
    return await users_by_ids(db, following_ids)


@router.get("/{user_id}", response_model=ProfileDTO)
async def get_user(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument | None = Depends(optional_current_user),
) -> ProfileDTO:
    user = await find_user_or_404(db, user_id)
    current_user_id = str(current_user["_id"]) if current_user else None
    return await build_profile_dto(db, user, current_user_id)


@router.put("/{user_id}/profile", response_model=ProfileDTO)
async def update_profile(
    user_id: str,
    data: UpdateProfileInput,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> ProfileDTO:
    target_user = await find_user_or_404(db, user_id)
    target_user_id = resolved_user_id(target_user)
    current_user_id = str(current_user["_id"])
    if current_user_id != target_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot edit this profile")

    updates = data.model_dump(exclude_none=True)
    if updates:
        updates["updated_at"] = utc_now()
        await db.users.update_one({"_id": target_user_id}, {"$set": updates})
        target_user = await find_user_or_404(db, target_user_id)

    return await build_profile_dto(db, target_user, current_user_id)


@router.get("/{user_id}/posts", response_model=list[PostDTO])
async def get_user_posts(
    user_id: str,
    limit: int = Query(default=30, ge=1, le=60),
    offset: int = Query(default=0, ge=0),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument | None = Depends(optional_current_user),
) -> list[PostDTO]:
    user = await find_user_or_404(db, user_id)
    target_user_id = resolved_user_id(user)
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
    target_user_id = resolved_user_id(target_user)
    current_user_id = str(current_user["_id"])
    if current_user_id == target_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot follow yourself")

    now = utc_now()
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
    target_user_id = resolved_user_id(target_user)
    current_user_id = str(current_user["_id"])
    relation_filter = {"follower_id": current_user_id, "following_id": target_user_id}
    await db.follows.delete_one(relation_filter)
    await db.follow_requests.delete_one(relation_filter)
    return await build_profile_dto(db, target_user, current_user_id)


@router.post("/{user_id}/unfollow", response_model=ProfileDTO)
async def unfollow_user_legacy(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> ProfileDTO:
    return await unfollow_user(user_id, db, current_user)


@router.post("/{user_id}/block")
async def block_user(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> dict[str, bool]:
    target_user = await find_user_or_404(db, user_id)
    target_user_id = resolved_user_id(target_user)
    current_user_id = str(current_user["_id"])
    if current_user_id == target_user_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot block yourself")

    now = utc_now()
    await db.blocks.update_one(
        {"_id": f"{current_user_id}:{target_user_id}"},
        {
            "$set": {
                "blocker_id": current_user_id,
                "blocked_id": target_user_id,
                "updated_at": now,
            },
            "$setOnInsert": {"created_at": now},
        },
        upsert=True,
    )
    await db.follows.delete_many(
        {
            "$or": [
                {"follower_id": current_user_id, "following_id": target_user_id},
                {"follower_id": target_user_id, "following_id": current_user_id},
            ]
        }
    )
    return {"blocked": True}


@router.post("/{user_id}/unblock")
async def unblock_user(
    user_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> dict[str, bool]:
    target_user = await find_user_or_404(db, user_id)
    await db.blocks.delete_one(
        {"blocker_id": str(current_user["_id"]), "blocked_id": resolved_user_id(target_user)}
    )
    return {"blocked": False}
