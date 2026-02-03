from typing import List
from uuid import UUID

from auth.utils import require_tenant_user
from fastapi import APIRouter, Depends, HTTPException
from models import Notification, User
from notifications.schemas import NotificationCountResponse, NotificationResponse
from sqlalchemy.orm import Session

from database import get_db

router = APIRouter()


@router.get("/", response_model=List[NotificationResponse])
async def get_notifications(
    skip: int = 0,
    limit: int = 50,
    unread_only: bool = False,
    current_user: User = Depends(require_tenant_user),
    db: Session = Depends(get_db),
):
    """Get current user's notifications"""
    query = db.query(Notification).filter(Notification.user_id == current_user.id)

    if unread_only:
        query = query.filter(Notification.is_read == False)

    notifications = (
        query.order_by(Notification.created_at.desc()).offset(skip).limit(limit).all()
    )
    return notifications


@router.get("/count", response_model=NotificationCountResponse)
async def get_notification_count(
    current_user: User = Depends(require_tenant_user), db: Session = Depends(get_db)
):
    """Get notification counts"""
    total = (
        db.query(Notification).filter(Notification.user_id == current_user.id).count()
    )

    unread = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id, Notification.is_read == False)
        .count()
    )

    return NotificationCountResponse(total=total, unread=unread)


@router.put("/{notification_id}/read")
async def mark_as_read(
    notification_id: UUID,
    current_user: User = Depends(require_tenant_user),
    db: Session = Depends(get_db),
):
    """Mark a notification as read"""
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id, Notification.user_id == current_user.id
        )
        .first()
    )

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    db.commit()

    return {"message": "Notification marked as read"}


@router.put("/read-all")
async def mark_all_as_read(
    current_user: User = Depends(require_tenant_user), db: Session = Depends(get_db)
):
    """Mark all notifications as read"""
    db.query(Notification).filter(
        Notification.user_id == current_user.id, Notification.is_read == False
    ).update({"is_read": True})

    db.commit()

    return {"message": "All notifications marked as read"}


@router.delete("/{notification_id}")
async def delete_notification(
    notification_id: UUID,
    current_user: User = Depends(require_tenant_user),
    db: Session = Depends(get_db),
):
    """Delete a notification"""
    notification = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id, Notification.user_id == current_user.id
        )
        .first()
    )

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    db.delete(notification)
    db.commit()

    return {"message": "Notification deleted"}
