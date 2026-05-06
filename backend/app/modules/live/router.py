from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect, status
from jose import JWTError
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.security import decode_access_token
from app.db.session import database, get_db
from app.modules.auth import service as auth_service
from app.modules.live import service
from app.modules.social.service import user_to_dto
from app.schemas.contracts import CreateLiveSessionInput, LiveSessionDTO


router = APIRouter()

LiveRole = Literal["host", "viewer"]


@dataclass
class LiveRoom:
    host: WebSocket | None = None
    host_id: str | None = None
    viewers: dict[str, WebSocket] = field(default_factory=dict)


class LiveConnectionManager:
    def __init__(self) -> None:
        self.rooms: dict[str, LiveRoom] = {}

    def connected_viewer_counts(self) -> dict[str, int]:
        return {live_id: len(room.viewers) for live_id, room in self.rooms.items()}

    def viewer_count(self, live_id: str) -> int:
        return len(self.rooms.get(live_id, LiveRoom()).viewers)

    async def connect(self, live_id: str, websocket: WebSocket, role: LiveRole, user_id: str) -> None:
        await websocket.accept()
        room = self.rooms.setdefault(live_id, LiveRoom())
        if role == "host":
            room.host = websocket
            room.host_id = user_id
            await websocket.send_json({"type": "host_ready", "live_id": live_id})
            return

        room.viewers[user_id] = websocket
        await websocket.send_json({"type": "viewer_ready", "live_id": live_id, "viewer_id": user_id})

    async def disconnect(self, live_id: str, role: LiveRole, user_id: str) -> bool:
        room = self.rooms.get(live_id)
        if not room:
            return False

        host_disconnected = False
        if role == "host" and room.host_id == user_id:
            host_disconnected = True
            room.host = None
            room.host_id = None
            await self.broadcast_to_viewers(live_id, {"type": "live_ended", "live_id": live_id})
        elif role == "viewer":
            room.viewers.pop(user_id, None)
            await self.send_to_host(live_id, {"type": "viewer_left", "viewer_id": user_id})

        if not room.host and not room.viewers:
            self.rooms.pop(live_id, None)

        return host_disconnected

    async def send_to_host(self, live_id: str, message: dict[str, Any]) -> None:
        host = self.rooms.get(live_id, LiveRoom()).host
        if host:
            await host.send_json(message)

    async def send_to_viewer(self, live_id: str, viewer_id: str, message: dict[str, Any]) -> None:
        viewer = self.rooms.get(live_id, LiveRoom()).viewers.get(viewer_id)
        if viewer:
            await viewer.send_json(message)

    async def broadcast_to_viewers(self, live_id: str, message: dict[str, Any]) -> None:
        room = self.rooms.get(live_id)
        if not room:
            return
        stale_viewer_ids: list[str] = []
        for viewer_id, websocket in room.viewers.items():
            try:
                await websocket.send_json(message)
            except RuntimeError:
                stale_viewer_ids.append(viewer_id)
        for viewer_id in stale_viewer_ids:
            room.viewers.pop(viewer_id, None)

    async def close_room(self, live_id: str) -> None:
        room = self.rooms.pop(live_id, None)
        if not room:
            return

        for websocket in room.viewers.values():
            await websocket.send_json({"type": "live_ended", "live_id": live_id})
            await websocket.close(code=status.WS_1000_NORMAL_CLOSURE)
        if room.host:
            await room.host.close(code=status.WS_1000_NORMAL_CLOSURE)


manager = LiveConnectionManager()


@router.post("/sessions", response_model=LiveSessionDTO, status_code=status.HTTP_201_CREATED)
async def create_live_session(
    payload: CreateLiveSessionInput,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> LiveSessionDTO:
    return await service.create_live_session(db, payload, current_user)


@router.get("/sessions", response_model=list[LiveSessionDTO])
async def live_sessions(
    limit: int = Query(default=20, ge=1, le=50),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[LiveSessionDTO]:
    return await service.list_live_sessions(db, manager.connected_viewer_counts(), limit)


@router.get("/sessions/{live_id}", response_model=LiveSessionDTO)
async def live_session(
    live_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> LiveSessionDTO:
    _ = current_user
    return await service.get_live_session(db, live_id, manager.viewer_count(live_id))


@router.post("/sessions/{live_id}/end", response_model=LiveSessionDTO)
async def end_live_session(
    live_id: str,
    db: AsyncIOMotorDatabase = Depends(get_db),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> LiveSessionDTO:
    ended = await service.end_live_session(db, live_id, current_user)
    await manager.broadcast_to_viewers(live_id, {"type": "live_ended", "live_id": live_id})
    return ended


@router.websocket("/ws/{live_id}")
async def live_signaling_socket(
    websocket: WebSocket,
    live_id: str,
    role: LiveRole = Query(..., pattern="^(host|viewer)$"),
    token: str = Query(..., min_length=1),
) -> None:
    try:
        user = await websocket_user(token)
    except WebSocketDisconnect:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id = str(user["_id"])
    session = await database.live_sessions.find_one({"_id": live_id, "status": "live"})
    if not session:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    if role == "host" and str(session.get("host_id")) != user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(live_id, websocket, role, user_id)

    if role == "viewer":
        await service.mark_viewer_joined(database, live_id, user_id)
        viewer = user_to_dto(user, user_id).model_dump(mode="json")
        await manager.send_to_host(
            live_id,
            {
                "type": "viewer_joined",
                "live_id": live_id,
                "viewer_id": user_id,
                "viewer": viewer,
            },
        )

    try:
        while True:
            message = await websocket.receive_json()
            await relay_signaling_message(live_id, role, user_id, message)
    except WebSocketDisconnect:
        host_disconnected = await manager.disconnect(live_id, role, user_id)
        if host_disconnected:
            await service.mark_live_ended_by_disconnect(database, live_id)


async def websocket_user(token: str) -> auth_service.UserDocument:
    try:
        payload = decode_access_token(token)
        user_id = payload.get("sub") or payload.get("user_id")
    except JWTError:
        user_id = None

    if not user_id:
        raise WebSocketDisconnect(code=status.WS_1008_POLICY_VIOLATION)

    user = auth_service.normalize_user(await database.users.find_one({"_id": str(user_id)}))
    if not user:
        raise WebSocketDisconnect(code=status.WS_1008_POLICY_VIOLATION)
    return user


async def relay_signaling_message(
    live_id: str,
    role: LiveRole,
    user_id: str,
    message: dict[str, Any],
) -> None:
    message_type = str(message.get("type") or "")
    target_id = str(message.get("target_id") or "")
    payload = message.get("payload")

    if role == "host":
        if message_type in {"offer", "ice_candidate"} and target_id:
            await manager.send_to_viewer(
                live_id,
                target_id,
                {
                    "type": message_type,
                    "live_id": live_id,
                    "from_id": user_id,
                    "payload": payload,
                },
            )
        elif message_type == "live_ended":
            await manager.broadcast_to_viewers(live_id, {"type": "live_ended", "live_id": live_id})
            await service.mark_live_ended_by_disconnect(database, live_id)
        return

    if message_type in {"answer", "ice_candidate"}:
        await manager.send_to_host(
            live_id,
            {
                "type": message_type,
                "live_id": live_id,
                "from_id": user_id,
                "payload": payload,
            },
        )
    elif message_type == "live_chat":
        await manager.send_to_host(
            live_id,
            {
                "type": "live_chat",
                "live_id": live_id,
                "from_id": user_id,
                "payload": payload,
            },
        )
