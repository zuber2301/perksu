from datetime import datetime
from typing import Any, Dict, Optional
from uuid import UUID

from pydantic import BaseModel


class AuditLogResponse(BaseModel):
    id: UUID
    tenant_id: Optional[UUID] = None
    actor_id: Optional[UUID] = None
    actor_name: Optional[str] = None
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[UUID] = None
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    ip_address: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
