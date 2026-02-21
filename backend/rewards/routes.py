"""
Unified Rewards Catalog + Redemption Engine
============================================
Prefix: /api/rewards

Endpoints
---------
GET  /catalog                  – paginated, filterable catalog
GET  /catalog/{item_id}        – single item + pre-computed denominations
POST /redeem                   – atomic wallet debit + order creation + async fulfilment
GET  /redemptions              – authenticated user's order history
GET  /redemptions/{id}         – single order (reveals voucher code when FULFILLED)
GET  /wallet                   – current user's wallet summary
GET  /categories               – distinct category list for the frontend filter bar

Admin only:
POST   /catalog                – create catalog item
PUT    /catalog/{item_id}      – update catalog item
DELETE /catalog/{item_id}      – soft-delete (is_active=False)
"""

from __future__ import annotations

import math
from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from auth.utils import get_current_user, verify_admin
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from models import (
    Redemption,
    RedemptionLedger,
    RewardCatalogItem,
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
    CatalogItemCreate,
    CatalogItemResponse,
    CatalogItemUpdate,
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


def _build_denominations(item: RewardCatalogItem) -> List[int]:
    """Return the list of valid point denominations for a catalog item."""
    denoms = list(
        range(
            item.min_denomination_points,
            item.max_denomination_points + 1,
            item.step_points,
        )
    )
    # Always include max if it isn't already a step multiple
    if denoms and denoms[-1] != item.max_denomination_points:
        denoms.append(item.max_denomination_points)
    return denoms


def _to_catalog_response(item: RewardCatalogItem) -> CatalogItemResponse:
    return CatalogItemResponse(
        id=item.id,
        name=item.name,
        brand=item.brand,
        category=item.category,
        description=item.description,
        image_url=item.image_url,
        fulfillment_type=item.fulfillment_type,
        min_denomination_points=item.min_denomination_points,
        max_denomination_points=item.max_denomination_points,
        step_points=item.step_points,
        denominations=_build_denominations(item),
        inventory_count=item.inventory_count,
        is_active=item.is_active,
        tenant_id=item.tenant_id,
    )


def _fulfill_in_background(redemption_id: str):
    """Run gift-card fulfilment outside the HTTP request lifecycle.

    Imports are local to avoid circular deps in the Celery context.
    Falls back to the synchronous path when Celery is unavailable.
    """
    try:
        from redemption.tasks import issue_voucher_task  # existing Celery task
        issue_voucher_task.delay(redemption_id)
    except Exception:
        # Celery unavailable – run synchronously (dev/test)
        _fulfill_sync(redemption_id)


def _fulfill_sync(redemption_id: str):
    """Synchronous fallback fulfilment (used when Celery is not running)."""
    from database import SessionLocal

    db = SessionLocal()
    try:
        redemption = db.query(Redemption).filter(Redemption.id == redemption_id).first()
        if not redemption:
            return

        # Try to look up the catalog item for provider_code
        item = (
            db.query(RewardCatalogItem)
            .filter(RewardCatalogItem.id == redemption.item_id)
            .first()
        )
        provider_code = (item.provider_code or redemption.item_name) if item else redemption.item_name
        recipient_email = (redemption.delivery_details or {}).get("email")

        provider = get_gift_card_provider()
        resp = provider.issue(
            provider_code=provider_code,
            amount_points=int(redemption.point_cost),
            recipient_email=recipient_email,
            metadata={
                "redemption_id": str(redemption.id),
                "user_id": str(redemption.user_id),
            },
        )

        old_status = redemption.status
        if resp["status"] == "success":
            redemption.voucher_code = resp.get("voucher_code")
            d = redemption.delivery_details or {}
            d.update({
                "redeem_url": resp.get("redeem_url"),
                "vendor_reference": resp.get("vendor_reference"),
            })
            redemption.delivery_details = d
            redemption.status = "COMPLETED"
            redemption.processed_at = datetime.utcnow()
        else:
            redemption.status = "FAILED"
            redemption.failed_reason = resp.get("error", "Unknown error")
            # Refund
            wallet = db.query(Wallet).filter(Wallet.user_id == redemption.user_id).first()
            if wallet:
                wallet.balance += redemption.point_cost
                wallet.lifetime_spent -= redemption.point_cost
                refund = WalletLedger(
                    tenant_id=redemption.tenant_id,
                    wallet_id=wallet.id,
                    transaction_type="credit",
                    source="reversal",
                    points=Decimal(redemption.point_cost),
                    balance_after=wallet.balance,
                    reference_type="Redemption",
                    reference_id=redemption.id,
                    description=f"Refund for failed redemption: {redemption.item_name}",
                )
                db.add(refund)

        ledger = RedemptionLedger(
            redemption_id=redemption.id,
            tenant_id=redemption.tenant_id,
            user_id=redemption.user_id,
            action=redemption.status,
            status_before=old_status,
            status_after=redemption.status,
        )
        db.add(ledger)
        db.commit()
    except Exception as exc:
        print(f"[rewards.fulfillment] sync fulfil error: {exc}")
        db.rollback()
    finally:
        db.close()


# ────────────────────────────────────────────────────────────────────
# Public read endpoints
# ────────────────────────────────────────────────────────────────────


@router.get("/categories", response_model=List[str])
async def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return distinct categories in the catalog visible to this tenant."""
    rows = (
        db.query(RewardCatalogItem.category)
        .filter(
            RewardCatalogItem.is_active.is_(True),
            or_(
                RewardCatalogItem.tenant_id.is_(None),
                RewardCatalogItem.tenant_id == current_user.tenant_id,
            ),
        )
        .distinct()
        .all()
    )
    return sorted([r[0] for r in rows])


@router.get("/catalog", response_model=CatalogListResponse)
async def list_catalog(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    category: Optional[str] = Query(None),
    brand: Optional[str] = Query(None),
    min_points: Optional[int] = Query(None, ge=1),
    max_points: Optional[int] = Query(None, ge=1),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
):
    """List catalog items visible to this tenant, with filters."""
    query = db.query(RewardCatalogItem).filter(
        RewardCatalogItem.is_active.is_(True),
        or_(
            RewardCatalogItem.tenant_id.is_(None),
            RewardCatalogItem.tenant_id == current_user.tenant_id,
        ),
    )

    if category:
        query = query.filter(RewardCatalogItem.category == category)
    if brand:
        query = query.filter(RewardCatalogItem.brand == brand)
    if min_points is not None:
        query = query.filter(RewardCatalogItem.max_denomination_points >= min_points)
    if max_points is not None:
        query = query.filter(RewardCatalogItem.min_denomination_points <= max_points)
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                RewardCatalogItem.name.ilike(like),
                RewardCatalogItem.brand.ilike(like),
                RewardCatalogItem.category.ilike(like),
            )
        )

    total = query.count()

    items = (
        query.order_by(RewardCatalogItem.category, RewardCatalogItem.name)
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # Distinct categories across ALL visible items (unfiltered) for sidebar
    all_cat_rows = (
        db.query(RewardCatalogItem.category)
        .filter(
            RewardCatalogItem.is_active.is_(True),
            or_(
                RewardCatalogItem.tenant_id.is_(None),
                RewardCatalogItem.tenant_id == current_user.tenant_id,
            ),
        )
        .distinct()
        .all()
    )
    categories = sorted([r[0] for r in all_cat_rows])

    return CatalogListResponse(
        items=[_to_catalog_response(i) for i in items],
        total=total,
        categories=categories,
    )


@router.get("/catalog/{item_id}", response_model=CatalogItemResponse)
async def get_catalog_item(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single catalog item with pre-computed denominations."""
    item = (
        db.query(RewardCatalogItem)
        .filter(
            RewardCatalogItem.id == item_id,
            RewardCatalogItem.is_active.is_(True),
            or_(
                RewardCatalogItem.tenant_id.is_(None),
                RewardCatalogItem.tenant_id == current_user.tenant_id,
            ),
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Catalog item not found")
    return _to_catalog_response(item)


# ────────────────────────────────────────────────────────────────────
# Wallet summary
# ────────────────────────────────────────────────────────────────────


@router.get("/wallet", response_model=WalletSummary)
async def get_wallet_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return the current user's wallet balance for the Redeem page header."""
    wallet = db.query(Wallet).filter(Wallet.user_id == current_user.id).first()
    if not wallet:
        return WalletSummary(balance=0, lifetime_earned=0, lifetime_spent=0)
    return WalletSummary(
        balance=int(wallet.balance),
        lifetime_earned=int(wallet.lifetime_earned),
        lifetime_spent=int(wallet.lifetime_spent),
    )


# ────────────────────────────────────────────────────────────────────
# Redemption (order) endpoints
# ────────────────────────────────────────────────────────────────────


@router.post("/redeem", response_model=RedeemResponse)
async def redeem_item(
    req: RedeemRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Atomic redemption flow:
    1. Validate catalog item + denomination
    2. Validate wallet balance
    3. DB transaction: debit wallet + create Redemption row
    4. Fire background fulfilment task
    5. Return PENDING order immediately
    """
    from models import SystemAdmin

    if isinstance(current_user, SystemAdmin):
        raise HTTPException(status_code=403, detail="Tenant user required")

    # ── 1. Tenant checks ───────────────────────────────────────────
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if tenant.redemptions_paused:
        raise HTTPException(status_code=400, detail="Redemptions are temporarily paused")
    if float(tenant.master_budget_balance or 0) < float(tenant.master_budget_threshold or 0):
        raise HTTPException(status_code=400, detail="Redemptions paused – low master balance")

    # ── 2. Catalog item ────────────────────────────────────────────
    item = (
        db.query(RewardCatalogItem)
        .filter(
            RewardCatalogItem.id == req.catalog_item_id,
            RewardCatalogItem.is_active.is_(True),
            or_(
                RewardCatalogItem.tenant_id.is_(None),
                RewardCatalogItem.tenant_id == current_user.tenant_id,
            ),
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Catalog item not found or unavailable")

    # ── 3. Denomination validation ─────────────────────────────────
    denoms = _build_denominations(item)
    if req.points not in denoms:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid denomination. Choose one of: {denoms}",
        )

    # ── 4. Inventory check (physical items) ────────────────────────
    if item.fulfillment_type == "INVENTORY_ITEM" and item.inventory_count is not None:
        if item.inventory_count <= 0:
            raise HTTPException(status_code=400, detail="Item out of stock")

    # ── 5. Wallet balance check ─────────────────────────────────────
    wallet = db.query(Wallet).filter(Wallet.user_id == current_user.id).first()
    if not wallet or int(wallet.balance) < req.points:
        raise HTTPException(status_code=400, detail="Insufficient points balance")

    # ── 6. Atomic DB transaction ────────────────────────────────────
    # Debit wallet
    wallet.balance -= req.points
    wallet.lifetime_spent += req.points

    # Wallet ledger entry
    wallet_tx = WalletLedger(
        tenant_id=current_user.tenant_id,
        wallet_id=wallet.id,
        transaction_type="debit",
        source="redemption",
        points=Decimal(req.points),
        balance_after=wallet.balance,
        reference_type="RewardCatalogItem",
        reference_id=item.id,
        description=f"Redeemed {item.name} ({req.points} pts)",
    )
    db.add(wallet_tx)

    # Build delivery details
    delivery: dict = {}
    if req.delivery_name:
        delivery["name"] = req.delivery_name
    if req.delivery_phone:
        delivery["phone"] = req.delivery_phone
    if req.delivery_address:
        delivery["address"] = req.delivery_address
    if req.delivery_city:
        delivery["city"] = req.delivery_city
    if req.delivery_state:
        delivery["state"] = req.delivery_state
    if req.delivery_pincode:
        delivery["pincode"] = req.delivery_pincode
    if current_user.personal_email:
        delivery["email"] = current_user.personal_email

    # Create Redemption order
    initial_status = "PENDING" if item.fulfillment_type == "GIFT_CARD_API" else "PROCESSING"
    redemption = Redemption(
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        item_type="VOUCHER" if item.fulfillment_type == "GIFT_CARD_API" else "MERCH",
        item_id=item.id,
        item_name=item.name,
        point_cost=req.points,
        actual_cost=Decimal(req.points),  # 1:1 by default; markup applied via tenant config
        status=initial_status,
        delivery_details=delivery,
    )
    db.add(redemption)

    # Decrement inventory for physical items
    if item.fulfillment_type == "INVENTORY_ITEM" and item.inventory_count is not None:
        item.inventory_count -= 1

    db.flush()  # get redemption.id before ledger

    # Redemption audit ledger
    r_ledger = RedemptionLedger(
        redemption_id=redemption.id,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        action="CREATED",
        status_before=None,
        status_after=initial_status,
    )
    db.add(r_ledger)

    db.commit()
    db.refresh(redemption)
    db.refresh(wallet)

    # ── 7. Fire background fulfilment ──────────────────────────────
    if item.fulfillment_type == "GIFT_CARD_API":
        background_tasks.add_task(_fulfill_in_background, str(redemption.id))

    balance_after = int(wallet.balance)

    return RedeemResponse(
        status=initial_status,
        redemption_id=redemption.id,
        message=(
            "Voucher is being processed. You'll receive it shortly."
            if item.fulfillment_type == "GIFT_CARD_API"
            else "Order placed. Our team will process your request."
        ),
        item_name=item.name,
        points_spent=req.points,
        wallet_balance_after=balance_after,
    )


@router.get("/redemptions", response_model=RewardOrderListResponse)
async def list_my_redemptions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
):
    """Return the authenticated user's redemption order history."""
    query = db.query(Redemption).filter(
        Redemption.user_id == current_user.id,
        Redemption.tenant_id == current_user.tenant_id,
    )
    if status:
        query = query.filter(Redemption.status == status.upper())

    total = query.count()
    orders = (
        query.order_by(Redemption.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    # Enrich with catalog item metadata (image_url, category)
    item_ids = [o.item_id for o in orders if o.item_id]
    catalog_map: dict[UUID, RewardCatalogItem] = {}
    if item_ids:
        rows = db.query(RewardCatalogItem).filter(RewardCatalogItem.id.in_(item_ids)).all()
        catalog_map = {r.id: r for r in rows}

    def _order_item(o: Redemption) -> RewardOrderItem:
        cat = catalog_map.get(o.item_id) if o.item_id else None
        return RewardOrderItem(
            id=o.id,
            item_name=o.item_name,
            item_type=o.item_type,
            category=cat.category if cat else None,
            image_url=cat.image_url if cat else None,
            points_spent=o.point_cost,
            status=o.status,
            voucher_code=o.voucher_code,
            redeem_url=(o.delivery_details or {}).get("redeem_url"),
            tracking_number=o.tracking_number,
            failed_reason=o.failed_reason,
            created_at=o.created_at,
            updated_at=o.updated_at,
        )

    return RewardOrderListResponse(
        items=[_order_item(o) for o in orders],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total else 1,
    )


@router.get("/redemptions/{order_id}", response_model=RewardOrderItem)
async def get_my_redemption(
    order_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a single redemption order (user must own it)."""
    order = (
        db.query(Redemption)
        .filter(
            Redemption.id == order_id,
            Redemption.user_id == current_user.id,
        )
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    cat = (
        db.query(RewardCatalogItem).filter(RewardCatalogItem.id == order.item_id).first()
        if order.item_id
        else None
    )
    return RewardOrderItem(
        id=order.id,
        item_name=order.item_name,
        item_type=order.item_type,
        category=cat.category if cat else None,
        image_url=cat.image_url if cat else None,
        points_spent=order.point_cost,
        status=order.status,
        voucher_code=order.voucher_code,
        redeem_url=(order.delivery_details or {}).get("redeem_url"),
        tracking_number=order.tracking_number,
        failed_reason=order.failed_reason,
        created_at=order.created_at,
        updated_at=order.updated_at,
    )


# ────────────────────────────────────────────────────────────────────
# Admin catalog management (hr_admin / platform_admin)
# ────────────────────────────────────────────────────────────────────


@router.post("/catalog", response_model=CatalogItemResponse, status_code=201)
async def create_catalog_item(
    data: CatalogItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_admin(current_user)
    item = RewardCatalogItem(
        tenant_id=current_user.tenant_id,
        **data.model_dump(),
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _to_catalog_response(item)


@router.put("/catalog/{item_id}", response_model=CatalogItemResponse)
async def update_catalog_item(
    item_id: UUID,
    data: CatalogItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_admin(current_user)
    item = (
        db.query(RewardCatalogItem)
        .filter(
            RewardCatalogItem.id == item_id,
            or_(
                RewardCatalogItem.tenant_id.is_(None),
                RewardCatalogItem.tenant_id == current_user.tenant_id,
            ),
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Catalog item not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return _to_catalog_response(item)


@router.delete("/catalog/{item_id}", status_code=204)
async def delete_catalog_item(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    verify_admin(current_user)
    item = (
        db.query(RewardCatalogItem)
        .filter(
            RewardCatalogItem.id == item_id,
            or_(
                RewardCatalogItem.tenant_id.is_(None),
                RewardCatalogItem.tenant_id == current_user.tenant_id,
            ),
        )
        .first()
    )
    if not item:
        raise HTTPException(status_code=404, detail="Catalog item not found")
    item.is_active = False
    db.commit()
