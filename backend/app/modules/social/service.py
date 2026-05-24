import re
import unicodedata
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, status
from pymongo.errors import DuplicateKeyError
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.schemas.contracts import (
    AddCommentInput,
    CommentDTO,
    CreatePostInput,
    CreateStoryInput,
    PollDTO,
    PollOptionDTO,
    PostDTO,
    SearchHashtagDTO,
    SearchPlaceDTO,
    SearchResultDTO,
    StoryDTO,
    UserDTO,
)

PostDocument = dict[str, Any]
UserDocument = dict[str, Any]
CommentDocument = dict[str, Any]
StoryDocument = dict[str, Any]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def normalize_hashtag(tag: str) -> str:
    value = tag.strip().lower()
    if not value:
        return value
    return value if value.startswith("#") else f"#{value}"


def normalize_search_text(value: Any) -> str:
    text = str(value or "").strip().lower()
    text = unicodedata.normalize("NFKD", text)
    return "".join(character for character in text if not unicodedata.combining(character))


def search_regex(query: str) -> dict[str, str]:
    return {"$regex": re.escape(query.strip()), "$options": "i"}


def normalize_datetime(value: Any) -> datetime:
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value

    if isinstance(value, str):
        normalized = value.replace("Z", "+00:00")
        try:
            return datetime.fromisoformat(normalized)
        except ValueError:
            return utc_now()

    return utc_now()


def normalize_string_list(value: Any, *, hashtags: bool = False) -> list[str]:
    if value is None:
        return []

    raw_items = value if isinstance(value, list) else [value]
    normalized_items: list[str] = []

    for item in raw_items:
        if isinstance(item, str):
            parts = item.split() if hashtags and " " in item else [item]
        elif isinstance(item, dict):
            preferred_keys = ("type", "color", "style", "label", "name", "value")
            values = [str(item[key]).strip() for key in preferred_keys if item.get(key)]
            parts = [" ".join(values)] if values else [str(item)]
        else:
            parts = [str(item)]

        for part in parts:
            text = part.strip()
            if not text:
                continue
            normalized_items.append(normalize_hashtag(text) if hashtags else text)

    return normalized_items


def normalize_image_urls(post: PostDocument) -> list[str]:
    candidate = (
        post.get("image_urls")
        or post.get("video_urls")
        or post.get("videos")
        or post.get("images")
        or post.get("media")
        or post.get("video_url")
        or post.get("image_url")
        or post.get("video")
        or post.get("image")
    )
    if candidate is None:
        return []

    raw_items = candidate if isinstance(candidate, list) else [candidate]
    image_urls: list[str] = []

    for item in raw_items:
        if isinstance(item, str):
            url = item.strip()
        elif isinstance(item, dict):
            url = str(
                item.get("url")
                or item.get("image_url")
                or item.get("video_url")
                or item.get("image")
                or item.get("video")
                or item.get("src")
                or ""
            ).strip()
        else:
            url = ""

        if url:
            image_urls.append(url)

    return image_urls


def safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def detect_media_type(post: PostDocument) -> str:
    explicit = str(post.get("media_type") or post.get("type") or post.get("kind") or "").lower()
    if explicit in {"video", "reel"}:
        return "video"

    if post.get("video_url") or post.get("video") or post.get("video_urls") or post.get("videos"):
        return "video"

    media = post.get("media")
    media_items = media if isinstance(media, list) else [media] if media else []
    for item in media_items:
        if isinstance(item, dict):
            item_type = str(item.get("type") or item.get("media_type") or item.get("kind") or "").lower()
            url = str(item.get("url") or item.get("src") or item.get("video_url") or "").lower()
            if item_type in {"video", "reel"} or url.endswith((".mp4", ".mov", ".m4v", ".webm")):
                return "video"
        elif isinstance(item, str) and item.lower().endswith((".mp4", ".mov", ".m4v", ".webm")):
            return "video"

    for url in normalize_image_urls(post):
        if url.lower().split("?")[0].endswith((".mp4", ".mov", ".m4v", ".webm")):
            return "video"

    return "image"


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
        username=user.get("username"),
        first_name=user.get("first_name"),
        last_name=user.get("last_name"),
        email=user.get("email"),
        avatar_url=user.get("avatar_url"),
        bio=user.get("bio"),
    )


def post_search_text(post: PostDocument) -> str:
    searchable_parts: list[str] = [
        str(post.get("caption") or post.get("description") or ""),
        " ".join(normalize_string_list(post.get("hashtags"), hashtags=True)),
        " ".join(normalize_string_list(post.get("garment_tags") or post.get("tags"))),
    ]

    for field_name in ("location", "place", "city", "venue", "country"):
        value = post.get(field_name)
        if isinstance(value, dict):
            searchable_parts.extend(str(item) for item in value.values())
        elif isinstance(value, list):
            searchable_parts.extend(str(item) for item in value)
        elif value:
            searchable_parts.append(str(value))

    return normalize_search_text(" ".join(searchable_parts))


def post_matches_query(post: PostDocument, normalized_query: str) -> bool:
    if not normalized_query:
        return True
    return normalized_query in post_search_text(post)


KNOWN_PLACE_TERMS = {
    "casablanca": "Casablanca",
    "rabat": "Rabat",
    "marrakech": "Marrakech",
    "marakech": "Marrakech",
    "fes": "Fes",
    "fès": "Fes",
    "tanger": "Tanger",
    "agadir": "Agadir",
    "paris": "Paris",
}


def iter_post_places(post: PostDocument) -> list[str]:
    places: list[str] = []

    for field_name in ("location", "place", "city", "venue"):
        value = post.get(field_name)
        raw_values = value if isinstance(value, list) else [value] if value else []
        for raw_value in raw_values:
            if isinstance(raw_value, dict):
                preferred = raw_value.get("name") or raw_value.get("city") or raw_value.get("label")
                if preferred:
                    places.append(str(preferred))
            elif raw_value:
                places.append(str(raw_value))

    text = post_search_text(post)
    for key, label in KNOWN_PLACE_TERMS.items():
        if key in text:
            places.append(label)

    deduped: list[str] = []
    seen: set[str] = set()
    for place in places:
        label = place.strip()
        normalized = normalize_search_text(label)
        if label and normalized not in seen:
            deduped.append(label)
            seen.add(normalized)
    return deduped


def search_place_id(name: str) -> str:
    normalized = normalize_search_text(name)
    return re.sub(r"[^a-z0-9]+", "-", normalized).strip("-") or "place"


async def post_to_dto(
    db: AsyncIOMotorDatabase,
    post: PostDocument,
    current_user_id: str | None = None,
) -> PostDTO:
    post_id = str(post.get("id") or post.get("_id"))
    author_id = str(post.get("author_id"))
    author = await db.users.find_one({"_id": author_id})
    like_user_ids = [str(item) for item in post.get("like_user_ids", [])]
    actual_comment_count = await db.comments.count_documents({"post_id": post_id})
    actual_share_count = await db.post_shares.count_documents({"post_id": post_id})
    saved_by_me = False
    if current_user_id:
        saved_by_me = bool(
            await db.saved_posts.find_one(
                {"user_id": current_user_id, "post_id": post_id}
            )
        )
    poll = post.get("poll")
    poll_dto = None

    if poll:
        options = [
            PollOptionDTO(
                id=str(option.get("id")),
                label=str(option.get("label", "")),
                image_url=str(option.get("image_url") or option.get("image") or option.get("url") or ""),
                votes=safe_int(option.get("votes")),
            )
            for option in poll.get("options", [])
            if isinstance(option, dict)
        ]
        poll_dto = PollDTO(
            id=str(poll.get("id")),
            options=options,
            total_votes=sum(option.votes for option in options),
        )

    return PostDTO(
        id=post_id,
        author=user_to_dto(author, author_id),
        caption=str(post.get("caption") or post.get("description") or ""),
        media_type=detect_media_type(post),
        hashtags=normalize_string_list(post.get("hashtags"), hashtags=True),
        garment_tags=normalize_string_list(post.get("garment_tags") or post.get("tags")),
        image_urls=normalize_image_urls(post),
        like_count=len(like_user_ids),
        comment_count=actual_comment_count,
        share_count=actual_share_count or safe_int(post.get("share_count")),
        liked_by_me=bool(current_user_id and current_user_id in like_user_ids),
        saved_by_me=saved_by_me,
        created_at=normalize_datetime(post.get("created_at")),
        poll=poll_dto,
    )


async def comment_to_dto(db: AsyncIOMotorDatabase, comment: CommentDocument) -> CommentDTO:
    author_id = str(comment.get("author_id"))
    author = await db.users.find_one({"_id": author_id})
    return CommentDTO(
        id=str(comment.get("id") or comment.get("_id")),
        author=user_to_dto(author, author_id),
        content=str(comment.get("content", "")),
        created_at=normalize_datetime(comment.get("created_at")),
    )


async def story_to_dto(
    db: AsyncIOMotorDatabase,
    story: StoryDocument,
    current_user_id: str | None = None,
) -> StoryDTO:
    story_id = str(story.get("id") or story.get("_id"))
    author_id = str(story.get("author_id"))
    author = await db.users.find_one({"_id": author_id})
    viewed_user_ids = [str(item) for item in story.get("viewed_user_ids", [])]
    external_viewer_ids = [viewer_id for viewer_id in viewed_user_ids if viewer_id != author_id]

    return StoryDTO(
        id=story_id,
        author=user_to_dto(author, author_id),
        media_url=str(story.get("media_url") or ""),
        media_type="video" if str(story.get("media_type")).lower() == "video" else "image",
        caption=story.get("caption"),
        viewer_count=len(external_viewer_ids),
        viewed_by_me=bool(current_user_id and current_user_id in viewed_user_ids),
        created_at=normalize_datetime(story.get("created_at")),
        expires_at=normalize_datetime(story.get("expires_at")),
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


async def list_reels_posts(
    db: AsyncIOMotorDatabase,
    current_user_id: str | None,
    limit: int,
    offset: int,
) -> list[PostDTO]:
    # Imported Mongo data is not fully normalized yet, so reels are detected from
    # explicit media_type/type fields and common video URL fields.
    query: dict[str, Any] = {
        "$or": [
            {"media_type": {"$in": ["video", "reel"]}},
            {"type": {"$in": ["video", "reel"]}},
            {"kind": {"$in": ["video", "reel"]}},
            {"video_url": {"$exists": True, "$ne": ""}},
            {"video_urls": {"$exists": True, "$ne": []}},
            {"videos": {"$exists": True, "$ne": []}},
        ]
    }
    cursor = db.posts.find(query).sort("created_at", -1)
    documents = await cursor.to_list(length=max(limit + offset, limit))
    reels = [post for post in documents if detect_media_type(post) == "video"]
    page = reels[offset : offset + limit]
    return [await post_to_dto(db, post, current_user_id) for post in page]


async def search_explore(
    db: AsyncIOMotorDatabase,
    query: str,
    current_user_id: str | None,
    limit: int,
) -> SearchResultDTO:
    clean_query = query.strip()
    normalized_query = normalize_search_text(clean_query.lstrip("@#"))
    if not normalized_query:
        return SearchResultDTO(query=clean_query)

    regex = search_regex(clean_query.lstrip("@#") or clean_query) if clean_query else None
    candidate_limit = max(limit * 6, 60)

    if regex:
        user_query: dict[str, Any] = {
            "$or": [
                {"username": regex},
                {"first_name": regex},
                {"last_name": regex},
                {"bio": regex},
                {"email": regex},
            ]
        }
        post_query: dict[str, Any] = {
            "$or": [
                {"caption": regex},
                {"description": regex},
                {"hashtags": regex},
                {"garment_tags": regex},
                {"tags": regex},
                {"location": regex},
                {"place": regex},
                {"city": regex},
                {"venue": regex},
            ]
        }
    else:
        user_query = {}
        post_query = {}

    users = await (
        db.users.find(user_query)
        .sort([("followers_count", -1), ("created_at", -1)])
        .limit(limit)
        .to_list(length=limit)
    )

    post_candidates = await (
        db.posts.find(post_query)
        .sort("created_at", -1)
        .limit(candidate_limit)
        .to_list(length=candidate_limit)
    )

    if regex and len(post_candidates) < limit:
        fallback_posts = await (
            db.posts.find({})
            .sort("created_at", -1)
            .limit(candidate_limit)
            .to_list(length=candidate_limit)
        )
        known_ids = {str(post.get("_id")) for post in post_candidates}
        post_candidates.extend(
            post for post in fallback_posts if str(post.get("_id")) not in known_ids
        )

    matching_posts = [
        post for post in post_candidates if post_matches_query(post, normalized_query)
    ]
    top_post_docs = matching_posts[:limit]
    video_docs = [
        post for post in matching_posts if detect_media_type(post) == "video"
    ][:limit]

    hashtag_posts = await (
        db.posts.find({})
        .sort("created_at", -1)
        .limit(300)
        .to_list(length=300)
    )
    hashtag_buckets: dict[str, dict[str, Any]] = {}
    place_buckets: dict[str, dict[str, Any]] = {}

    for post in hashtag_posts:
        for tag in normalize_string_list(post.get("hashtags"), hashtags=True):
            if normalized_query and normalized_query not in normalize_search_text(tag):
                continue
            bucket = hashtag_buckets.setdefault(
                tag,
                {"tag": tag, "post_count": 0, "latest_post": post},
            )
            bucket["post_count"] += 1

        for place in iter_post_places(post):
            if normalized_query and normalized_query not in normalize_search_text(place):
                continue
            place_id = search_place_id(place)
            bucket = place_buckets.setdefault(
                place_id,
                {
                    "id": place_id,
                    "name": place,
                    "subtitle": "Lieu detecte depuis les publications DressMe",
                    "post_count": 0,
                    "latest_post": post,
                },
            )
            bucket["post_count"] += 1

    hashtag_items = sorted(
        hashtag_buckets.values(),
        key=lambda item: (-int(item["post_count"]), str(item["tag"])),
    )[:limit]
    place_items = sorted(
        place_buckets.values(),
        key=lambda item: (-int(item["post_count"]), str(item["name"])),
    )[:limit]

    return SearchResultDTO(
        query=clean_query,
        users=[user_to_dto(user, str(user.get("_id"))) for user in users],
        hashtags=[
            SearchHashtagDTO(
                tag=str(item["tag"]),
                post_count=int(item["post_count"]),
                latest_post=await post_to_dto(db, item["latest_post"], current_user_id),
            )
            for item in hashtag_items
        ],
        videos=[await post_to_dto(db, post, current_user_id) for post in video_docs],
        places=[
            SearchPlaceDTO(
                id=str(item["id"]),
                name=str(item["name"]),
                subtitle=str(item["subtitle"]),
                post_count=int(item["post_count"]),
                latest_post=await post_to_dto(db, item["latest_post"], current_user_id),
            )
            for item in place_items
        ],
        top_posts=[await post_to_dto(db, post, current_user_id) for post in top_post_docs],
    )


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
        "media_type": payload.media_type,
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


async def list_stories(
    db: AsyncIOMotorDatabase,
    current_user_id: str | None,
    limit: int,
) -> list[StoryDTO]:
    now = utc_now()
    query: dict[str, Any] = {
        "$or": [
            {"expires_at": {"$gt": now}},
            {"expires_at": {"$exists": False}},
        ]
    }
    cursor = db.stories.find(query).sort("created_at", -1).limit(limit)
    stories = await cursor.to_list(length=limit)
    return [await story_to_dto(db, story, current_user_id) for story in stories]


async def create_story(
    db: AsyncIOMotorDatabase,
    payload: CreateStoryInput,
    current_user: UserDocument,
) -> StoryDTO:
    media_url = payload.media_url.strip()
    if not media_url:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Story media URL is required",
        )

    now = utc_now()
    story_id = str(uuid4())
    story: StoryDocument = {
        "_id": story_id,
        "id": story_id,
        "author_id": str(current_user["_id"]),
        "media_url": media_url,
        "media_type": payload.media_type,
        "caption": payload.caption.strip() if payload.caption else None,
        "viewed_user_ids": [],
        "created_at": now,
        "updated_at": now,
        "expires_at": now + timedelta(hours=24),
    }

    await db.stories.insert_one(story)
    return await story_to_dto(db, story, str(current_user["_id"]))


async def mark_story_viewed(
    db: AsyncIOMotorDatabase,
    story_id: str,
    current_user: UserDocument,
) -> StoryDTO:
    user_id = str(current_user["_id"])
    story = await db.stories.find_one({"_id": story_id})
    if not story:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Story not found")

    if str(story.get("author_id")) == user_id:
        return await story_to_dto(db, story, user_id)

    await db.stories.update_one(
        {"_id": story_id},
        {"$addToSet": {"viewed_user_ids": user_id}, "$set": {"updated_at": utc_now()}},
    )
    updated = await db.stories.find_one({"_id": story_id})
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Story not found")
    return await story_to_dto(db, updated, user_id)


async def list_story_viewers(
    db: AsyncIOMotorDatabase,
    story_id: str,
    current_user: UserDocument,
) -> list[UserDTO]:
    user_id = str(current_user["_id"])
    story = await db.stories.find_one({"_id": story_id})
    if not story:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Story not found")
    if str(story.get("author_id")) != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the story owner can see viewers",
        )

    viewer_ids = [str(item) for item in story.get("viewed_user_ids", []) if str(item) != user_id]
    if not viewer_ids:
        return []

    cursor = db.users.find({"_id": {"$in": viewer_ids}})
    users = await cursor.to_list(length=len(viewer_ids))
    user_by_id = {str(user.get("_id")): user for user in users}

    return [
        user_to_dto(user_by_id.get(viewer_id), viewer_id)
        for viewer_id in viewer_ids
    ]


async def get_post(
    db: AsyncIOMotorDatabase,
    post_id: str,
    current_user_id: str | None,
) -> PostDTO:
    post = await db.posts.find_one({"_id": post_id})
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return await post_to_dto(db, post, current_user_id)


async def list_post_comments(
    db: AsyncIOMotorDatabase,
    post_id: str,
    limit: int,
    offset: int,
) -> list[CommentDTO]:
    cursor = (
        db.comments.find({"post_id": post_id})
        .sort("created_at", -1)
        .skip(offset)
        .limit(limit)
    )
    comments = await cursor.to_list(length=limit)
    return [await comment_to_dto(db, comment) for comment in comments]


async def add_post_comment(
    db: AsyncIOMotorDatabase,
    post_id: str,
    payload: AddCommentInput,
    current_user: UserDocument,
) -> CommentDTO:
    post = await db.posts.find_one({"_id": post_id})
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    now = utc_now()
    comment_id = str(uuid4())
    comment: CommentDocument = {
        "_id": comment_id,
        "id": comment_id,
        "post_id": post_id,
        "author_id": str(current_user["_id"]),
        "content": payload.content.strip(),
        "created_at": now,
        "updated_at": now,
    }
    await db.comments.insert_one(comment)
    await db.posts.update_one(
        {"_id": post_id},
        {"$inc": {"comment_count": 1}, "$set": {"updated_at": now}},
    )
    return await comment_to_dto(db, comment)


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
        await db.post_likes.delete_one({"_id": f"{user_id}:{post_id}"})
    else:
        now = utc_now()
        await db.posts.update_one(
            {"_id": post_id},
            {"$addToSet": {"like_user_ids": user_id}, "$set": {"updated_at": now}},
        )
        await db.post_likes.update_one(
            {"_id": f"{user_id}:{post_id}"},
            {
                "$set": {
                    "user_id": user_id,
                    "post_id": post_id,
                    "updated_at": now,
                },
                "$setOnInsert": {
                    "id": f"{user_id}:{post_id}",
                    "created_at": now,
                },
            },
            upsert=True,
        )

    updated = await db.posts.find_one({"_id": post_id})
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return await post_to_dto(db, updated, user_id)


async def register_share(
    db: AsyncIOMotorDatabase,
    post_id: str,
    current_user: UserDocument,
) -> PostDTO:
    post = await db.posts.find_one({"_id": post_id})
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    now = utc_now()
    share_id = str(uuid4())
    await db.post_shares.insert_one(
        {
            "_id": share_id,
            "id": share_id,
            "post_id": post_id,
            "user_id": str(current_user["_id"]),
            "created_at": now,
        }
    )
    await db.posts.update_one(
        {"_id": post_id},
        {"$inc": {"share_count": 1}, "$set": {"updated_at": now}},
    )

    updated = await db.posts.find_one({"_id": post_id})
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return await post_to_dto(db, updated, str(current_user["_id"]))


async def toggle_save(
    db: AsyncIOMotorDatabase,
    post_id: str,
    current_user: UserDocument,
) -> PostDTO:
    user_id = str(current_user["_id"])
    post = await db.posts.find_one({"_id": post_id})
    if not post:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")

    existing = await db.saved_posts.find_one({"user_id": user_id, "post_id": post_id})
    if existing:
        await db.saved_posts.delete_one({"_id": existing["_id"]})
    else:
        media_type = detect_media_type(post)
        try:
            await db.saved_posts.insert_one(
                {
                    "_id": f"{user_id}:{post_id}",
                    "id": f"{user_id}:{post_id}",
                    "user_id": user_id,
                    "post_id": post_id,
                    "media_type": media_type,
                    "created_at": utc_now(),
                }
            )
        except DuplicateKeyError:
            pass

    updated = await db.posts.find_one({"_id": post_id})
    if not updated:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Post not found")
    return await post_to_dto(db, updated, user_id)


async def list_saved_posts(
    db: AsyncIOMotorDatabase,
    current_user: UserDocument,
    media_type: str | None,
    limit: int,
    offset: int,
) -> list[PostDTO]:
    user_id = str(current_user["_id"])
    query: dict[str, Any] = {"user_id": user_id}
    if media_type in {"image", "video"}:
        query["media_type"] = media_type

    cursor = (
        db.saved_posts.find(query)
        .sort("created_at", -1)
        .skip(offset)
        .limit(limit)
    )
    saved_items = await cursor.to_list(length=limit)
    posts: list[PostDTO] = []

    for saved_item in saved_items:
        post = await db.posts.find_one({"_id": str(saved_item.get("post_id"))})
        if post:
            posts.append(await post_to_dto(db, post, user_id))

    return posts
