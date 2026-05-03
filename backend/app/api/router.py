from fastapi import APIRouter

from app.modules.calls.router import router as calls_router
from app.modules.chat.router import router as chat_router
from app.modules.ai.router import router as ai_router
from app.modules.auth.router import router as auth_router
from app.modules.media.router import router as media_router
from app.modules.social.router import router as social_router
from app.modules.users.router import router as users_router


api_router = APIRouter()
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(social_router, tags=["social"])
api_router.include_router(media_router, prefix="/media", tags=["media"])
api_router.include_router(chat_router, prefix="/chat", tags=["chat"])
api_router.include_router(calls_router, prefix="/calls", tags=["calls"])
api_router.include_router(ai_router, prefix="/ai", tags=["ai"])
