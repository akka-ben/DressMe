from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.session import get_db
from app.modules.auth.service import UserDocument, get_current_user
from app.schemas.contracts import CallSessionDTO, StartCallInput, UserDTO


router = APIRouter()
calls_by_id: dict[str, dict[str, Any]] = {}


def _user_to_dto(user: dict[str, Any]) -> UserDTO:
    user_id = str(user.get("id") or user.get("_id"))
    return UserDTO(
        id=user_id,
        first_name=str(user.get("first_name") or "Utilisateur"),
        last_name=str(user.get("last_name") or ""),
        email=str(user.get("email") or f"{user_id}@example.com"),
        avatar_url=user.get("avatar_url"),
        bio=user.get("bio"),
    )


async def _find_peer(db: AsyncIOMotorDatabase, peer_id: str) -> UserDTO:
    document = await db.users.find_one({"_id": peer_id})
    if document:
        return _user_to_dto(document)
    return UserDTO(
        id=peer_id,
        first_name="Contact",
        last_name="",
        email=f"{peer_id}@example.com",
        avatar_url=None,
        bio=None,
    )


def _session_for(call: dict[str, Any], peer: UserDTO) -> CallSessionDTO:
    return CallSessionDTO(
        id=call["id"],
        kind=call["kind"],
        state=call["state"],
        peer=peer,
    )


@router.post("/start", response_model=CallSessionDTO)
async def start_call(
    payload: StartCallInput,
    current_user: UserDocument = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> CallSessionDTO:
    caller = _user_to_dto(current_user)
    peer = await _find_peer(db, payload.peer_id)
    call = {
        "id": str(uuid4()),
        "kind": payload.kind,
        "state": "ringing",
        "caller": caller,
        "receiver": peer,
    }
    calls_by_id[call["id"]] = call
    return _session_for(call, peer)


@router.get("/incoming", response_model=list[CallSessionDTO])
async def incoming_calls(
    current_user: UserDocument = Depends(get_current_user),
) -> list[CallSessionDTO]:
    current_user_id = str(current_user["id"])
    return [
        _session_for(call, call["caller"])
        for call in calls_by_id.values()
        if call["receiver"].id == current_user_id and call["state"] == "ringing"
    ]


@router.post("/{call_id}/answer", response_model=CallSessionDTO)
async def answer_call(
    call_id: str,
    current_user: UserDocument = Depends(get_current_user),
) -> CallSessionDTO:
    call = calls_by_id[call_id]
    call["state"] = "in_call"
    return _session_for(call, call["caller"])


@router.post("/{call_id}/reject", response_model=CallSessionDTO)
async def reject_call(
    call_id: str,
    current_user: UserDocument = Depends(get_current_user),
) -> CallSessionDTO:
    call = calls_by_id[call_id]
    call["state"] = "ended"
    return _session_for(call, call["caller"])


@router.get("/active", response_model=list[CallSessionDTO])
async def active_calls(
    current_user: UserDocument = Depends(get_current_user),
) -> list[CallSessionDTO]:
    current_user_id = str(current_user["id"])
    sessions: list[CallSessionDTO] = []
    for call in calls_by_id.values():
        if call["state"] == "ended":
            continue
        if call["caller"].id == current_user_id:
            sessions.append(_session_for(call, call["receiver"]))
        elif call["receiver"].id == current_user_id:
            sessions.append(_session_for(call, call["caller"]))
    return sessions
