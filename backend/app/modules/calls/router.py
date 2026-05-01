from uuid import uuid4

from fastapi import APIRouter

from app.schemas.contracts import CallSessionDTO, UserDTO


router = APIRouter()


@router.get("/active", response_model=list[CallSessionDTO])
async def active_calls() -> list[CallSessionDTO]:
    peer = UserDTO(
        id=str(uuid4()),
        first_name="Mohamed",
        last_name="Benfares",
        email="mohamed@example.com",
        avatar_url=None,
        bio="Ready for call tests.",
    )
    return [
        CallSessionDTO(
            id="call-1",
            kind="audio",
            state="ringing",
            peer=peer,
        )
    ]
