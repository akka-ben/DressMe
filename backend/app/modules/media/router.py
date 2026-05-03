from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status

from app.core.config import settings
from app.modules.auth import service as auth_service
from app.schemas.contracts import MediaUploadDTO


router = APIRouter()

ALLOWED_CONTENT_TYPES = {
    "image/jpeg": ("image", ".jpg"),
    "image/png": ("image", ".png"),
    "image/webp": ("image", ".webp"),
    "image/heic": ("image", ".heic"),
    "video/mp4": ("video", ".mp4"),
    "video/quicktime": ("video", ".mov"),
    "video/webm": ("video", ".webm"),
}


@router.post("/upload", response_model=MediaUploadDTO, status_code=status.HTTP_201_CREATED)
async def upload_media(
    request: Request,
    file: UploadFile = File(...),
    current_user: auth_service.UserDocument = Depends(auth_service.get_current_user),
) -> MediaUploadDTO:
    del current_user

    content_type = file.content_type or "application/octet-stream"
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only image and video uploads are supported",
        )

    media_type, default_extension = ALLOWED_CONTENT_TYPES[content_type]
    original_extension = Path(file.filename or "").suffix.lower()
    extension = original_extension if original_extension else default_extension
    stored_filename = f"{uuid4().hex}{extension}"

    upload_root = Path(settings.upload_dir).resolve()
    target_dir = upload_root / media_type
    target_dir.mkdir(parents=True, exist_ok=True)
    target_path = target_dir / stored_filename

    max_bytes = settings.media_upload_max_mb * 1024 * 1024
    written = 0

    try:
        with target_path.open("wb") as destination:
            while chunk := await file.read(1024 * 1024):
                written += len(chunk)
                if written > max_bytes:
                    target_path.unlink(missing_ok=True)
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"Media file is larger than {settings.media_upload_max_mb} MB",
                    )
                destination.write(chunk)
    finally:
        await file.close()

    base_url = str(request.base_url).rstrip("/")
    relative_url = f"/uploads/{media_type}/{stored_filename}"
    return MediaUploadDTO(
        url=f"{base_url}{relative_url}",
        filename=stored_filename,
        content_type=content_type,
        media_type=media_type,
    )
