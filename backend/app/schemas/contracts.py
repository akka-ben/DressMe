from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field


class UserDTO(BaseModel):
    id: str
    first_name: str | None = None
    last_name: str | None = None
    email: EmailStr | None = None
    avatar_url: str | None = None
    bio: str | None = None


class ProfileDTO(UserDTO):
    follower_count: int = 0
    following_count: int = 0
    post_count: int = 0
    last_seen: datetime | None = None


class CommentDTO(BaseModel):
    id: str
    author: UserDTO
    content: str
    created_at: datetime


class AddCommentInput(BaseModel):
    content: str = Field(..., min_length=1, max_length=500)


class PollOptionDTO(BaseModel):
    id: str
    label: str
    image_url: str
    votes: int = 0


class PollDTO(BaseModel):
    id: str
    options: list[PollOptionDTO]
    total_votes: int = 0


class PostDTO(BaseModel):
    id: str
    author: UserDTO
    caption: str
    media_type: Literal["image", "video"] = "image"
    hashtags: list[str] = Field(default_factory=list)
    garment_tags: list[str] = Field(default_factory=list)
    image_urls: list[str] = Field(default_factory=list)
    like_count: int = 0
    comment_count: int = 0
    share_count: int = 0
    liked_by_me: bool = False
    saved_by_me: bool = False
    created_at: datetime
    poll: PollDTO | None = None


class CreatePostInput(BaseModel):
    caption: str = Field(..., min_length=1, max_length=1200)
    media_type: Literal["image", "video"] = "image"
    image_urls: list[str] = Field(..., min_length=1, max_length=6)
    hashtags: list[str] = Field(default_factory=list, max_length=12)
    garment_tags: list[str] = Field(default_factory=list, max_length=12)


class StoryDTO(BaseModel):
    id: str
    author: UserDTO
    media_url: str
    media_type: Literal["image", "video"] = "image"
    caption: str | None = None
    viewer_count: int = 0
    viewed_by_me: bool = False
    created_at: datetime
    expires_at: datetime


class CreateStoryInput(BaseModel):
    media_url: str = Field(..., min_length=1)
    media_type: Literal["image", "video"] = "image"
    caption: str | None = Field(default=None, max_length=500)


class MediaUploadDTO(BaseModel):
    url: str
    filename: str
    content_type: str
    media_type: Literal["image", "video"]


class AuthTokenDTO(BaseModel):
    access_token: str
    refresh_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserDTO


class LoginInput(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False


class RegisterInput(BaseModel):
    first_name: str
    last_name: str
    email: EmailStr
    password: str = Field(min_length=8)
    avatar_url: str | None = None
    bio: str | None = None


class AIRecommendationItemDTO(BaseModel):
    category: str
    description: str
    color: str | None = None


class AIRecommendationDTO(BaseModel):
    id: str
    title: str
    rationale: str
    items: list[AIRecommendationItemDTO]
    preview_image_url: str


class HelpMeChooseInput(BaseModel):
    image_url: str
    occasion: str | None = None
    user_prompt: str | None = None


class MessageDTO(BaseModel):
    id: str
    conversation_id: str
    kind: Literal["text", "image", "shared_post", "shared_ai_look"]
    body: str
    sender: UserDTO
    created_at: datetime


class ConversationDTO(BaseModel):
    id: str
    title: str
    participants: list[UserDTO]
    last_message: MessageDTO | None = None


class CallSessionDTO(BaseModel):
    id: str
    kind: Literal["audio", "video"]
    state: Literal["ringing", "connecting", "in_call", "ended"]
    peer: UserDTO
