from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.session import get_db
from app.modules.auth import service as auth_service
from app.modules.social.service import user_to_dto
from app.schemas.contracts import ProfileDTO, UserDTO


router = APIRouter()


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
async def get_user(user_id: str) -> ProfileDTO:
    return ProfileDTO(
        id=user_id,
        first_name="Mohammed",
        last_name="Ben Akka Ouayad",
        email="mohammed@example.com",
        avatar_url="https://images.unsplash.com/photo-1500648767791-00dcc994a43e",
        bio="Streetwear and smart casual looks.",
        follower_count=120,
        following_count=98,
        post_count=12,
    )
