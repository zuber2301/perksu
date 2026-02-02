"""Redemption System Routes"""
import random
import string
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc, func

from database import get_db
from auth.utils import get_current_user, require_tenant_user
from models import (
    User, Tenant, Redemption, VoucherCatalog, MerchandiseCatalog,
    Wallet, WalletLedger, RedemptionLedger
)
from .schemas import (
    VoucherCatalogCreate, VoucherCatalogResponse, VoucherCatalogUpdate,
    MerchandiseCatalogCreate, MerchandiseCatalogResponse, MerchandiseCatalogUpdate,
    RedemptionInitiate, RedemptionOTPVerify, RedemptionDeliveryDetails,
    RedemptionResponse, RedemptionHistoryResponse, RedemptionListResponse,
    RedemptionRequestAdmin, RedemptionRequestUpdate, VendorBalanceResponse,
    RedemptionAnalytics, MarkupManagementUpdate
)
from auth.utils import verify_admin
from .aggregator import get_aggregator_client


router = APIRouter()


# =====================================================
# VOUCHER CATALOG ROUTES
# =====================================================

@router.get("/vouchers", response_model=list[VoucherCatalogResponse])
async def list_vouchers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    status: str = Query("active")
):
    """List available vouchers for user's tenant"""
    vouchers = db.query(VoucherCatalog).filter(
        and_(
            VoucherCatalog.tenant_id == current_user.tenant_id,
            VoucherCatalog.status == status
        )
    ).all()
    return vouchers


@router.get("/vouchers/{voucher_id}", response_model=VoucherCatalogResponse)
async def get_voucher(
    voucher_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get voucher details"""
    voucher = db.query(VoucherCatalog).filter(
        and_(
            VoucherCatalog.id == voucher_id,
            VoucherCatalog.tenant_id == current_user.tenant_id
        )
    ).first()
    
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    
    return voucher


@router.post("/vouchers", response_model=VoucherCatalogResponse)
async def create_voucher(
    data: VoucherCatalogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new voucher catalog entry (admin only)"""
    verify_admin(current_user)
    
    voucher = VoucherCatalog(
        tenant_id=current_user.tenant_id,
        **data.model_dump()
    )
    db.add(voucher)
    db.commit()
    db.refresh(voucher)
    
    return voucher


@router.put("/vouchers/{voucher_id}", response_model=VoucherCatalogResponse)
async def update_voucher(
    voucher_id: UUID,
    data: VoucherCatalogUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update voucher (admin only)"""
    verify_admin(current_user)
    
    voucher = db.query(VoucherCatalog).filter(
        and_(
            VoucherCatalog.id == voucher_id,
            VoucherCatalog.tenant_id == current_user.tenant_id
        )
    ).first()
    
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(voucher, field, value)
    
    db.commit()
    db.refresh(voucher)
    
    return voucher


# =====================================================
# MERCHANDISE CATALOG ROUTES
# =====================================================

@router.get("/merchandise", response_model=list[MerchandiseCatalogResponse])
async def list_merchandise(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    category: str = Query(None),
    status: str = Query("active")
):
    """List available merchandise"""
    query = db.query(MerchandiseCatalog).filter(
        and_(
            MerchandiseCatalog.tenant_id == current_user.tenant_id,
            MerchandiseCatalog.status == status
        )
    )
    
    if category:
        query = query.filter(MerchandiseCatalog.category == category)
    
    return query.all()


@router.get("/merchandise/{merch_id}", response_model=MerchandiseCatalogResponse)
async def get_merchandise(
    merch_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get merchandise details"""
    merch = db.query(MerchandiseCatalog).filter(
        and_(
            MerchandiseCatalog.id == merch_id,
            MerchandiseCatalog.tenant_id == current_user.tenant_id
        )
    ).first()
    
    if not merch:
        raise HTTPException(status_code=404, detail="Merchandise not found")
    
    return merch


@router.post("/merchandise", response_model=MerchandiseCatalogResponse)
async def create_merchandise(
    data: MerchandiseCatalogCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create new merchandise (admin only)"""
    verify_admin(current_user)
    
    merch = MerchandiseCatalog(
        tenant_id=current_user.tenant_id,
        **data.model_dump()
    )
    db.add(merch)
    db.commit()
    db.refresh(merch)
    
    return merch


@router.put("/merchandise/{merch_id}", response_model=MerchandiseCatalogResponse)
async def update_merchandise(
    merch_id: UUID,
    data: MerchandiseCatalogUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update merchandise (admin only)"""
    verify_admin(current_user)
    
    merch = db.query(MerchandiseCatalog).filter(
        and_(
            MerchandiseCatalog.id == merch_id,
            MerchandiseCatalog.tenant_id == current_user.tenant_id
        )
    ).first()
    
    if not merch:
        raise HTTPException(status_code=404, detail="Merchandise not found")
    
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(merch, field, value)
    
    db.commit()
    db.refresh(merch)
    
    return merch


# =====================================================
# REDEMPTION ROUTES - USER FLOW
# =====================================================

def generate_otp() -> str:
    """Generate 6-digit OTP"""
    return ''.join(random.choices(string.digits, k=6))


@router.post("/initiate")
async def initiate_redemption(
    data: RedemptionInitiate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Initiate redemption request - returns OTP"""
    
    # Ensure caller is a tenant user (not a SystemAdmin)
    from models import SystemAdmin
    if isinstance(current_user, SystemAdmin):
        raise HTTPException(status_code=403, detail="Tenant user required")

    # Check wallet balance
    wallet = db.query(Wallet).filter(Wallet.user_id == current_user.id).first()
    if not wallet or wallet.balance < data.point_cost:
        raise HTTPException(status_code=400, detail="Insufficient points balance")
    
    # Verify item exists and is available
    if data.item_type == "VOUCHER":
        item = db.query(VoucherCatalog).filter(
            and_(
                VoucherCatalog.id == data.item_id,
                VoucherCatalog.tenant_id == current_user.tenant_id,
                VoucherCatalog.status == "active"
            )
        ).first()
    else:
        item = db.query(MerchandiseCatalog).filter(
            and_(
                MerchandiseCatalog.id == data.item_id,
                MerchandiseCatalog.tenant_id == current_user.tenant_id,
                MerchandiseCatalog.status == "active"
            )
        ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found or unavailable")
    
    # Generate OTP
    otp_code = generate_otp()
    otp_expires_at = datetime.utcnow() + timedelta(minutes=10)
    
    # Create redemption request
    redemption = Redemption(
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        item_type=data.item_type,
        item_id=data.item_id,
        item_name=data.item_name,
        point_cost=data.point_cost,
        actual_cost=data.actual_cost,
        status="PENDING",
        otp_code=otp_code,
        otp_expires_at=otp_expires_at
    )
    
    db.add(redemption)
    db.commit()
    db.refresh(redemption)
    
    # Log to ledger
    ledger = RedemptionLedger(
        redemption_id=redemption.id,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        action="CREATED",
        status_before=None,
        status_after="PENDING"
    )
    db.add(ledger)
    db.commit()
    
    # TODO: Send OTP via SMS/Email
    print(f"OTP for {current_user.email}: {otp_code}")
    
    return {
        "redemption_id": str(redemption.id),
        "message": f"OTP sent to {current_user.email}",
        "otp_expires_in_minutes": 10
    }


@router.post("/verify-otp")
async def verify_otp(
    data: RedemptionOTPVerify,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from models import SystemAdmin
    if isinstance(current_user, SystemAdmin):
        raise HTTPException(status_code=403, detail="Tenant user required")
    """Verify OTP and lock points"""
    
    redemption = db.query(Redemption).filter(
        and_(
            Redemption.id == data.redemption_id,
            Redemption.user_id == current_user.id,
            Redemption.status == "PENDING"
        )
    ).first()
    
    if not redemption:
        raise HTTPException(status_code=404, detail="Redemption request not found")
    
    # Check OTP expiry
    if datetime.utcnow() > redemption.otp_expires_at:
        redemption.status = "FAILED"
        redemption.failed_reason = "OTP expired"
        db.commit()
        raise HTTPException(status_code=400, detail="OTP expired")
    
    # Verify OTP code
    if data.otp_code != redemption.otp_code:
        redemption.otp_attempts += 1
        
        if redemption.otp_attempts >= 3:
            redemption.status = "FAILED"
            redemption.failed_reason = "Maximum OTP attempts exceeded"
        
        db.commit()
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # Deduct points from wallet
    wallet = db.query(Wallet).filter(Wallet.user_id == current_user.id).first()
    wallet.balance -= redemption.point_cost
    wallet.lifetime_spent += redemption.point_cost
    
    # Log wallet transaction
    transaction = WalletLedger(
        tenant_id=current_user.tenant_id,
        wallet_id=wallet.id,
        transaction_type="debit",
        source="redemption",
        points=Decimal(redemption.point_cost),
        balance_after=wallet.balance,
        reference_type="Redemption",
        reference_id=redemption.id,
        description=f"Redeemed {redemption.item_name}"
    )
    db.add(transaction)
    
    # Update redemption
    redemption.status = "OTP_VERIFIED"
    redemption.otp_verified_at = datetime.utcnow()
    
    # Log to ledger
    ledger = RedemptionLedger(
        redemption_id=redemption.id,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        action="OTP_VERIFIED",
        status_before="PENDING",
        status_after="OTP_VERIFIED"
    )
    db.add(ledger)
    
    db.commit()
    
    return {
        "redemption_id": str(redemption.id),
        "status": "OTP_VERIFIED",
        "message": "OTP verified successfully. Please provide delivery details."
    }


@router.post("/delivery-details/{redemption_id}")
async def submit_delivery_details(
    redemption_id: UUID,
    data: RedemptionDeliveryDetails,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from models import SystemAdmin
    if isinstance(current_user, SystemAdmin):
        raise HTTPException(status_code=403, detail="Tenant user required")
    """Submit delivery details for redemption"""
    
    redemption = db.query(Redemption).filter(
        and_(
            Redemption.id == redemption_id,
            Redemption.user_id == current_user.id,
            Redemption.status == "OTP_VERIFIED"
        )
    ).first()
    
    if not redemption:
        raise HTTPException(status_code=404, detail="Redemption request not found or already processed")
    
    # Store delivery details
    if redemption.item_type == "MERCH":
        if not all([data.full_name, data.phone_number, data.address_line_1, data.city, data.pincode]):
            raise HTTPException(status_code=400, detail="All delivery details required for merchandise")
        
        redemption.delivery_details = {
            "full_name": data.full_name,
            "phone_number": data.phone_number,
            "address_line_1": data.address_line_1,
            "address_line_2": data.address_line_2,
            "city": data.city,
            "state": data.state,
            "pincode": data.pincode,
            "country": data.country
        }
    else:  # VOUCHER
        redemption.delivery_details = {
            "email": current_user.email
        }
    
    redemption.status = "PROCESSING"
    redemption.processed_at = datetime.utcnow()
    
    # Log to ledger
    ledger = RedemptionLedger(
        redemption_id=redemption.id,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        action="PROCESSING",
        status_before="OTP_VERIFIED",
        status_after="PROCESSING",
        metadata=redemption.delivery_details
    )
    db.add(ledger)
    db.commit()
    db.refresh(redemption)
    
    # If voucher, enqueue background task to issue voucher asynchronously
    if redemption.item_type == "VOUCHER":
        try:
            # import here to avoid circular imports at module load
            from .tasks import issue_voucher_task
            issue_voucher_task.delay(str(redemption.id))
        except Exception as e:
            # If enqueue fails, mark redemption failed and log
            redemption.status = "FAILED"
            redemption.failed_reason = f"enqueue_failed: {e}"
            db.add(redemption)
            ledger = RedemptionLedger(
                redemption_id=redemption.id,
                tenant_id=redemption.tenant_id,
                user_id=redemption.user_id,
                action="FAILED",
                status_before="PROCESSING",
                status_after="FAILED",
                metadata={"error": str(e)}
            )
            db.add(ledger)
            db.commit()

    return RedemptionResponse.model_validate(redemption)


@router.get("/history", response_model=RedemptionListResponse)
async def get_redemption_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    from models import SystemAdmin
    if isinstance(current_user, SystemAdmin):
        raise HTTPException(status_code=403, detail="Tenant user required")
    """Get user's redemption history"""
    
    query = db.query(Redemption).filter(
        Redemption.user_id == current_user.id
    ).order_by(desc(Redemption.created_at))
    
    total = query.count()
    
    redemptions = query.offset((page - 1) * page_size).limit(page_size).all()
    
    items = [
        RedemptionHistoryResponse(
            id=r.id,
            item_name=r.item_name,
            item_type=r.item_type,
            point_cost=r.point_cost,
            status=r.status,
            created_at=r.created_at,
            voucher_code=r.voucher_code,
            tracking_number=r.tracking_number
        )
        for r in redemptions
    ]
    
    return RedemptionListResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size
    )


# =====================================================
# ADMIN ROUTES
# =====================================================

@router.get("/admin/requests", response_model=list[RedemptionRequestAdmin])
async def get_pending_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    status: str = Query("PROCESSING")
):
    """Get pending redemption requests for admin"""
    verify_admin(current_user)
    
    redemptions = db.query(Redemption).join(User).filter(
        and_(
            Redemption.tenant_id == current_user.tenant_id,
            Redemption.status == status
        )
    ).order_by(desc(Redemption.created_at)).all()
    
    return [
        RedemptionRequestAdmin(
            id=r.id,
            user_email=r.user.email,
            user_name=r.user.full_name,
            item_name=r.item_name,
            status=r.status,
            delivery_details=r.delivery_details,
            created_at=r.created_at,
            processed_at=r.processed_at
        )
        for r in redemptions
    ]


@router.put("/admin/requests/{redemption_id}")
async def update_redemption_request(
    redemption_id: UUID,
    data: RedemptionRequestUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update redemption request status (admin only)"""
    verify_admin(current_user)
    
    redemption = db.query(Redemption).filter(
        and_(
            Redemption.id == redemption_id,
            Redemption.tenant_id == current_user.tenant_id
        )
    ).first()
    
    if not redemption:
        raise HTTPException(status_code=404, detail="Redemption not found")
    
    old_status = redemption.status
    redemption.status = data.status
    
    if data.tracking_number:
        redemption.tracking_number = data.tracking_number
        redemption.shipped_at = datetime.utcnow()
    
    if data.failed_reason:
        redemption.failed_reason = data.failed_reason
    
    # Log to ledger
    ledger = RedemptionLedger(
        redemption_id=redemption.id,
        tenant_id=current_user.tenant_id,
        user_id=redemption.user_id,
        action=data.status,
        status_before=old_status,
        status_after=data.status,
        created_by=current_user.id
    )
    db.add(ledger)
    
    db.commit()
    db.refresh(redemption)
    
    return RedemptionResponse.model_validate(redemption)


@router.get("/admin/vendor-balance", response_model=list[VendorBalanceResponse])
async def get_vendor_balances(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get vendor balance monitoring"""
    verify_admin(current_user)
    
    vouchers = db.query(VoucherCatalog).filter(
        VoucherCatalog.tenant_id == current_user.tenant_id
    ).distinct(VoucherCatalog.vendor_name).all()
    
    return [
        VendorBalanceResponse(
            vendor_name=v.vendor_name,
            api_partner=v.api_partner or "N/A",
            current_balance=v.vendor_balance,
            last_synced_at=v.last_synced_at
        )
        for v in vouchers
    ]


@router.get("/admin/analytics", response_model=RedemptionAnalytics)
async def get_analytics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get redemption analytics"""
    verify_admin(current_user)
    
    query = db.query(Redemption).filter(
        Redemption.tenant_id == current_user.tenant_id
    )
    
    total_redemptions = query.count()
    total_points_redeemed = db.query(func.sum(Redemption.point_cost)).filter(
        Redemption.tenant_id == current_user.tenant_id
    ).scalar() or 0
    
    total_revenue = db.query(func.sum(Redemption.markup_amount)).filter(
        Redemption.tenant_id == current_user.tenant_id
    ).scalar() or Decimal("0.0")
    
    pending_requests = query.filter(
        Redemption.status.in_(["PENDING", "PROCESSING"])
    ).count()
    
    fulfilled_orders = query.filter(
        Redemption.status.in_(["COMPLETED", "SHIPPED"])
    ).count()
    
    # Top items
    top_items = db.query(
        Redemption.item_name,
        func.count(Redemption.id).label("count")
    ).filter(
        Redemption.tenant_id == current_user.tenant_id
    ).group_by(Redemption.item_name).order_by(desc("count")).limit(10).all()
    
    return RedemptionAnalytics(
        total_redemptions=total_redemptions,
        total_points_redeemed=int(total_points_redeemed),
        total_revenue=total_revenue,
        pending_requests=pending_requests,
        fulfilled_orders=fulfilled_orders,
        top_items=list(top_items)
    )


@router.put("/admin/markup")
async def update_markup(
    data: MarkupManagementUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update markup/convenience fees"""
    verify_admin(current_user)
    
    if data.item_type == "VOUCHER":
        item = db.query(VoucherCatalog).filter(
            and_(
                VoucherCatalog.id == data.item_id,
                VoucherCatalog.tenant_id == current_user.tenant_id
            )
        ).first()
    else:
        item = db.query(MerchandiseCatalog).filter(
            and_(
                MerchandiseCatalog.id == data.item_id,
                MerchandiseCatalog.tenant_id == current_user.tenant_id
            )
        ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    item.markup_percentage = data.markup_percentage
    db.commit()
    
    return {"message": "Markup updated successfully"}



@router.post('/webhook/aggregator')
async def aggregator_webhook(payload: dict, db: Session = Depends(get_db)):
    """Simple webhook endpoint for aggregator callbacks.

    Expected payload (example):
    {
      "vendor_reference": "...",
      "status": "success|failed",
      "voucher_code": "...",
      "redemption_id": "<uuid>"
    }
    """
    vendor_ref = payload.get('vendor_reference')
    status = payload.get('status')
    redemption_id = payload.get('redemption_id')

    if not (vendor_ref or redemption_id):
        raise HTTPException(status_code=400, detail='Missing vendor_reference or redemption_id')

    # Try to find redemption
    query = db.query(Redemption)
    if redemption_id:
        redemption = query.filter(Redemption.id == redemption_id).first()
    else:
        redemption = query.filter(Redemption.delivery_details['vendor_reference'].astext == vendor_ref).first()

    if not redemption:
        raise HTTPException(status_code=404, detail='Redemption not found')

    # Update according to status
    if status == 'success':
        redemption.status = 'COMPLETED'
        redemption.voucher_code = payload.get('voucher_code')
        redemption.processed_at = datetime.utcnow()
        ledger = RedemptionLedger(
            redemption_id=redemption.id,
            tenant_id=redemption.tenant_id,
            user_id=redemption.user_id,
            action='COMPLETED',
            status_before=redemption.status,
            status_after='COMPLETED'
        )
        db.add(ledger)
    else:
        redemption.status = 'FAILED'
        redemption.failed_reason = payload.get('error') or 'aggregator failure'
        ledger = RedemptionLedger(
            redemption_id=redemption.id,
            tenant_id=redemption.tenant_id,
            user_id=redemption.user_id,
            action='FAILED',
            status_before=redemption.status,
            status_after='FAILED'
        )
        db.add(ledger)

    db.commit()
    return {"message": "ok"}
