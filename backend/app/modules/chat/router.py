from datetime import datetime, timedelta
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.db.session import get_db
from app.modules.auth.service import UserDocument, get_current_user
from app.schemas.contracts import (
    ConversationDTO,
    MessageDTO,
    SendMessageInput,
    StartConversationInput,
    UserDTO,
)


router = APIRouter()
messages_by_conversation: dict[str, list[MessageDTO]] = {}
conversations_by_id: dict[str, ConversationDTO] = {}
unread_by_conversation: dict[str, dict[str, int]] = {}


def _user_name_part(value: Any, fallback: str) -> str:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return fallback


def _user_to_dto(user: dict[str, Any]) -> UserDTO:
    email = _user_name_part(user.get("email"), f"{user.get('id') or user.get('_id')}@example.com")
    return UserDTO(
        id=str(user.get("id") or user.get("_id")),
        first_name=_user_name_part(user.get("first_name"), "Utilisateur"),
        last_name=_user_name_part(user.get("last_name"), ""),
        email=email,
        avatar_url=user.get("avatar_url"),
        bio=user.get("bio"),
    )


def _fallback_user(first_name: str, last_name: str, email: str) -> UserDTO:
    return UserDTO(
        id=email.split("@")[0],
        first_name=first_name,
        last_name=last_name,
        email=email,
        avatar_url=None,
        bio=None,
    )


def _fallback_users() -> list[UserDTO]:
    return [
        _fallback_user("Amine", "El Meskini", "amine@example.com"),
        _fallback_user("Amina", "Benjelloun", "amina@example.com"),
        _fallback_user("Karim", "Alaoui", "karim@example.com"),
        _fallback_user("Leila", "Mansouri", "leila@example.com"),
        _fallback_user("Sophia", "Laurent", "sophia@example.com"),
    ]


def _conversation_id(first_user_id: str, second_user_id: str) -> str:
    left, right = sorted([first_user_id, second_user_id])
    return f"conv-{left}-{right}"


def _peer_for(conversation: ConversationDTO, current_user_id: str) -> UserDTO:
    return next(
        (participant for participant in conversation.participants if participant.id != current_user_id),
        conversation.participants[0],
    )


def _conversation_for_user(conversation: ConversationDTO, current_user_id: str) -> ConversationDTO:
    peer = _peer_for(conversation, current_user_id)
    messages = messages_by_conversation.get(conversation.id, [])
    last_message = messages[-1] if messages else conversation.last_message
    return conversation.model_copy(
        update={
            "title": peer.first_name,
            "last_message": last_message,
            "unread_count": unread_by_conversation.get(conversation.id, {}).get(current_user_id, 0),
        },
    )


def _conversation_preview(current_user: UserDTO, peer: UserDTO) -> ConversationDTO:
    conversation_id = _conversation_id(current_user.id, peer.id)
    if conversation_id not in conversations_by_id:
        conversations_by_id[conversation_id] = ConversationDTO(
            id=conversation_id,
            title=peer.first_name,
            participants=[current_user, peer],
            last_message=None,
            unread_count=0,
        )

    messages = messages_by_conversation.get(conversation_id, [])
    return conversations_by_id[conversation_id].model_copy(
        update={
            "title": peer.first_name,
            "last_message": messages[-1] if messages else None,
            "unread_count": unread_by_conversation.get(conversation_id, {}).get(current_user.id, 0),
        },
    )


async def _available_users(
    db: AsyncIOMotorDatabase,
    current_user: UserDocument,
) -> list[UserDTO]:
    current_user_id = str(current_user["id"])
    users = [
        _user_to_dto(document)
        for document in await db.users.find({"_id": {"$ne": current_user_id}}).to_list(50)
    ]
    if users:
        return users

    current_email = str(current_user.get("email") or "")
    return [user for user in _fallback_users() if user.email != current_email]


async def _find_user(
    db: AsyncIOMotorDatabase,
    user_id: str,
    current_user: UserDocument,
) -> UserDTO:
    document = await db.users.find_one({"_id": user_id})
    if document:
        return _user_to_dto(document)

    return next(
        (user for user in await _available_users(db, current_user) if user.id == user_id),
        _fallback_user("Nouveau", "Contact", f"{user_id}@example.com"),
    )


@router.get("/conversations", response_model=list[ConversationDTO])
async def conversations(
    current_user: UserDocument = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[ConversationDTO]:
    current_user_id = str(current_user["id"])
    visible = [
        _conversation_for_user(conversation, current_user_id)
        for conversation in conversations_by_id.values()
        if any(participant.id == current_user_id for participant in conversation.participants)
    ]

    if visible:
        return visible

    current_user_dto = _user_to_dto(current_user)
    registered_users = [
        _user_to_dto(document)
        for document in await db.users.find({"_id": {"$ne": current_user_id}}).to_list(50)
    ]
    if registered_users:
        return [_conversation_preview(current_user_dto, peer) for peer in registered_users]

    amine = _fallback_users()[0]
    demo_message = MessageDTO(
        id=str(uuid4()),
        conversation_id="conv-demo",
        kind="text",
        body="Send me the final look before you post it.",
        sender=amine,
        created_at=datetime.utcnow() - timedelta(minutes=5),
    )
    return [
        ConversationDTO(
            id="conv-demo",
            title=amine.first_name,
            participants=[_user_to_dto(current_user), amine],
            last_message=demo_message,
            unread_count=0,
        )
    ]


@router.get("/users", response_model=list[UserDTO])
async def chat_users(
    current_user: UserDocument = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> list[UserDTO]:
    return await _available_users(db, current_user)


@router.post("/conversations", response_model=ConversationDTO)
async def start_conversation(
    payload: StartConversationInput,
    current_user: UserDocument = Depends(get_current_user),
    db: AsyncIOMotorDatabase = Depends(get_db),
) -> ConversationDTO:
    current_user_dto = _user_to_dto(current_user)
    peer = await _find_user(db, payload.user_id, current_user)
    conversation_id = _conversation_id(current_user_dto.id, peer.id)

    if conversation_id not in conversations_by_id:
        conversations_by_id[conversation_id] = ConversationDTO(
            id=conversation_id,
            title=peer.first_name,
            participants=[current_user_dto, peer],
            last_message=None,
            unread_count=0,
        )

    return _conversation_for_user(conversations_by_id[conversation_id], current_user_dto.id)


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageDTO])
async def messages(
    conversation_id: str,
    current_user: UserDocument = Depends(get_current_user),
) -> list[MessageDTO]:
    unread_by_conversation.setdefault(conversation_id, {})[str(current_user["id"])] = 0
    if conversation_id == "conv-demo":
        amine = _fallback_users()[0]
        return [
            MessageDTO(
                id="msg-demo-1",
                conversation_id=conversation_id,
                kind="text",
                body="Tenue B looks stronger for the event.",
                sender=amine,
                created_at=datetime.utcnow() - timedelta(minutes=2),
            ),
            *messages_by_conversation.get(conversation_id, []),
        ]
    return messages_by_conversation.get(conversation_id, [])


@router.post("/conversations/{conversation_id}/messages", response_model=MessageDTO)
async def send_message(
    conversation_id: str,
    payload: SendMessageInput,
    current_user: UserDocument = Depends(get_current_user),
) -> MessageDTO:
    current_user_id = str(current_user["id"])
    message = MessageDTO(
        id=str(uuid4()),
        conversation_id=conversation_id,
        kind=payload.kind,
        body=payload.body,
        sender=_user_to_dto(current_user),
        created_at=datetime.utcnow(),
    )
    messages_by_conversation.setdefault(conversation_id, []).append(message)

    conversation = conversations_by_id.get(conversation_id)
    if conversation:
        unread = unread_by_conversation.setdefault(conversation_id, {})
        for participant in conversation.participants:
            if participant.id != current_user_id:
                unread[participant.id] = unread.get(participant.id, 0) + 1
            else:
                unread[participant.id] = 0

    return message


@router.delete("/conversations/{conversation_id}/messages/{message_id}", response_model=dict[str, bool])
async def delete_message(
    conversation_id: str,
    message_id: str,
    current_user: UserDocument = Depends(get_current_user),
) -> dict[str, bool]:
    messages = messages_by_conversation.get(conversation_id, [])
    current_user_id = str(current_user["id"])
    message = next((item for item in messages if item.id == message_id), None)

    if not message:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")

    if message.sender.id != current_user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can delete only your messages")

    messages_by_conversation[conversation_id] = [item for item in messages if item.id != message_id]
    return {"deleted": True}
