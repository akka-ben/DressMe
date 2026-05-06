from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.modules.social.service import normalize_datetime, user_to_dto
from app.schemas.contracts import CreateLiveSessionInput, LiveSessionDTO


LiveSessionDocument = dict[str, Any]
UserDocument = dict[str, Any]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


async def live_session_to_dto(
    db: AsyncIOMotorDatabase,
    session: LiveSessionDocument,
    connected_viewer_count: int = 0,
) -> LiveSessionDTO:
    session_id = str(session.get("id") or session.get("_id"))
    host_id = str(session.get("host_id"))
    host = await db.users.find_one({"_id": host_id})
    persisted_viewer_count = len([item for item in session.get("viewer_ids", []) if str(item) != host_id])

    return LiveSessionDTO(
        id=session_id,
        host=user_to_dto(host, host_id),
        title=session.get("title"),
        status="ended" if session.get("status") == "ended" else "live",
        viewer_count=max(persisted_viewer_count, connected_viewer_count),
        started_at=normalize_datetime(session.get("started_at")),
        ended_at=normalize_datetime(session.get("ended_at")) if session.get("ended_at") else None,
    )


async def create_live_session(
    db: AsyncIOMotorDatabase,
    payload: CreateLiveSessionInput,
    current_user: UserDocument,
) -> LiveSessionDTO:
    host_id = str(current_user["_id"])
    now = utc_now()

    await db.live_sessions.update_many(
        {"host_id": host_id, "status": "live"},
        {"$set": {"status": "ended", "ended_at": now, "updated_at": now}},
    )

    session_id = str(uuid4())
    session: LiveSessionDocument = {
        "_id": session_id,
        "id": session_id,
        "host_id": host_id,
        "title": payload.title or "Live DressMe",
        "status": "live",
        "viewer_ids": [],
        "started_at": now,
        "updated_at": now,
    }
    await db.live_sessions.insert_one(session)
    return await live_session_to_dto(db, session)


async def list_live_sessions(
    db: AsyncIOMotorDatabase,
    connected_counts: dict[str, int] | None = None,
    limit: int = 20,
) -> list[LiveSessionDTO]:
    cursor = db.live_sessions.find({"status": "live"}).sort("started_at", -1).limit(limit)
    sessions = await cursor.to_list(length=limit)
    counts = connected_counts or {}
    return [
        await live_session_to_dto(db, session, counts.get(str(session.get("id") or session.get("_id")), 0))
        for session in sessions
    ]


async def get_live_session(
    db: AsyncIOMotorDatabase,
    live_id: str,
    connected_viewer_count: int = 0,
) -> LiveSessionDTO:
    session = await db.live_sessions.find_one({"_id": live_id})
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Live session not found")
    return await live_session_to_dto(db, session, connected_viewer_count)


async def end_live_session(
    db: AsyncIOMotorDatabase,
    live_id: str,
    current_user: UserDocument,
) -> LiveSessionDTO:
    session = await db.live_sessions.find_one({"_id": live_id})
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Live session not found")

    if str(session.get("host_id")) != str(current_user["_id"]):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the live host can end this session")

    now = utc_now()
    await db.live_sessions.update_one(
        {"_id": live_id},
        {"$set": {"status": "ended", "ended_at": now, "updated_at": now}},
    )
    updated = await db.live_sessions.find_one({"_id": live_id})
    return await live_session_to_dto(db, updated or session)


async def mark_viewer_joined(
    db: AsyncIOMotorDatabase,
    live_id: str,
    viewer_id: str,
) -> None:
    await db.live_sessions.update_one(
        {"_id": live_id, "status": "live"},
        {
            "$addToSet": {"viewer_ids": viewer_id},
            "$set": {"updated_at": utc_now()},
        },
    )


async def mark_live_ended_by_disconnect(
    db: AsyncIOMotorDatabase,
    live_id: str,
) -> None:
    now = utc_now()
    await db.live_sessions.update_one(
        {"_id": live_id, "status": "live"},
        {"$set": {"status": "ended", "ended_at": now, "updated_at": now}},
    )
