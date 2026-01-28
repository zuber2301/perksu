from pydantic import BaseModel
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime


class FeedItemResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    event_type: str
    reference_type: Optional[str] = None
    reference_id: Optional[UUID] = None
    actor_id: Optional[UUID] = None
    actor_name: Optional[str] = None
    actor_avatar: Optional[str] = None
    target_id: Optional[UUID] = None
    target_name: Optional[str] = None
    visibility: str
    metadata: Dict[str, Any]
    created_at: datetime

    class Config:
        from_attributes = True
