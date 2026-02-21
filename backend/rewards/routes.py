"""
Unified Rewards Catalog + Redemption Engine (Multi-Tier)
=========================================================
Prefix: /api/rewards

Models:
- RewardCatalogMaster: Global items (Gifts cards from providers)
- RewardCatalogTenant: Per-tenant settings/visibility for Master items
- RewardCatalogCustom: Tenant-specific items (Swag, Internal perks)
"""

from __future__ import annotations

import math
from datetime import datetime
from typing import List, Optional
from uuid import UUID

from auth.utils import get_current_user, verify_admin, verify_platform_admin, verify_tenant_admin
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from models import (
    Redemption,
    RedemptionLedger,
    RewardCatalogMaster,
    RewardCatalogTenant,
    RewardCatalogCustom,
    Tenant,
    User,
    Wallet,
    WalletLedger,
)
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from database import get_db
from rewards.fulfillment import get_gift_card_provider
from rewards.schemas import (
    CatalogItemResponse,
    CatalogListResponse,
    RedeemRequest,
    RedeemResponse,
    RewardOrderItem,
    RewardOrderListResponse,
    WalletSummary,
)

router = APIRouter()


# ────────────────────────────────────────────────────────────────────
# Helpers
# ────────────────────────────────────────────────────────────────────


def _build_denominations(min_pts, max_pts, step_pts) -> List[int]:
    """Return the list of valid point denominations for a catalog item."""
    if not min_pts or not max_pts or not step_pts:
        return []
    
    # Stay defensive
    if step_pts <= 0:
        return [min_pts] if min_pts == max_pts else [min_pts, max_pts]
        
    denoms = list(range(min_pts, max_pts + 1, step_pts))
    if denoms and denoms[-1] != max_pts:
        denoms.append(max_pts)
    return denoms


def _master_to_catalog_resp(master: RewardCatalogMaster, tenant_conf: Optional[RewardCatalogTenant]) -> CatalogItemResponse:
    # Use overrides if present
    min_pts  = (tenant_conf.custom_min_points if tenant_conf and tenant_conf.custom_min_points else master.min_points) or 0
    max_pts  = (tenant_conf.custom_max_points if tenant_conf and tenant_conf.custom_max_points else master.max_points) or 0
    step_pts = (tenant_conf.custom_step_points if tenant_conf and tenant_conf.custom_step_points else master.step_points) or 0
    
    return CatalogItemResponse(
        id=master.id,
        source_type="MASTER",
        name=master.name,
        brand=master.brand,
        category=master.category,
        description=master.description,
        image_url=master.image_url,
        fulfillment_type=master.fulfillment_type,
        min_points=min_pts,
        max_points=max_pts,
        step_points=step_pts,
        points_per_rupee=master.points_per_rupee,
        denominations=_build_denominations(min_pts, max_pts, step_pts),
        is_active=master.is_active_global,
        tenant_id=tenant_conf.tenant_id if tenant_conf else None
    )


def _custom_to_catalog_resp(custom: RewardCatalogCustom) -> CatalogItemResponse:
    return CatalogItemResponse(
        id=custom.id,
        source_type="CUSTOM",
        name=custom.name,
        brand=custom.brand,
        category=custom.category,
        description=custom.description,
        image_url=custom.image_url,
        fulfillment_type=custom.fulfillment_type,
        points_cost=custom.points_cost,
        inventory_count=custom.inventory_count,
        is_active=custom.is_active,
        tenant_id=custom.tenant_id
    )


def _fulfill_in_background(redemption_id: str):
    """Run gift-card fulfilment outside the HTTP request lifecycle."""
    try:
        from celery_app import celery  # assuming celery_app.py exists
        # In a real environment we'd use .delay()
        # For this prototype we fallback to sync if task not linked or worker down
        _fulfill_sync(redemption_id)
    except Exception:
        _fulfill_sync(redemption_id)


def _fulfill_sync(redemption_id: str):
    """Synchronous fallback fulfilment."""
    from database import SessionLocal

    db = SessionLocal()
    try:
        redemption = db.query(Redemption).filter(Redemption.id == redemption_id).first()
        if not redemption:
            return

        # Determine provider_code and fulfillment_type
        provider_code = redemption.item_name
        fulfillment_type = "MANUAL"
        pts_per_rupee = 1
        
        # Check Master Catalog
        master = db.query(RewardCatalogMaster).filter(RewardCatalogMaster.id == redemption.item_id).first()
        if master:
            provider_code = master.provider_code or master.name
            fulfillment_type = master.fulfillment_type
            pts_per_rupee = master.points_per_rupee or 1
        else:
            # Check Custom Catalog
            custom = db.query(RewardCatalogCustom).filter(RewardCatalogCustom.id == redemption.item_id).first()
            if custom:
                provider_code = custom.brand or custom.name
                fulfillment_type = custom.fulfillment_type

        # Skip API if not GIFT_CARD_API
        if fulfillment_type != "GIFT_CARD_API":
            redemption.status = "COMPLETED" if fulfillment_type == "INVENTORY_ITEM" else "PROCESSING"
            db.commit()
            return

        recipient_email = (redemption.delivery_details or {}).get("email")

        # Calculate actual currency amount if needed by provider
        # Most providers expect actual currency value. 
        # If user spent 1000 pts and pts_per_rupee is 2, the amount is 500 Rupees.
        currency_amount = int(redemption.point_cost / pts_per_rupee)

        # Mock Provider API call
        provider = get_gift_card_provider()
        resp = provider.issue(
            provider_code=provider_code,
            amount_points=currency_amount,
            recipient_email=recipient_email,
            metadata={"redemption_id": str(redemption.id)},
        )

        old_status = redemption.status
        if resp["status"] == "success":
            redemption.voucher_code = resp.get("voucher_code")
            d = redemption.delivery_details or {}
            d.update({"redeem_url": resp.get("redeem_url")})
            redemption.delivery_details = d
            redemption.status = "COMPLETED"
            redemption.processed_at = datetime.utcnow()
        else:
            redemption.status = "FAILED"
            redemption.failed_reason = resp.get("error", "API issue")
            # Refund
            wallet = db.query(Wallet).filter(Wallet.user_id == redemption.user_id).first()
            if wallet:
                wallet.balance += redemption.point_cost
                db.add(WalletLedger(
                    tenant_id=redemption.tenant_id,
                    wallet_id=wallet.id,
                    transaction_type="credit",
                    source="reversal",
                    points=redemption.point_cost,
                    balance_after=wallet.balance,
                    reference_type="Redemption",
                    reference_id=redemption.id,
                    description=f"Refund: {redemption.item_name}",
                ))

        db.add(RedemptionLedger(
            redemption_id=redemption.id,
            tenant_id=redemption.tenant_id,
            user_id=redemption.user_id,
            action=redemption.status,
            status_before=old_status,
            status_after=redemption.status,
        ))
        db.commit()
    except Exception as exc:
        db.rollback()
        print(f"Fulfilment error: {exc}")
    finally:
        db.close()


# ────────────────────────────────────────────────────────────────────
# Public Endpoints
# ────────────────────────────────────────────────────────────────────


@router.get("/categories", response_model=List[str])
async def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return distinct categories visible to this tenant."""
    master_cats = (
        db.query(RewardCatalogMaster.category)
        .outerjoin(RewardCatalogTenant, and_(
            RewardCatalogTenant.master_item_id == RewardCatalogMaster.id,
            RewardCatalogTenant.tenant_id == current_user.tenant_id
        ))
        .filter(RewardCatalogMaster.is_active_global == True,
                or_(RewardCatalogTenant.id == None, RewardCatalogTenant.is_enabled == True))
        .distinct().all()
    )
    custom_cats = (
        db.query(RewardCatalogCustom.category)
        .filter(RewardCatalogCustom.tenant_id == current_user.tenant_id, RewardCatalogCustom.is_active == True)
        .distinct().all()
    )
    all_cats = set([r[0] for r in master_cats] + [r[0] for r in custom_cats])
    return sorted(list(all_cats))


@router.get("/catalog", response_model=CatalogListResponse)
async def list_catalog(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    """List catalog items (Master + Custom)."""
    # 1. Master Items
    m_q = db.query(RewardCatalogMaster, RewardCatalogTenant).outerjoin(
        RewardCatalogTenant, and_(
            RewardCatalogTenant.master_item_id == RewardCatalogMaster.id,
            RewardCatalogTenant.tenant_id == current_user.tenant_id
        )
    ).filter(RewardCatalogMaster.is_active_global == True,
            or_(RewardCatalogTenant.id == None, RewardCatalogTenant.is_enabled == True))
    
    # 2. Custom Items
    c_q = db.query(RewardCatalogCustom).filter(
        RewardCatalogCustom.tenant_id == current_user.tenant_id,
        RewardCatalogCustom.is_active == True
    )

    if category:
        m_q = m_q.filter(RewardCatalogMaster.category == category)
        c_q = c_q.filter(RewardCatalogCustom.category == category)
    if search:
        l = f"%{search}%"
        m_q = m_q.filter(or_(RewardCatalogMaster.name.ilike(l), RewardCatalogMaster.brand.ilike(l)))
        c_q = c_q.filter(or_(RewardCatalogCustom.name.ilike(l), RewardCatalogCustom.brand.ilike(l)))

    # Combine & Sort
    items = []
    for m, t in m_q.all():
        items.append(_master_to_catalog_resp(m, t))
    for c in c_q.all():
        items.append(_custom_to_catalog_resp(c))
    
    items.sort(key=lambda x: (x.category, x.name))
    total = len(items)
    
    # Paging
    start = (page - 1) * page_size
    paged = items[start : start + page_size]

    return CatalogListResponse(
        items=paged,
        total=total,
        categories=await list_categories(db, current_user),
    )


@router.get("/catalog/{item_id}", response_model=CatalogItemResponse)
async def get_catalog_item(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Single item lookup."""
    m = db.query(RewardCatalogMaster, RewardCatalogTenant).outerjoin(
        RewardCatalogTenant, and_(
            RewardCatalogTenant.master_item_id == RewardCatalogMaster.id,
            RewardCatalogTenant.tenant_id == current_user.tenant_id
        )
    ).filter(RewardCatalogMaster.id == item_id).first()
    
    if m: return _master_to_catalog_resp(m[0], m[1])

    c = db.query(RewardCatalogCustom).filter(
        RewardCatalogCustom.id == item_id,
        RewardCatalogCustom.tenant_id == current_user.tenant_id
    ).first()
    
    if c: return _custom_to_catalog_resp(c)

    raise HTTPException(status_code=404, detail="Item not found")


@router.get("/wallet", response_model=WalletSummary)
async def get_wallet_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    wallet = db.query(Wallet).filter(Wallet.user_id == current_user.id).first()
    if not wallet: return WalletSummary(balance=0, lifetime_earned=0, lifetime_spent=0)
    return WalletSummary(
        balance=int(wallet.balance),
        lifetime_earned=int(wallet.lifetime_earned),
        lifetime_spent=int(wallet.lifetime_spent)
    )


@router.post("/redeem", response_model=RedeemResponse)
async def redeem_item(
    req: RedeemRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atomic redemption flow."""
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant or tenant.redemptions_paused:
        raise HTTPException(status_code=400, detail="Redemptions unavailable")

    # Resolve Item
    master_res = db.query(RewardCatalogMaster, RewardCatalogTenant).outerjoin(
        RewardCatalogTenant, and_(
            RewardCatalogTenant.master_item_id == RewardCatalogMaster.id,
            RewardCatalogTenant.tenant_id == current_user.tenant_id
        )
    ).filter(RewardCatalogMaster.id == req.catalog_item_id).first()

    item_id, item_name, f_type, pts_needed = None, "", "", req.points

    if master_res:
        m, t = master_res
        item_id, item_name, f_type = m.id, m.name, m.fulfillment_type
        # Validation
        min_p = (t.custom_min_points if t and t.custom_min_points else m.min_points) or 0
        max_p = (t.custom_max_points if t and t.custom_max_points else m.max_points) or 0
        step_p = (t.custom_step_points if t and t.custom_step_points else m.step_points) or 1
        denoms = _build_denominations(min_p, max_p, step_p)
        if req.points not in denoms:
            raise HTTPException(status_code=400, detail="Invalid denomination")
    else:
        c = db.query(RewardCatalogCustom).filter(
            RewardCatalogCustom.id == req.catalog_item_id,
            RewardCatalogCustom.tenant_id == current_user.tenant_id
        ).first()
        if not c: raise HTTPException(status_code=404, detail="Item not found")
        item_id, item_name, f_type, pts_needed = c.id, c.name, c.fulfillment_type, c.points_cost
        if req.points != pts_needed:
            raise HTTPException(status_code=400, detail=f"Cost is {pts_needed} pts")
        if f_type == "INVENTORY_ITEM" and (c.inventory_count is not None and c.inventory_count <= 0):
            raise HTTPException(status_code=400, detail="Out of stock")

    # Wallet
    wallet = db.query(Wallet).filter(Wallet.user_id == current_user.id).first()
    if not wallet or wallet.balance < pts_needed:
        raise HTTPException(status_code=400, detail="Insufficient balance")

    # Transact
    wallet.balance -= pts_needed
    wallet.lifetime_spent += pts_needed
    db.add(WalletLedger(
        tenant_id=current_user.tenant_id,
        wallet_id=wallet.id,
        transaction_type="debit",
        source="redemption",
        points=pts_needed,
        balance_after=wallet.balance,
        reference_id=item_id,
        description=f"Redeemed {item_name}",
    ))

    delivery = {"email": current_user.personal_email}
    if req.delivery_address: delivery["address"] = req.delivery_address

    redemption = Redemption(
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        item_type="VOUCHER" if f_type == "GIFT_CARD_API" else "MERCH",
        item_id=item_id,
        item_name=item_name,
        point_cost=pts_needed,
        actual_cost=pts_needed,
        status="PENDING" if f_type == "GIFT_CARD_API" else "PROCESSING",
        delivery_details=delivery,
    )
    db.add(redemption)
    
    if not master_res: # Custom item inventory
        c = db.query(RewardCatalogCustom).filter(RewardCatalogCustom.id == item_id).first()
        if c and c.fulfillment_type == "INVENTORY_ITEM" and c.inventory_count is not None:
            c.inventory_count -= 1

    db.commit()
    background_tasks.add_task(_fulfill_in_background, str(redemption.id))

    return RedeemResponse(
        status=redemption.status,
        redemption_id=redemption.id,
        message="Order placed",
        item_name=item_name,
        points_spent=pts_needed,
        wallet_balance_after=int(wallet.balance),
    )


@router.get("/redemptions", response_model=RewardOrderListResponse)
async def list_my_redemptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
):
    q = db.query(Redemption).filter(Redemption.user_id == current_user.id)
    total = q.count()
    orders = q.order_by(Redemption.created_at.desc()).offset((page-1)*page_size).limit(page_size).all()

    # Meta enrichment
    item_ids = [o.item_id for o in orders if o.item_id]
    meta_map = {}
    if item_ids:
        ms = db.query(RewardCatalogMaster).filter(RewardCatalogMaster.id.in_(item_ids)).all()
        cs = db.query(RewardCatalogCustom).filter(RewardCatalogCustom.id.in_(item_ids)).all()
        for r in ms: meta_map[r.id] = (r.category, r.image_url)
        for r in cs: meta_map[r.id] = (r.category, r.image_url)

    items = []
    for o in orders:
        cat, img = meta_map.get(o.item_id, (None, None))
        items.append(RewardOrderItem(
            id=o.id, item_name=o.item_name, item_type=o.item_type,
            category=cat, image_url=img, points_spent=o.point_cost,
            status=o.status, voucher_code=o.voucher_code,
            redeem_url=(o.delivery_details or {}).get("redeem_url"),
            tracking_number=o.tracking_number, created_at=o.created_at, updated_at=o.updated_at
        ))

    return RewardOrderListResponse(
        items=items, total=total, page=page, page_size=page_size,
        total_pages=math.ceil(total/page_size) if total else 1
    )


@router.get("/redemptions/{order_id}", response_model=RewardOrderItem)
async def get_my_redemption(
    order_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    o = db.query(Redemption).filter(Redemption.id == order_id, Redemption.user_id == current_user.id).first()
    if not o: raise HTTPException(status_code=404, detail="Order not found")
    
    # Meta
    cat, img = None, None
    m = db.query(RewardCatalogMaster).filter(RewardCatalogMaster.id == o.item_id).first()
    if m: cat, img = m.category, m.image_url
    else:
        c = db.query(RewardCatalogCustom).filter(RewardCatalogCustom.id == o.item_id).first()
        if c: cat, img = c.category, c.image_url

    return RewardOrderItem(
        id=o.id, item_name=o.item_name, item_type=o.item_type,
        category=cat, image_url=img, points_spent=o.point_cost,
        status=o.status, voucher_code=o.voucher_code,
        redeem_url=(o.delivery_details or {}).get("redeem_url"),
        tracking_number=o.tracking_number, created_at=o.created_at, updated_at=o.updated_at
    )

# ────────────────────────────────────────────────────────────────────
# Management Endpoints (Admin)
# ────────────────────────────────────────────────────────────────────


@router.post("/admin/master", response_model=CatalogItemResponse, status_code=201)
async def create_master_item(
    data: MasterCatalogItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Platform Admin: Add item to the global master catalog."""
    verify_platform_admin(current_user)
    item = RewardCatalogMaster(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return _master_to_catalog_resp(item, None)


@router.post("/admin/custom", response_model=CatalogItemResponse, status_code=201)
async def create_custom_item(
    data: CustomCatalogItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tenant Manager: Add a tenant-specific item (swag, etc)."""
    verify_tenant_admin(current_user)
    item = RewardCatalogCustom(
        tenant_id=current_user.tenant_id,
        **data.model_dump()
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _custom_to_catalog_resp(item)


@router.put("/admin/master/{item_id}/config", response_model=CatalogItemResponse)
async def configure_master_item(
    item_id: UUID,
    data: TenantCatalogSettingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Tenant Manager: Enable/Disable or override points for a Master item."""
    verify_tenant_admin(current_user)
    
    # Check if setting already exists
    setting = db.query(RewardCatalogTenant).filter(
        RewardCatalogTenant.master_item_id == item_id,
        RewardCatalogTenant.tenant_id == current_user.tenant_id
    ).first()
    
    if not setting:
        setting = RewardCatalogTenant(
            master_item_id=item_id,
            tenant_id=current_user.tenant_id
        )
        db.add(setting)
    
    setting.is_enabled = data.is_enabled
    setting.custom_min_points = data.custom_min_points
    setting.custom_max_points = data.custom_max_points
    setting.custom_step_points = data.custom_step_points
    
    db.commit()
    
    # Return enriched item
    master = db.query(RewardCatalogMaster).filter(RewardCatalogMaster.id == item_id).first()
    return _master_to_catalog_resp(master, setting)
