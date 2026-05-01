from datetime import datetime, timedelta
from uuid import uuid4

from fastapi import APIRouter

from app.schemas.contracts import CommentDTO, PollDTO, PollOptionDTO, PostDTO, UserDTO


router = APIRouter()


def _author() -> UserDTO:
    return UserDTO(
        id=str(uuid4()),
        first_name="Amine",
        last_name="El Meskini",
        email="amine@example.com",
        avatar_url="https://images.unsplash.com/photo-1494790108377-be9c29b29330",
        bio="Clean fits and layered looks.",
    )


def _post() -> PostDTO:
    return PostDTO(
        id=str(uuid4()),
        author=_author(),
        caption="Need feedback for tonight's outfit.",
        hashtags=["#soiree", "#smartcasual"],
        garment_tags=["blazer", "beige", "loafers"],
        image_urls=[
            "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f",
            "https://images.unsplash.com/photo-1483985988355-763728e1935b",
        ],
        like_count=14,
        comment_count=4,
        liked_by_me=False,
        created_at=datetime.utcnow() - timedelta(hours=2),
        poll=PollDTO(
            id=str(uuid4()),
            options=[
                PollOptionDTO(
                    id=str(uuid4()),
                    label="Tenue A",
                    image_url="https://images.unsplash.com/photo-1515886657613-9f3515b0c78f",
                    votes=12,
                ),
                PollOptionDTO(
                    id=str(uuid4()),
                    label="Tenue B",
                    image_url="https://images.unsplash.com/photo-1483985988355-763728e1935b",
                    votes=18,
                ),
            ],
            total_votes=30,
        ),
    )


@router.get("/feed", response_model=list[PostDTO])
async def feed() -> list[PostDTO]:
    return [_post()]


@router.get("/posts/{post_id}", response_model=PostDTO)
async def post_detail(post_id: str) -> PostDTO:
    return _post().model_copy(update={"id": post_id})


@router.get("/posts/{post_id}/comments", response_model=list[CommentDTO])
async def post_comments(post_id: str) -> list[CommentDTO]:
    return [
        CommentDTO(
            id=str(uuid4()),
            author=_author(),
            content="The blazer works better with darker shoes.",
            created_at=datetime.utcnow() - timedelta(minutes=35),
        )
    ]
