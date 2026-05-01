from datetime import datetime, timezone
from typing import Any


MongoDocument = dict[str, Any]


def utc_now() -> datetime:
    return datetime.now(timezone.utc)
