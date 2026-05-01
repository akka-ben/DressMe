from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.session import get_db
from app.modules.auth import service as auth_service
from app.modules.social import service
from app.schemas.contracts import CommentDTO, CreatePostInput, PostDTO, UserDTO


router = APIRouter()


async def optional_current_user(
    credentials=Depends(auth_service.bearer_scheme),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> auth_service.UserDocument | None:
    if credentials is None:
        return None
    return await auth_service.get_current_user(credentials=credentials, db=db)


@router.get("/feed", response_model=list[PostDTO])
async def feed(
    limit: int = Query(default=10, ge=1, le=30),
    offset: int = Query(default=0, ge=0),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument | None = Depends(optional_current_user),
) -> list[PostDTO]:
    current_user_id = str(current_user["_id"]) if current_user else None
    return await service.list_feed_posts(db, current_user_id, limit, offset)


@router.post("/posts", response_model=PostDTO, status_code=status.HTTP_201_CREATED)
async def create_post(
    payload: CreatePostInput,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> PostDTO:
    return await service.create_post(db, payload, current_user)


@router.get("/posts/{post_id}", response_model=PostDTO)
async def post_detail(
    post_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument | None = Depends(optional_current_user),
) -> PostDTO:
    current_user_id = str(current_user["_id"]) if current_user else None
    return await service.get_post(db, post_id, current_user_id)


@router.post("/posts/{post_id}/like", response_model=PostDTO)
async def toggle_post_like(
    post_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> PostDTO:
    return await service.toggle_like(db, post_id, current_user)


@router.get("/posts/{post_id}/comments", response_model=list[CommentDTO])
async def post_comments(post_id: str) -> list[CommentDTO]:
    return [
        CommentDTO(
            id=str(uuid4()),
            author=UserDTO(
                id=str(uuid4()),
                first_name="Amina",
                last_name="Benjelloun",
                email="amina@example.com",
                avatar_url="https://api.dicebear.com/8.x/avataaars/png?seed=Amina",
                bio="Casablanca fits.",
            ),
            content="The blazer works better with darker shoes.",
            created_at=datetime.utcnow(),
        )
    ]
