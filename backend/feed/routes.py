from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from database import get_db
from models import Feed, User, Recognition, Badge
from auth.utils import get_current_user
from feed.schemas import FeedItemResponse

router = APIRouter()


@router.get("/", response_model=List[FeedItemResponse])
async def get_feed(
    skip: int = 0,
    limit: int = 20,
    event_type: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the social feed for current tenant"""
    query = db.query(Feed).filter(
        Feed.tenant_id == current_user.tenant_id,
        Feed.visibility == 'public'
    )
    
    if event_type:
        query = query.filter(Feed.event_type == event_type)
    
    feed_items = query.order_by(Feed.created_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for item in feed_items:
        actor = db.query(User).filter(User.id == item.actor_id).first() if item.actor_id else None
        target = db.query(User).filter(User.id == item.target_id).first() if item.target_id else None
        
        # Enrich metadata based on event type
        metadata = dict(item.event_metadata) if item.event_metadata else {}
        
        if item.event_type in ['recognition', 'milestone'] and item.reference_id:
            recognition = db.query(Recognition).filter(Recognition.id == item.reference_id).first()
            if recognition:
                metadata['message'] = recognition.message
                metadata['points'] = str(recognition.points)
                metadata['recognition_type'] = recognition.recognition_type
                if recognition.badge_id:
                    badge = db.query(Badge).filter(Badge.id == recognition.badge_id).first()
                    if badge:
                        metadata['badge_name'] = badge.name
                        metadata['badge_icon'] = badge.icon_url
                if recognition.ecard_template:
                    metadata['ecard_template'] = recognition.ecard_template
        
        if item.event_type == 'team_spotlight' and item.reference_id:
            recognition = db.query(Recognition).filter(Recognition.id == item.reference_id).first()
            if recognition:
                metadata['message'] = recognition.message
                metadata['recognition_type'] = 'group_award'
                if recognition.badge_id:
                    badge = db.query(Badge).filter(Badge.id == recognition.badge_id).first()
                    if badge:
                        metadata['badge_name'] = badge.name
                        metadata['badge_icon'] = badge.icon_url
        
        result.append(FeedItemResponse(
            id=item.id,
            tenant_id=item.tenant_id,
            event_type=item.event_type,
            reference_type=item.reference_type,
            reference_id=item.reference_id,
            actor_id=item.actor_id,
            actor_name=f"{actor.first_name} {actor.last_name}" if actor else None,
            actor_avatar=actor.avatar_url if actor else None,
            target_id=item.target_id,
            target_name=f"{target.first_name} {target.last_name}" if target else None,
            visibility=item.visibility,
            metadata=metadata,
            created_at=item.created_at
        ))
    
    return result


@router.get("/my", response_model=List[FeedItemResponse])
async def get_my_feed(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get feed items related to current user"""
    query = db.query(Feed).filter(
        Feed.tenant_id == current_user.tenant_id,
        (Feed.actor_id == current_user.id) | (Feed.target_id == current_user.id)
    )
    
    feed_items = query.order_by(Feed.created_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for item in feed_items:
        actor = db.query(User).filter(User.id == item.actor_id).first() if item.actor_id else None
        target = db.query(User).filter(User.id == item.target_id).first() if item.target_id else None
        
        metadata = dict(item.event_metadata) if item.event_metadata else {}
        
        if item.event_type in ['recognition', 'milestone'] and item.reference_id:
            recognition = db.query(Recognition).filter(Recognition.id == item.reference_id).first()
            if recognition:
                metadata['message'] = recognition.message
                metadata['points'] = str(recognition.points)
                metadata['recognition_type'] = recognition.recognition_type
                if recognition.badge_id:
                    badge = db.query(Badge).filter(Badge.id == recognition.badge_id).first()
                    if badge:
                        metadata['badge_name'] = badge.name
                        metadata['badge_icon'] = badge.icon_url
                if recognition.ecard_template:
                    metadata['ecard_template'] = recognition.ecard_template

        if item.event_type == 'team_spotlight' and item.reference_id:
            recognition = db.query(Recognition).filter(Recognition.id == item.reference_id).first()
            if recognition:
                metadata['message'] = recognition.message
                metadata['recognition_type'] = 'group_award'
                if recognition.badge_id:
                    badge = db.query(Badge).filter(Badge.id == recognition.badge_id).first()
                    if badge:
                        metadata['badge_name'] = badge.name
                        metadata['badge_icon'] = badge.icon_url
        
        result.append(FeedItemResponse(
            id=item.id,
            tenant_id=item.tenant_id,
            event_type=item.event_type,
            reference_type=item.reference_type,
            reference_id=item.reference_id,
            actor_id=item.actor_id,
            actor_name=f"{actor.first_name} {actor.last_name}" if actor else None,
            actor_avatar=actor.avatar_url if actor else None,
            target_id=item.target_id,
            target_name=f"{target.first_name} {target.last_name}" if target else None,
            visibility=item.visibility,
            metadata=metadata,
            created_at=item.created_at
        ))
    
    return result


@router.get("/department", response_model=List[FeedItemResponse])
async def get_department_feed(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get feed items for current user's department"""
    if not current_user.department_id:
        return []
    
    # Get users in the same department
    department_users = db.query(User.id).filter(
        User.tenant_id == current_user.tenant_id,
        User.department_id == current_user.department_id
    ).all()
    department_user_ids = [u[0] for u in department_users]
    
    query = db.query(Feed).filter(
        Feed.tenant_id == current_user.tenant_id,
        Feed.visibility.in_(['public', 'department']),
        (Feed.actor_id.in_(department_user_ids)) | (Feed.target_id.in_(department_user_ids))
    )
    
    feed_items = query.order_by(Feed.created_at.desc()).offset(skip).limit(limit).all()
    
    result = []
    for item in feed_items:
        actor = db.query(User).filter(User.id == item.actor_id).first() if item.actor_id else None
        target = db.query(User).filter(User.id == item.target_id).first() if item.target_id else None
        
        metadata = dict(item.event_metadata) if item.event_metadata else {}
        
        result.append(FeedItemResponse(
            id=item.id,
            tenant_id=item.tenant_id,
            event_type=item.event_type,
            reference_type=item.reference_type,
            reference_id=item.reference_id,
            actor_id=item.actor_id,
            actor_name=f"{actor.first_name} {actor.last_name}" if actor else None,
            actor_avatar=actor.avatar_url if actor else None,
            target_id=item.target_id,
            target_name=f"{target.first_name} {target.last_name}" if target else None,
            visibility=item.visibility,
            metadata=metadata,
            created_at=item.created_at
        ))
    
    return result
