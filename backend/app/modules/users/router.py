from fastapi import APIRouter

from app.schemas.contracts import ProfileDTO


router = APIRouter()


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
