from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends, Query
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.session import get_db
from app.modules.auth import service as auth_service
from app.modules.notifications import service
from app.schemas.contracts import ActivityNotificationDTO


router = APIRouter()


class MarkNotificationsReadInput(BaseModel):
    notification_ids: list[str] = Field(default_factory=list, max_length=120)


@router.get("/activity", response_model=list[ActivityNotificationDTO])
async def activity_notifications(
    limit: int = Query(default=80, ge=1, le=120),
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> list[ActivityNotificationDTO]:
    return await service.list_activity_notifications(db, current_user, limit)


@router.post("/activity/read")
async def mark_activity_notifications_read(
    payload: MarkNotificationsReadInput,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> dict[str, int]:
    return await service.mark_notifications_read(
        db,
        current_user,
        payload.notification_ids or None,
    )
