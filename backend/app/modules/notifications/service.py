from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid5, NAMESPACE_URL

from motor.motor_asyncio import AsyncIOMotorDatabase

from app.modules.auth import service as auth_service
from app.modules.social.service import normalize_datetime, post_to_dto, user_to_dto
from app.schemas.contracts import ActivityNotificationDTO, PostDTO, UserDTO


UserDocument = dict[str, Any]
PostDocument = dict[str, Any]


async def list_activity_notifications(
    db: AsyncIOMotorDatabase,
    current_user: auth_service.UserDocument,
    limit: int,
) -> list[ActivityNotificationDTO]:
    current_user_id = str(current_user["_id"])
    current_user_keys = mention_keys(current_user)
    following_ids = await get_following_ids(db, current_user_id)
    own_posts = await (
        db.posts.find({"author_id": current_user_id})
        .sort("created_at", -1)
        .limit(80)
        .to_list(length=80)
    )
    own_post_ids = [str(post.get("_id") or post.get("id")) for post in own_posts]
    own_posts_by_id = {str(post.get("_id") or post.get("id")): post for post in own_posts}

    notifications: list[ActivityNotificationDTO] = []
    notifications.extend(await interaction_notifications(db, current_user_id, own_post_ids, own_posts_by_id))
    notifications.extend(await follow_notifications(db, current_user_id))
    notifications.extend(await mention_notifications(db, current_user_id, current_user_keys))
    notifications.extend(await following_activity_notifications(db, current_user_id, following_ids))
    notifications.extend(await shopping_notifications(db, current_user_id, following_ids))
    notifications.extend(await suggestion_notifications(db, current_user_id, following_ids))

    await apply_read_state(db, current_user_id, notifications)
    notifications.sort(key=lambda item: item.created_at, reverse=True)
    return notifications[:limit]


async def mark_notifications_read(
    db: AsyncIOMotorDatabase,
    current_user: auth_service.UserDocument,
    notification_ids: list[str] | None = None,
) -> dict[str, int]:
    current_user_id = str(current_user["_id"])
    now = datetime.now(timezone.utc)
    query: dict[str, Any] = {"user_id": current_user_id}
    if notification_ids:
        query["notification_id"] = {"$in": notification_ids}

    existing_docs = await db.notification_reads.find(query).to_list(length=500)
    existing_ids = {str(item.get("notification_id")) for item in existing_docs}
    target_ids = notification_ids or []
    if target_ids:
        for notification_id in target_ids:
            if notification_id in existing_ids:
                continue
            await db.notification_reads.update_one(
                {"_id": f"{current_user_id}:{notification_id}"},
                {
                    "$set": {
                        "user_id": current_user_id,
                        "notification_id": notification_id,
                        "read_at": now,
                    }
                },
                upsert=True,
            )
        return {"marked": len(target_ids)}

    return {"marked": len(existing_ids)}


async def interaction_notifications(
    db: AsyncIOMotorDatabase,
    current_user_id: str,
    own_post_ids: list[str],
    own_posts_by_id: dict[str, PostDocument],
) -> list[ActivityNotificationDTO]:
    if not own_post_ids:
        return []

    items: list[ActivityNotificationDTO] = []
    items.extend(await collapsed_like_notifications(db, current_user_id, own_post_ids, own_posts_by_id))
    items.extend(await collapsed_save_notifications(db, current_user_id, own_post_ids, own_posts_by_id))
    items.extend(await share_notifications(db, current_user_id, own_post_ids, own_posts_by_id))
    items.extend(await comment_notifications(db, current_user_id, own_post_ids, own_posts_by_id))
    return items


async def collapsed_like_notifications(
    db: AsyncIOMotorDatabase,
    current_user_id: str,
    own_post_ids: list[str],
    own_posts_by_id: dict[str, PostDocument],
) -> list[ActivityNotificationDTO]:
    stored_likes = await (
        db.post_likes.find({"post_id": {"$in": own_post_ids}, "user_id": {"$ne": current_user_id}})
        .sort("created_at", -1)
        .limit(200)
        .to_list(length=200)
    )
    by_post: dict[str, list[dict[str, Any]]] = {}
    for like in stored_likes:
        by_post.setdefault(str(like.get("post_id")), []).append(like)

    # Old data may only have like_user_ids on posts. Keep it visible until new post_likes exist.
    for post_id, post in own_posts_by_id.items():
        if post_id in by_post:
            continue
        legacy_user_ids = [
            str(user_id)
            for user_id in post.get("like_user_ids", [])
            if str(user_id) != current_user_id
        ]
        if legacy_user_ids:
            by_post[post_id] = [
                {
                    "post_id": post_id,
                    "user_id": user_id,
                    "created_at": post.get("updated_at") or post.get("created_at"),
                }
                for user_id in legacy_user_ids
            ]

    notifications: list[ActivityNotificationDTO] = []
    for post_id, likes in by_post.items():
        post = own_posts_by_id.get(post_id)
        if not post:
            continue
        actors = await users_by_ids(db, [str(item.get("user_id")) for item in likes[:3]])
        if not actors:
            continue
        post_dto = await post_to_dto(db, post, current_user_id)
        actor_count = max(len(likes), len(actors))
        notifications.append(
            ActivityNotificationDTO(
                id=stable_id("likes", post_id, ",".join(actor.id for actor in actors)),
                tab="you",
                type="like",
                filter_key="likes",
                actors=actors,
                actor_count=actor_count,
                title=f"{actor_summary(actors, actor_count)} a aime votre publication",
                body=post_dto.caption[:140] or None,
                target_type="post",
                target_id=post_id,
                target_post=post_dto,
                thumbnail_url=first_media_url(post_dto),
                action="open",
                action_label="Voir",
                created_at=max_datetime([item.get("created_at") for item in likes], post),
                read=is_read(max_datetime([item.get("created_at") for item in likes], post)),
            )
        )
    return notifications


async def collapsed_save_notifications(
    db: AsyncIOMotorDatabase,
    current_user_id: str,
    own_post_ids: list[str],
    own_posts_by_id: dict[str, PostDocument],
) -> list[ActivityNotificationDTO]:
    saves = await (
        db.saved_posts.find({"post_id": {"$in": own_post_ids}, "user_id": {"$ne": current_user_id}})
        .sort("created_at", -1)
        .limit(120)
        .to_list(length=120)
    )
    by_post: dict[str, list[dict[str, Any]]] = {}
    for save in saves:
        by_post.setdefault(str(save.get("post_id")), []).append(save)

    notifications: list[ActivityNotificationDTO] = []
    for post_id, post_saves in by_post.items():
        post = own_posts_by_id.get(post_id)
        if not post:
            continue
        actors = await users_by_ids(db, [str(item.get("user_id")) for item in post_saves[:3]])
        if not actors:
            continue
        post_dto = await post_to_dto(db, post, current_user_id)
        actor_count = max(len(post_saves), len(actors))
        created_at = max_datetime([item.get("created_at") for item in post_saves], post)
        notifications.append(
            ActivityNotificationDTO(
                id=stable_id("saves", post_id, ",".join(actor.id for actor in actors)),
                tab="you",
                type="save",
                filter_key="saves",
                actors=actors,
                actor_count=actor_count,
                title=f"{actor_summary(actors, actor_count)} a enregistre votre publication",
                body=post_dto.caption[:140] or None,
                target_type="post",
                target_id=post_id,
                target_post=post_dto,
                thumbnail_url=first_media_url(post_dto),
                action="open",
                action_label="Voir",
                created_at=created_at,
                read=is_read(created_at),
            )
        )
    return notifications


async def share_notifications(
    db: AsyncIOMotorDatabase,
    current_user_id: str,
    own_post_ids: list[str],
    own_posts_by_id: dict[str, PostDocument],
) -> list[ActivityNotificationDTO]:
    shares = await (
        db.post_shares.find({"post_id": {"$in": own_post_ids}, "user_id": {"$ne": current_user_id}})
        .sort("created_at", -1)
        .limit(80)
        .to_list(length=80)
    )
    by_post: dict[str, list[dict[str, Any]]] = {}
    for share in shares:
        by_post.setdefault(str(share.get("post_id")), []).append(share)

    notifications: list[ActivityNotificationDTO] = []
    for post_id, post_shares in by_post.items():
        post = own_posts_by_id.get(post_id)
        if not post:
            continue
        actors = await users_by_ids(db, [str(item.get("user_id")) for item in post_shares[:3]])
        if not actors:
            continue
        post_dto = await post_to_dto(db, post, current_user_id)
        actor_count = max(len(post_shares), len(actors))
        created_at = max_datetime([item.get("created_at") for item in post_shares], post)
        notifications.append(
            ActivityNotificationDTO(
                id=stable_id("shares", post_id, ",".join(actor.id for actor in actors)),
                tab="you",
                type="share",
                filter_key="shares",
                actors=actors,
                actor_count=actor_count,
                title=f"{actor_summary(actors, actor_count)} a partage votre publication",
                body=post_dto.caption[:140] or None,
                target_type="post",
                target_id=post_id,
                target_post=post_dto,
                thumbnail_url=first_media_url(post_dto),
                action="open",
                action_label="Voir",
                created_at=created_at,
                read=is_read(created_at),
            )
        )
    return notifications


async def comment_notifications(
    db: AsyncIOMotorDatabase,
    current_user_id: str,
    own_post_ids: list[str],
    own_posts_by_id: dict[str, PostDocument],
) -> list[ActivityNotificationDTO]:
    comments = await (
        db.comments.find({"post_id": {"$in": own_post_ids}, "author_id": {"$ne": current_user_id}})
        .sort("created_at", -1)
        .limit(80)
        .to_list(length=80)
    )
    notifications: list[ActivityNotificationDTO] = []
    for comment in comments:
        post_id = str(comment.get("post_id"))
        post = own_posts_by_id.get(post_id)
        if not post:
            continue
        actors = await users_by_ids(db, [str(comment.get("author_id"))])
        if not actors:
            continue
        post_dto = await post_to_dto(db, post, current_user_id)
        created_at = normalize_datetime(comment.get("created_at"))
        notifications.append(
            ActivityNotificationDTO(
                id=stable_id("comment", str(comment.get("_id") or comment.get("id"))),
                tab="you",
                type="comment",
                filter_key="comments",
                actors=actors,
                actor_count=1,
                title=f"{actor_summary(actors, 1)} a commente votre publication",
                body=str(comment.get("content") or "")[:180],
                target_type="post",
                target_id=post_id,
                target_post=post_dto,
                thumbnail_url=first_media_url(post_dto),
                action="open",
                action_label="Repondre",
                created_at=created_at,
                read=is_read(created_at),
            )
        )
    return notifications


async def follow_notifications(
    db: AsyncIOMotorDatabase,
    current_user_id: str,
) -> list[ActivityNotificationDTO]:
    notifications: list[ActivityNotificationDTO] = []
    follow_requests = await (
        db.follow_requests.find({"following_id": current_user_id, "status": "pending"})
        .sort("created_at", -1)
        .limit(40)
        .to_list(length=40)
    )
    follows = await (
        db.follows.find({"following_id": current_user_id})
        .sort("created_at", -1)
        .limit(60)
        .to_list(length=60)
    )

    for request in follow_requests:
        actors = await users_by_ids(db, [str(request.get("follower_id"))])
        if not actors:
            continue
        created_at = normalize_datetime(request.get("created_at") or request.get("updated_at"))
        notifications.append(
            ActivityNotificationDTO(
                id=stable_id("follow-request", str(request.get("_id") or request.get("id"))),
                tab="you",
                type="follow_request",
                filter_key="requests",
                actors=actors,
                actor_count=1,
                title=f"{actor_summary(actors, 1)} veut s'abonner a vous",
                body="Compte prive: examinez la demande avant d'accepter.",
                target_type="profile",
                target_id=actors[0].id,
                action="view_request",
                action_label="Voir",
                created_at=created_at,
                read=False,
            )
        )

    for follow in follows:
        follower_id = str(follow.get("follower_id"))
        actors = await users_by_ids(db, [follower_id])
        if not actors:
            continue
        created_at = normalize_datetime(follow.get("created_at") or follow.get("updated_at"))
        follow_action, follow_action_label = await follow_back_action(db, current_user_id, follower_id)
        notifications.append(
            ActivityNotificationDTO(
                id=stable_id("follow", str(follow.get("_id") or follow.get("id"))),
                tab="you",
                type="follow",
                filter_key="follows",
                actors=actors,
                actor_count=1,
                title=f"{actor_summary(actors, 1)} s'est abonne a vous",
                body="Vous pouvez vous abonner en retour sans quitter l'activite.",
                target_type="profile",
                target_id=actors[0].id,
                action=follow_action,
                action_label=follow_action_label,
                created_at=created_at,
                read=is_read(created_at),
            )
        )

    return notifications


async def mention_notifications(
    db: AsyncIOMotorDatabase,
    current_user_id: str,
    current_user_keys: set[str],
) -> list[ActivityNotificationDTO]:
    if not current_user_keys:
        return []

    notifications: list[ActivityNotificationDTO] = []
    comments = await (
        db.comments.find({"author_id": {"$ne": current_user_id}})
        .sort("created_at", -1)
        .limit(120)
        .to_list(length=120)
    )
    for comment in comments:
        content = str(comment.get("content") or "")
        if not contains_mention(content, current_user_keys):
            continue
        actors = await users_by_ids(db, [str(comment.get("author_id"))])
        post = await db.posts.find_one({"_id": str(comment.get("post_id"))})
        if not actors or not post:
            continue
        post_dto = await post_to_dto(db, post, current_user_id)
        created_at = normalize_datetime(comment.get("created_at"))
        notifications.append(
            ActivityNotificationDTO(
                id=stable_id("mention-comment", str(comment.get("_id") or comment.get("id"))),
                tab="you",
                type="mention",
                filter_key="mentions",
                actors=actors,
                actor_count=1,
                title=f"{actor_summary(actors, 1)} vous a mentionne dans un commentaire",
                body=content[:180],
                target_type="post",
                target_id=post_dto.id,
                target_post=post_dto,
                thumbnail_url=first_media_url(post_dto),
                action="open",
                action_label="Voir",
                created_at=created_at,
                read=is_read(created_at),
            )
        )

    posts = await (
        db.posts.find({"author_id": {"$ne": current_user_id}})
        .sort("created_at", -1)
        .limit(120)
        .to_list(length=120)
    )
    for post in posts:
        caption = str(post.get("caption") or post.get("description") or "")
        if not contains_mention(caption, current_user_keys):
            continue
        actors = await users_by_ids(db, [str(post.get("author_id"))])
        if not actors:
            continue
        post_dto = await post_to_dto(db, post, current_user_id)
        created_at = normalize_datetime(post.get("created_at"))
        notifications.append(
            ActivityNotificationDTO(
                id=stable_id("mention-post", post_dto.id),
                tab="you",
                type="tag",
                filter_key="mentions",
                actors=actors,
                actor_count=1,
                title=f"{actor_summary(actors, 1)} vous a tague dans une publication",
                body=caption[:180],
                target_type="post",
                target_id=post_dto.id,
                target_post=post_dto,
                thumbnail_url=first_media_url(post_dto),
                action="open",
                action_label="Voir",
                created_at=created_at,
                read=is_read(created_at),
            )
        )
    return notifications


async def following_activity_notifications(
    db: AsyncIOMotorDatabase,
    current_user_id: str,
    following_ids: list[str],
) -> list[ActivityNotificationDTO]:
    if not following_ids:
        return []

    notifications: list[ActivityNotificationDTO] = []
    live_sessions = await (
        db.live_sessions.find({"host_id": {"$in": following_ids}, "status": "live"})
        .sort("started_at", -1)
        .limit(20)
        .to_list(length=20)
    )
    for live in live_sessions:
        actors = await users_by_ids(db, [str(live.get("host_id"))])
        if not actors:
            continue
        created_at = normalize_datetime(live.get("started_at") or live.get("created_at"))
        notifications.append(
            ActivityNotificationDTO(
                id=stable_id("live", str(live.get("_id") or live.get("id"))),
                tab="following",
                type="live",
                filter_key="live",
                actors=actors,
                actor_count=1,
                title=f"{actor_summary(actors, 1)} est en live",
                body=str(live.get("title") or "Live DressMe"),
                target_type="live",
                target_id=str(live.get("_id") or live.get("id")),
                action="open",
                action_label="Regarder",
                created_at=created_at,
                read=False,
            )
        )

    stories = await (
        db.stories.find({"author_id": {"$in": following_ids}})
        .sort("created_at", -1)
        .limit(40)
        .to_list(length=40)
    )
    seen_story_authors: set[str] = set()
    for story in stories:
        author_id = str(story.get("author_id"))
        if author_id in seen_story_authors:
            continue
        seen_story_authors.add(author_id)
        actors = await users_by_ids(db, [author_id])
        if not actors:
            continue
        created_at = normalize_datetime(story.get("created_at"))
        notifications.append(
            ActivityNotificationDTO(
                id=stable_id("story", str(story.get("_id") or story.get("id"))),
                tab="following",
                type="story",
                filter_key="stories",
                actors=actors,
                actor_count=1,
                title=f"{actor_summary(actors, 1)} a publie une story",
                body=str(story.get("caption") or "Nouvelle story a voir"),
                target_type="story",
                target_id=str(story.get("_id") or story.get("id")),
                thumbnail_url=str(story.get("media_url") or ""),
                action="open",
                action_label="Voir",
                created_at=created_at,
                read=is_read(created_at),
            )
        )

    posts = await (
        db.posts.find({"author_id": {"$in": following_ids}})
        .sort("created_at", -1)
        .limit(40)
        .to_list(length=40)
    )
    for post in posts[:16]:
        actors = await users_by_ids(db, [str(post.get("author_id"))])
        if not actors:
            continue
        post_dto = await post_to_dto(db, post, current_user_id)
        created_at = normalize_datetime(post.get("created_at"))
        notifications.append(
            ActivityNotificationDTO(
                id=stable_id("following-post", post_dto.id),
                tab="following",
                type="post",
                filter_key="all",
                actors=actors,
                actor_count=1,
                title=f"{actor_summary(actors, 1)} a publie une nouvelle tenue",
                body=post_dto.caption[:160] or None,
                target_type="post",
                target_id=post_dto.id,
                target_post=post_dto,
                thumbnail_url=first_media_url(post_dto),
                action="open",
                action_label="Voir",
                created_at=created_at,
                read=is_read(created_at),
            )
        )

    return notifications


async def shopping_notifications(
    db: AsyncIOMotorDatabase,
    current_user_id: str,
    following_ids: list[str],
) -> list[ActivityNotificationDTO]:
    candidate_author_ids = following_ids or [current_user_id]
    posts = await (
        db.posts.find({"author_id": {"$in": candidate_author_ids}})
        .sort("created_at", -1)
        .limit(120)
        .to_list(length=120)
    )
    notifications: list[ActivityNotificationDTO] = []
    for post in posts:
        tags = [
            str(tag).lower()
            for tag in [
                *post.get("hashtags", []),
                *post.get("garment_tags", []),
                post.get("caption") or post.get("description") or "",
            ]
        ]
        if not any(keyword in " ".join(tags) for keyword in ("sale", "soldes", "drop", "shop", "promo")):
            continue
        actors = await users_by_ids(db, [str(post.get("author_id"))])
        if not actors:
            continue
        post_dto = await post_to_dto(db, post, current_user_id)
        created_at = normalize_datetime(post.get("created_at"))
        notifications.append(
            ActivityNotificationDTO(
                id=stable_id("shopping", post_dto.id),
                tab="following",
                type="shopping",
                filter_key="shopping",
                actors=actors,
                actor_count=1,
                title="Drop ou promo repere dans votre reseau",
                body=post_dto.caption[:160] or "Une publication shopping correspond a vos interets.",
                target_type="shopping",
                target_id=post_dto.id,
                target_post=post_dto,
                thumbnail_url=first_media_url(post_dto),
                action="open",
                action_label="Voir",
                created_at=created_at,
                read=is_read(created_at),
            )
        )
        if len(notifications) >= 8:
            break
    return notifications


async def suggestion_notifications(
    db: AsyncIOMotorDatabase,
    current_user_id: str,
    following_ids: list[str],
) -> list[ActivityNotificationDTO]:
    excluded = [current_user_id, *following_ids]
    candidates = await (
        db.users.find({"_id": {"$nin": excluded}})
        .sort([("followers_count", -1), ("created_at", -1)])
        .limit(16)
        .to_list(length=16)
    )
    notifications: list[ActivityNotificationDTO] = []
    now = datetime.now(timezone.utc)
    for user in candidates[:4]:
        user_id = str(user.get("_id") or user.get("id"))
        actor = user_to_dto(user, user_id)
        mutual_count = await mutual_follow_count(db, current_user_id, user_id)
        created_at = normalize_datetime(user.get("created_at") or now)
        body = (
            f"{mutual_count} connexion(s) en commun"
            if mutual_count
            else "Compte recommande selon l'activite de la communaute"
        )
        notifications.append(
            ActivityNotificationDTO(
                id=stable_id("suggestion", user_id),
                tab="following",
                type="suggestion",
                filter_key="suggestions",
                actors=[actor],
                actor_count=1,
                title=f"Suggestion pour vous: {display_name(actor)}",
                body=body,
                target_type="profile",
                target_id=user_id,
                action="follow_back",
                action_label="Suivre",
                created_at=created_at,
                read=True,
            )
        )
    return notifications


async def get_following_ids(db: AsyncIOMotorDatabase, current_user_id: str) -> list[str]:
    docs = await db.follows.find({"follower_id": current_user_id}).to_list(length=300)
    return [str(item.get("following_id")) for item in docs if item.get("following_id")]


async def follow_back_action(
    db: AsyncIOMotorDatabase,
    current_user_id: str,
    target_user_id: str,
) -> tuple[str, str]:
    if current_user_id == target_user_id:
        return "none", "Vous"

    existing_follow = await db.follows.find_one(
        {"follower_id": current_user_id, "following_id": target_user_id}
    )
    if existing_follow:
        return "none", "Suivi"

    existing_request = await db.follow_requests.find_one(
        {
            "follower_id": current_user_id,
            "following_id": target_user_id,
            "status": "pending",
        }
    )
    if existing_request:
        return "none", "Demande envoyee"

    return "follow_back", "Suivre"


async def users_by_ids(db: AsyncIOMotorDatabase, user_ids: list[str]) -> list[UserDTO]:
    ordered_ids = [user_id for user_id in user_ids if user_id]
    if not ordered_ids:
        return []
    docs = await db.users.find({"_id": {"$in": ordered_ids}}).to_list(length=len(ordered_ids))
    by_id = {str(user.get("_id") or user.get("id")): user for user in docs}
    return [user_to_dto(by_id[user_id], user_id) for user_id in ordered_ids if user_id in by_id]


async def mutual_follow_count(db: AsyncIOMotorDatabase, current_user_id: str, target_user_id: str) -> int:
    my_following = await get_following_ids(db, current_user_id)
    if not my_following:
        return 0
    target_followers = await db.follows.find({"following_id": target_user_id}).to_list(length=500)
    target_follower_ids = {str(item.get("follower_id")) for item in target_followers}
    return len(set(my_following) & target_follower_ids)


def mention_keys(user: UserDocument) -> set[str]:
    raw_values = [
        user.get("username"),
        user.get("email", "").split("@")[0] if user.get("email") else "",
        user.get("first_name"),
        user.get("last_name"),
    ]
    return {str(value).strip().lower() for value in raw_values if str(value).strip()}


def contains_mention(text: str, keys: set[str]) -> bool:
    lowered = text.lower()
    return any(f"@{key}" in lowered for key in keys)


def actor_summary(actors: list[UserDTO], actor_count: int) -> str:
    names = [display_name(actor) for actor in actors]
    if not names:
        return "Quelqu'un"
    if actor_count <= 1:
        return names[0]
    if actor_count == 2 and len(names) >= 2:
        return f"{names[0]} et {names[1]}"
    if len(names) >= 2:
        return f"{names[0]}, {names[1]} et {actor_count - 2} autre(s)"
    return f"{names[0]} et {actor_count - 1} autre(s)"


def display_name(user: UserDTO) -> str:
    name = f"{user.first_name or ''} {user.last_name or ''}".strip()
    if name:
        return name
    return user.username or (user.email.split("@")[0] if user.email else "Utilisateur DressMe")


def first_media_url(post: PostDTO) -> str | None:
    return post.image_urls[0] if post.image_urls else None


def max_datetime(values: list[Any], fallback: PostDocument) -> datetime:
    datetimes = [normalize_datetime(value) for value in values if value]
    if datetimes:
        return max(datetimes)
    return normalize_datetime(fallback.get("updated_at") or fallback.get("created_at"))


def is_read(created_at: datetime) -> bool:
    return created_at < datetime.now(timezone.utc) - timedelta(hours=36)


async def apply_read_state(
    db: AsyncIOMotorDatabase,
    current_user_id: str,
    notifications: list[ActivityNotificationDTO],
) -> None:
    if not notifications:
        return

    notification_ids = [notification.id for notification in notifications]
    read_docs = await db.notification_reads.find(
        {
            "user_id": current_user_id,
            "notification_id": {"$in": notification_ids},
        }
    ).to_list(length=len(notification_ids))
    read_ids = {str(item.get("notification_id")) for item in read_docs}

    for notification in notifications:
        if notification.id in read_ids:
            notification.read = True


def stable_id(*parts: str) -> str:
    return str(uuid5(NAMESPACE_URL, ":".join(parts)))
