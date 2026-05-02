from datetime import datetime, timedelta
from uuid import uuid4

from fastapi import APIRouter

from app.schemas.contracts import (
    ConversationDTO,
    MessageDTO,
    SendMessageInput,
    StartConversationInput,
    UserDTO,
)


router = APIRouter()
sent_messages_by_conversation: dict[str, list[MessageDTO]] = {}
created_conversations: dict[str, ConversationDTO] = {}


def _participant(first_name: str, last_name: str, email: str) -> UserDTO:
    user_id = email.split("@")[0]
    return UserDTO(
        id=user_id,
        first_name=first_name,
        last_name=last_name,
        email=email,
        avatar_url=None,
        bio=None,
    )


def _current_user() -> UserDTO:
    return _participant("Mohammed", "Ben Akka Ouayad", "mohammed@example.com")


def _chat_users() -> list[UserDTO]:
    return [
        _participant("Amine", "El Meskini", "amine@example.com"),
        _participant("Amina", "Benjelloun", "amina@example.com"),
        _participant("Karim", "Alaoui", "karim@example.com"),
        _participant("Leila", "Mansouri", "leila@example.com"),
        _participant("Sophia", "Laurent", "sophia@example.com"),
    ]


@router.get("/conversations", response_model=list[ConversationDTO])
async def conversations() -> list[ConversationDTO]:
    amine = _chat_users()[0]
    message = MessageDTO(
        id=str(uuid4()),
        conversation_id="conv-1",
        kind="text",
        body="Send me the final look before you post it.",
        sender=amine,
        created_at=datetime.utcnow() - timedelta(minutes=5),
    )
    return [
        ConversationDTO(
            id="conv-1",
            title="Amine",
            participants=[_current_user(), amine],
            last_message=message,
            unread_count=3,
        ),
        *created_conversations.values(),
    ]


@router.get("/users", response_model=list[UserDTO])
async def chat_users() -> list[UserDTO]:
    return _chat_users()


@router.post("/conversations", response_model=ConversationDTO)
async def start_conversation(payload: StartConversationInput) -> ConversationDTO:
    existing = created_conversations.get(payload.user_id)
    if existing:
        return existing

    peer = next((user for user in _chat_users() if user.id == payload.user_id), None)
    if not peer:
        peer = _participant("Nouveau", "Contact", f"{payload.user_id}@example.com")

    conversation = ConversationDTO(
        id=f"conv-{peer.id}",
        title=peer.first_name,
        participants=[_current_user(), peer],
        last_message=None,
        unread_count=0,
    )
    created_conversations[payload.user_id] = conversation
    return conversation


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageDTO])
async def messages(conversation_id: str) -> list[MessageDTO]:
    amine = _chat_users()[0]
    demo_messages = []
    if conversation_id == "conv-1":
        demo_messages = [
            MessageDTO(
                id="msg-demo-1",
                conversation_id=conversation_id,
                kind="text",
                body="Tenue B looks stronger for the event.",
                sender=amine,
                created_at=datetime.utcnow() - timedelta(minutes=2),
            ),
            MessageDTO(
                id="msg-demo-2",
                conversation_id=conversation_id,
                kind="image",
                body="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=900",
                sender=amine,
                created_at=datetime.utcnow() - timedelta(minutes=1),
            ),
        ]
    return [
        *demo_messages,
        *sent_messages_by_conversation.get(conversation_id, []),
    ]


@router.post("/conversations/{conversation_id}/messages", response_model=MessageDTO)
async def send_message(conversation_id: str, payload: SendMessageInput) -> MessageDTO:
    message = MessageDTO(
        id=str(uuid4()),
        conversation_id=conversation_id,
        kind=payload.kind,
        body=payload.body,
        sender=_current_user(),
        created_at=datetime.utcnow(),
    )
    sent_messages_by_conversation.setdefault(conversation_id, []).append(message)
    return message
