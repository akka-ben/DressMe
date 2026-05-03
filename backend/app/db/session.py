from collections.abc import AsyncGenerator

from app.core.config import settings
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING
from pymongo.errors import OperationFailure


mongo_client = AsyncIOMotorClient(settings.mongodb_url)
database = mongo_client[settings.mongodb_db_name]


async def get_db() -> AsyncGenerator[AsyncIOMotorDatabase, None]:
    yield database


async def ensure_unique_string_index(
    collection_name: str,
    field_name: str,
    index_name: str,
) -> None:
    collection = database[collection_name]
    indexes = await collection.index_information()
    expected_filter = {field_name: {"$type": "string"}}

    for existing_name, existing in indexes.items():
        if existing_name == "_id_":
            continue
        if existing.get("key") != [(field_name, ASCENDING)]:
            continue
        if (
            existing_name != index_name
            or existing.get("unique") is not True
            or existing.get("partialFilterExpression") != expected_filter
        ):
            await collection.drop_index(existing_name)

    try:
        await collection.create_index(
            [(field_name, ASCENDING)],
            name=index_name,
            unique=True,
            partialFilterExpression=expected_filter,
        )
    except OperationFailure as exc:
        if "already exists with different options" not in str(exc):
            raise
        await collection.drop_index(index_name)
        await collection.create_index(
            [(field_name, ASCENDING)],
            name=index_name,
            unique=True,
            partialFilterExpression=expected_filter,
        )


async def init_db() -> None:
    await ensure_unique_string_index("users", "email", "users_email_unique")
    await ensure_unique_string_index("users", "phone_number", "users_phone_unique")
    await ensure_unique_string_index(
        "users",
        "verification_token",
        "users_verification_token_unique",
    )
    await ensure_unique_string_index("users", "reset_token", "users_reset_token_unique")
    await database.posts.create_index([("created_at", ASCENDING)], name="posts_created_at")
    await database.posts.create_index([("author_id", ASCENDING)], name="posts_author_id")
    await database.comments.create_index([("post_id", ASCENDING), ("created_at", ASCENDING)], name="comments_post_created_at")
    await database.saved_posts.create_index([("user_id", ASCENDING), ("created_at", ASCENDING)], name="saved_posts_user_created_at")
    await database.saved_posts.create_index(
        [("user_id", ASCENDING), ("post_id", ASCENDING)],
        name="saved_posts_user_post_unique",
        unique=True,
    )
    await database.post_shares.create_index([("post_id", ASCENDING), ("created_at", ASCENDING)], name="post_shares_post_created_at")
    await database.post_shares.create_index([("user_id", ASCENDING), ("created_at", ASCENDING)], name="post_shares_user_created_at")
    await database.stories.create_index([("created_at", ASCENDING)], name="stories_created_at")
    await database.stories.create_index([("expires_at", ASCENDING)], name="stories_expires_at")
    await database.stories.create_index([("author_id", ASCENDING), ("created_at", ASCENDING)], name="stories_author_created_at")
