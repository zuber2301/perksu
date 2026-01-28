from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timedelta

from database import get_db
from models import AuditLog, User
from auth.utils import get_hr_admin
from audit.schemas import AuditLogResponse

router = APIRouter()


@router.get("/", response_model=List[AuditLogResponse])
async def get_audit_logs(
    skip: int = 0,
    limit: int = 100,
    action: Optional[str] = None,
    entity_type: Optional[str] = None,
    actor_id: Optional[UUID] = None,
    days: int = Query(default=30, le=90),
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    """Get audit logs (HR Admin only)"""
    since = datetime.utcnow() - timedelta(days=days)
    
    query = db.query(AuditLog).filter(
        AuditLog.tenant_id == current_user.tenant_id,
        AuditLog.created_at >= since
    )
    
    if action:
        query = query.filter(AuditLog.action == action)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if actor_id:
        query = query.filter(AuditLog.actor_id == actor_id)
    
    logs = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for log in logs:
        actor = db.query(User).filter(User.id == log.actor_id).first() if log.actor_id else None
        result.append(AuditLogResponse(
            id=log.id,
            tenant_id=log.tenant_id,
            actor_id=log.actor_id,
            actor_name=f"{actor.first_name} {actor.last_name}" if actor else None,
            action=log.action,
            entity_type=log.entity_type,
            entity_id=log.entity_id,
            old_values=log.old_values,
            new_values=log.new_values,
            ip_address=log.ip_address,
            created_at=log.created_at
        ))
    
    return result


@router.get("/actions")
async def get_audit_actions(
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    """Get list of available audit actions"""
    actions = db.query(AuditLog.action).filter(
        AuditLog.tenant_id == current_user.tenant_id
    ).distinct().all()
    return [a[0] for a in actions]


@router.get("/entity-types")
async def get_entity_types(
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    """Get list of entity types in audit logs"""
    types = db.query(AuditLog.entity_type).filter(
        AuditLog.tenant_id == current_user.tenant_id,
        AuditLog.entity_type != None
    ).distinct().all()
    return [t[0] for t in types]
