from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.contracts import (
    CreatePostInput,
    PollDTO,
    PollOptionDTO,
    PostDTO,
    UserDTO,
)

PostDocument = dict[str, Any]
UserDocument = dict[str, Any]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def normalize_hashtag(tag: str) -> str:
    value = tag.strip().lower()
    if not value:
        return value
    return value if value.startswith("#") else f"#{value}"


def user_to_dto(user: UserDocument | None, fallback_id: str) -> UserDTO:
    if not user:
        return UserDTO(
            id=fallback_id,
            first_name="Utilisateur",
            last_name="DressMe",
            email=None,
            avatar_url=None,
            bio=None,
        )

    return UserDTO(
        id=str(user.get("id") or user.get("_id") or fallback_id),
        first_name=user.get("first_name"),
        last_name=user.get("last_name"),
        email=user.get("email"),
        avatar_url=user.get("avatar_url"),
        bio=user.get("bio"),
    )


async def post_to_dto(
    db: AsyncIOMotorDatabase,
    post: PostDocument,
    current_user_id: str | None = None,
) -> PostDTO:
    author_id = str(post.get("author_id"))
    author = await db.users.find_one({"_id": author_id})
    like_user_ids = [str(item) for item in post.get("like_user_ids", [])]
    poll = post.get("poll")
    poll_dto = None

    if poll:
        options = [
            PollOptionDTO(
                id=str(option.get("id")),
                label=str(option.get("label", "")),
                image_url=str(option.get("image_url", "")),
                votes=int(option.get("votes", 0)),
            )
            for option in poll.get("options", [])
        ]
        poll_dto = PollDTO(
            id=str(poll.get("id")),
            options=options,
            total_votes=sum(option.votes for option in options),
        )

    return PostDTO(
        id=str(post.get("id") or post.get("_id")),
        author=user_to_dto(author, author_id),
        caption=str(post.get("caption", "")),
        hashtags=list(post.get("hashtags", [])),
        garment_tags=list(post.get("garment_tags", [])),
        image_urls=list(post.get("image_urls", [])),
        like_count=len(like_user_ids),
        comment_count=int(post.get("comment_count", 0)),
        liked_by_me=bool(current_user_id and current_user_id in like_user_ids),
        created_at=post.get("created_at") or utc_now(),
        poll=poll_dto,
    )


async def list_feed_posts(
    db: AsyncIOMotorDatabase,
    current_user_id: str | None,
    limit: int,
    offset: int,
) -> list[PostDTO]:
    cursor = (
        db.posts.find({})
        .sort("created_at", -1)
        .skip(offset)
        .limit(limit)
    )
    documents = await cursor.to_list(length=limit)
    return [await post_to_dto(db, post, current_user_id) for post in documents]


async def create_post(
    db: AsyncIOMotorDatabase,
    payload: CreatePostInput,
    current_user: UserDocument,
) -> PostDTO:
    now = utc_now()
    post_id = str(uuid4())
    hashtags = [normalize_hashtag(tag) for tag in payload.hashtags if normalize_hashtag(tag)]

    post: PostDocument = {
        "_id": post_id,
        "id": post_id,
        "author_id": str(current_user["_id"]),
        "caption": payload.caption.strip(),
        "hashtags": hashtags,
        "garment_tags": [tag.strip() for tag in payload.garment_tags if tag.strip()],
        "image_urls": [url.strip() for url in payload.image_urls if url.strip()],
        "like_user_ids": [],
        "comment_count": 0,
        "created_at": now,
        "updated_at": now,
    }

    if not post["image_urls"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one image URL is required",
        )

    await db.posts.insert_one(post)
    return await post_to_dto(db, post, str(current_user["_id"]))


async def get_post(
    db: AsyncIOMotorDatabase,
    post_id: str,
    current_user_id: str | None,
) -> PostDTO:
    post = await db.posts.find_one({"_id": post_id})
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return await post_to_dto(db, post, current_user_id)


async def toggle_like(
    db: AsyncIOMotorDatabase,
    post_id: str,
    current_user: UserDocument,
) -> PostDTO:
    user_id = str(current_user["_id"])
    post = await db.posts.find_one({"_id": post_id})
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    like_user_ids = [str(item) for item in post.get("like_user_ids", [])]
    if user_id in like_user_ids:
        await db.posts.update_one(
            {"_id": post_id},
            {"$pull": {"like_user_ids": user_id}, "$set": {"updated_at": utc_now()}},
        )
    else:
        await db.posts.update_one(
            {"_id": post_id},
            {"$addToSet": {"like_user_ids": user_id}, "$set": {"updated_at": utc_now()}},
        )

    updated = await db.posts.find_one({"_id": post_id})
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return await post_to_dto(db, updated, user_id)
