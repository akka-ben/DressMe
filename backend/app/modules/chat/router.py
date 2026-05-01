from datetime import datetime, timedelta
from uuid import uuid4

from fastapi import APIRouter

from app.schemas.contracts import ConversationDTO, MessageDTO, UserDTO


router = APIRouter()


def _participant(first_name: str, last_name: str, email: str) -> UserDTO:
    return UserDTO(
        id=str(uuid4()),
        first_name=first_name,
        last_name=last_name,
        email=email,
        avatar_url=None,
        bio=None,
    )


@router.get("/conversations", response_model=list[ConversationDTO])
async def conversations() -> list[ConversationDTO]:
    mohammed = _participant("Mohammed", "Ben Akka Ouayad", "mohammed@example.com")
    amine = _participant("Amine", "El Meskini", "amine@example.com")
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
          participants=[mohammed, amine],
          last_message=message,
      )
    ]


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageDTO])
async def messages(conversation_id: str) -> list[MessageDTO]:
    amine = _participant("Amine", "El Meskini", "amine@example.com")
    return [
        MessageDTO(
            id=str(uuid4()),
            conversation_id=conversation_id,
            kind="text",
            body="Tenue B looks stronger for the event.",
            sender=amine,
            created_at=datetime.utcnow() - timedelta(minutes=2),
        )
    ]
