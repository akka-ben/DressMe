from fastapi import APIRouter, Depends, Query, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.session import get_db
from app.modules.auth import service as auth_service
from app.modules.social import service
from app.schemas.contracts import (
    AddCommentInput,
    CommentDTO,
    CreatePostInput,
    CreateStoryInput,
    MessageResponse,
    PostDTO,
    ReportPostInput,
    SearchResultDTO,
    StoryDTO,
    UserDTO,
)


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


@router.get("/reels", response_model=list[PostDTO])
async def reels(
    limit: int = Query(default=8, ge=1, le=20),
    offset: int = Query(default=0, ge=0),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument | None = Depends(optional_current_user),
) -> list[PostDTO]:
    current_user_id = str(current_user["_id"]) if current_user else None
    return await service.list_reels_posts(db, current_user_id, limit, offset)


@router.get("/search", response_model=SearchResultDTO)
async def search(
    q: str = Query(default="", max_length=80),
    limit: int = Query(default=12, ge=1, le=30),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument | None = Depends(optional_current_user),
) -> SearchResultDTO:
    current_user_id = str(current_user["_id"]) if current_user else None
    return await service.search_explore(db, q, current_user_id, limit)


@router.post("/posts", response_model=PostDTO, status_code=status.HTTP_201_CREATED)
async def create_post(
    payload: CreatePostInput,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> PostDTO:
    return await service.create_post(db, payload, current_user)


@router.get("/stories", response_model=list[StoryDTO])
async def stories(
    limit: int = Query(default=20, ge=1, le=50),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument | None = Depends(optional_current_user),
) -> list[StoryDTO]:
    current_user_id = str(current_user["_id"]) if current_user else None
    return await service.list_stories(db, current_user_id, limit)


@router.post("/stories", response_model=StoryDTO, status_code=status.HTTP_201_CREATED)
async def create_story(
    payload: CreateStoryInput,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> StoryDTO:
    return await service.create_story(db, payload, current_user)


@router.post("/stories/{story_id}/view", response_model=StoryDTO)
async def view_story(
    story_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> StoryDTO:
    return await service.mark_story_viewed(db, story_id, current_user)


@router.get("/stories/{story_id}/viewers", response_model=list[UserDTO])
async def story_viewers(
    story_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> list[UserDTO]:
    return await service.list_story_viewers(db, story_id, current_user)


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


@router.post("/posts/{post_id}/share", response_model=PostDTO)
async def share_post(
    post_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> PostDTO:
    return await service.register_share(db, post_id, current_user)


@router.post("/posts/{post_id}/report", response_model=MessageResponse)
async def report_post(
    post_id: str,
    payload: ReportPostInput,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> MessageResponse:
    return MessageResponse(**await service.report_post(db, post_id, payload, current_user))


@router.get("/posts/{post_id}/comments", response_model=list[CommentDTO])
async def post_comments(
    post_id: str,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[CommentDTO]:
    return await service.list_post_comments(db, post_id, limit, offset)


@router.post("/posts/{post_id}/comments", response_model=CommentDTO, status_code=status.HTTP_201_CREATED)
async def add_post_comment(
    post_id: str,
    payload: AddCommentInput,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> CommentDTO:
    return await service.add_post_comment(db, post_id, payload, current_user)


@router.post("/posts/{post_id}/save", response_model=PostDTO)
async def toggle_post_save(
    post_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> PostDTO:
    return await service.toggle_save(db, post_id, current_user)


@router.get("/users/me/saved-posts", response_model=list[PostDTO])
async def saved_posts(
    media_type: str | None = Query(default=None, pattern="^(image|video)$"),
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> list[PostDTO]:
    return await service.list_saved_posts(db, current_user, media_type, limit, offset)


@router.delete("/posts/{post_id}", response_model=MessageResponse)
async def delete_post(
    post_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> MessageResponse:
    return await service.delete_post(db, post_id, current_user)



@router.delete("/posts/{post_id}")
async def delete_post(
    post_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user = Depends(auth_service.get_current_user),
):
    return await service.delete_post(db, post_id, current_user)

