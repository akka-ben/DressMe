from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.session import get_db
from app.modules.auth.service import UserDocument, get_current_user
from app.schemas.contracts import (
    AnswerCallInput,
    CallSessionDTO,
    IceCandidateInput,
    StartCallInput,
    UserDTO,
)


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
    document = await db.users.find_one({"$or": [{"_id": peer_id}, {"id": peer_id}, {"email": peer_id}]})
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


def _same_user(user: UserDTO, document: UserDocument) -> bool:
    document_id = str(document.get("id") or document.get("_id"))
    document_email = str(document.get("email") or "").lower()
    return user.id == document_id or (bool(document_email) and user.email.lower() == document_email)


def _get_call(call_id: str) -> dict[str, Any]:
    call = calls_by_id.get(call_id)
    if not call:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Call not found")
    return call


def _other_peer(call: dict[str, Any], current_user_id: str) -> UserDTO:
    if call["caller"].id == current_user_id:
        return call["receiver"]
    return call["caller"]


def _session_for(call: dict[str, Any], current_user_id: str) -> CallSessionDTO:
    return CallSessionDTO(
        id=call["id"],
        kind=call["kind"],
        state=call["state"],
        peer=_other_peer(call, current_user_id),
        offer=call.get("offer"),
        answer=call.get("answer"),
        caller_candidates=call.get("caller_candidates", []),
        receiver_candidates=call.get("receiver_candidates", []),
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
        "offer": payload.offer,
        "answer": None,
        "caller_candidates": [],
        "receiver_candidates": [],
    }
    calls_by_id[call["id"]] = call
    return _session_for(call, caller.id)


@router.get("/incoming", response_model=list[CallSessionDTO])
async def incoming_calls(
    current_user: UserDocument = Depends(get_current_user),
) -> list[CallSessionDTO]:
    current_user_id = str(current_user["id"])
    return [
        _session_for(call, current_user_id)
        for call in calls_by_id.values()
        if _same_user(call["receiver"], current_user) and call["state"] == "ringing"
    ]


@router.get("/active", response_model=list[CallSessionDTO])
async def active_calls(
    current_user: UserDocument = Depends(get_current_user),
) -> list[CallSessionDTO]:
    current_user_id = str(current_user["id"])
    return [
        _session_for(call, current_user_id)
        for call in calls_by_id.values()
        if call["state"] != "ended"
        and (_same_user(call["caller"], current_user) or _same_user(call["receiver"], current_user))
    ]


@router.get("/{call_id}", response_model=CallSessionDTO)
async def call_detail(
    call_id: str,
    current_user: UserDocument = Depends(get_current_user),
) -> CallSessionDTO:
    return _session_for(_get_call(call_id), str(current_user["id"]))


@router.post("/{call_id}/answer", response_model=CallSessionDTO)
async def answer_call(
    call_id: str,
    payload: AnswerCallInput,
    current_user: UserDocument = Depends(get_current_user),
) -> CallSessionDTO:
    call = _get_call(call_id)
    call["answer"] = payload.answer
    call["state"] = "in_call"
    return _session_for(call, str(current_user["id"]))


@router.post("/{call_id}/reject", response_model=CallSessionDTO)
async def reject_call(
    call_id: str,
    current_user: UserDocument = Depends(get_current_user),
) -> CallSessionDTO:
    call = _get_call(call_id)
    call["state"] = "ended"
    return _session_for(call, str(current_user["id"]))


@router.post("/{call_id}/candidates", response_model=CallSessionDTO)
async def add_ice_candidate(
    call_id: str,
    payload: IceCandidateInput,
    current_user: UserDocument = Depends(get_current_user),
) -> CallSessionDTO:
    current_user_id = str(current_user["id"])
    call = _get_call(call_id)
    bucket = "caller_candidates" if call["caller"].id == current_user_id else "receiver_candidates"
    call.setdefault(bucket, []).append(payload.candidate)
    return _session_for(call, current_user_id)


@router.post("/{call_id}/end", response_model=CallSessionDTO)
async def end_call(
    call_id: str,
    current_user: UserDocument = Depends(get_current_user),
) -> CallSessionDTO:
    call = _get_call(call_id)
    call["state"] = "ended"
    return _session_for(call, str(current_user["id"]))
