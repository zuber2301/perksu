"""
Points Ledger API Endpoints
Provides transaction history and ledger queries with filtering, sorting, and pagination.
"""

from datetime import datetime
from typing import Optional, List
from decimal import Decimal
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy import and_, or_, desc, func
from sqlalchemy.orm import Session

from database import get_db
from models import AllocationLog, PlatformBillingLog, Wallet, Tenant, User
# Using response dicts directly; keep schemas in points/schemas.py for other endpoints
from auth.utils import get_current_user

router = APIRouter(prefix="/api/v1/points/ledger", tags=["Points Ledger"])


@router.get("/allocation-logs")
def get_allocation_logs(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
    tenant_id: Optional[str] = Query(None, description="Filter by tenant ID"),
    status: Optional[str] = Query(None, description="Filter by status (COMPLETED, PENDING, REVOKED)"),
    search: Optional[str] = Query(None, description="Search in reference_note or ID"),
    min_amount: Optional[float] = Query(None, description="Minimum amount"),
    max_amount: Optional[float] = Query(None, description="Maximum amount"),
    date_from: Optional[str] = Query(None, description="From date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="To date (YYYY-MM-DD)"),
    sort_by: str = Query("created_at", description="Sort field: created_at, amount"),
    sort_order: str = Query("desc", description="Sort order: asc, desc"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(25, ge=1, le=100, description="Items per page"),
):
    """
    Retrieve allocation logs with advanced filtering and pagination.
    Only Platform Admins can see all logs; others see only their tenant's logs.
    """
    query = db.query(AllocationLog)

    # Authorization: Limit to tenant if not Platform Admin
    if current_user.role != "PLATFORM_ADMIN":
        if hasattr(current_user, 'tenant_id'):
            query = query.filter(AllocationLog.tenant_id == current_user.tenant_id)
        else:
            raise HTTPException(status_code=403, detail="Not authorized to view allocation logs")

    # Apply filters
    if tenant_id:
        query = query.filter(AllocationLog.tenant_id == tenant_id)

    if status:
        query = query.filter(AllocationLog.status == status)

    if search:
        query = query.filter(
            or_(
                AllocationLog.reference_note.ilike(f"%{search}%"),
                AllocationLog.id.ilike(f"%{search}%")
            )
        )

    if min_amount is not None:
        query = query.filter(AllocationLog.amount >= Decimal(str(min_amount)))

    if max_amount is not None:
        query = query.filter(AllocationLog.amount <= Decimal(str(max_amount)))

    if date_from:
        try:
            date_from_obj = datetime.strptime(date_from, "%Y-%m-%d")
            query = query.filter(AllocationLog.created_at >= date_from_obj)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_from format")

    if date_to:
        try:
            date_to_obj = datetime.strptime(date_to, "%Y-%m-%d")
            query = query.filter(AllocationLog.created_at <= date_to_obj)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_to format")

    # Get total count before pagination
    total = query.count()

    # Apply sorting
    if sort_by == "amount":
        sort_field = AllocationLog.amount
    else:
        sort_field = AllocationLog.created_at

    if sort_order.lower() == "asc":
        query = query.order_by(sort_field)
    else:
        query = query.order_by(desc(sort_field))

    # Apply pagination
    offset = (page - 1) * limit
    logs = query.offset(offset).limit(limit).all()

    # Fetch tenant names for display
    tenant_ids = set(log.tenant_id for log in logs)
    tenants = db.query(Tenant).filter(Tenant.id.in_(tenant_ids)).all()
    tenant_map = {t.id: t.name for t in tenants}

    # Convert to response format
    logs_data = []
    for log in logs:
        log_dict = {
            "id": log.id,
            "tenant_id": log.tenant_id,
            "tenant_name": tenant_map.get(log.tenant_id, "Unknown"),
            "allocated_by": log.allocated_by,
            "amount": float(log.amount),
            "currency": log.currency,
            "reference_note": log.reference_note,
            "status": log.status,
            "created_at": log.created_at.isoformat(),
            "updated_at": log.updated_at.isoformat() if log.updated_at else None,
        }
        logs_data.append(log_dict)

    return {
        "success": True,
        "data": {
            "transactions": logs_data,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit,
        },
    }


@router.get("/platform-billing-logs")
def get_platform_billing_logs(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
    admin_id: Optional[str] = Query(None, description="Filter by admin ID"),
    tenant_id: Optional[str] = Query(None, description="Filter by tenant ID"),
    transaction_type: Optional[str] = Query(None, description="Filter by transaction type"),
    search: Optional[str] = Query(None, description="Search in reference_note"),
    min_amount: Optional[float] = Query(None, description="Minimum amount"),
    max_amount: Optional[float] = Query(None, description="Maximum amount"),
    date_from: Optional[str] = Query(None, description="From date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="To date (YYYY-MM-DD)"),
    sort_by: str = Query("created_at", description="Sort field: created_at, amount"),
    sort_order: str = Query("desc", description="Sort order: asc, desc"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(25, ge=1, le=100, description="Items per page"),
):
    """
    Retrieve platform billing logs (admin-only allocations).
    Only Platform Admins can access this endpoint.
    """
    if current_user.role != "PLATFORM_ADMIN":
        raise HTTPException(status_code=403, detail="Only Platform Admins can view billing logs")

    query = db.query(PlatformBillingLog)

    # Apply filters
    if admin_id:
        query = query.filter(PlatformBillingLog.admin_id == admin_id)

    if tenant_id:
        query = query.filter(PlatformBillingLog.tenant_id == tenant_id)

    if transaction_type:
        query = query.filter(PlatformBillingLog.transaction_type == transaction_type)

    if search:
        query = query.filter(PlatformBillingLog.reference_note.ilike(f"%{search}%"))

    if min_amount is not None:
        query = query.filter(PlatformBillingLog.amount >= Decimal(str(min_amount)))

    if max_amount is not None:
        query = query.filter(PlatformBillingLog.amount <= Decimal(str(max_amount)))

    if date_from:
        try:
            date_from_obj = datetime.strptime(date_from, "%Y-%m-%d")
            query = query.filter(PlatformBillingLog.created_at >= date_from_obj)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_from format")

    if date_to:
        try:
            date_to_obj = datetime.strptime(date_to, "%Y-%m-%d")
            query = query.filter(PlatformBillingLog.created_at <= date_to_obj)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_to format")

    # Get total count
    total = query.count()

    # Apply sorting
    if sort_by == "amount":
        sort_field = PlatformBillingLog.amount
    else:
        sort_field = PlatformBillingLog.created_at

    if sort_order.lower() == "asc":
        query = query.order_by(sort_field)
    else:
        query = query.order_by(desc(sort_field))

    # Apply pagination
    offset = (page - 1) * limit
    logs = query.offset(offset).limit(limit).all()

    # Fetch tenant/admin names
    tenant_ids = set(log.tenant_id for log in logs if log.tenant_id)
    admin_ids = set(log.admin_id for log in logs if log.admin_id)
    
    tenants = db.query(Tenant).filter(Tenant.id.in_(tenant_ids)).all() if tenant_ids else []
    admins = db.query(User).filter(User.id.in_(admin_ids)).all() if admin_ids else []
    
    tenant_map = {t.id: t.name for t in tenants}
    admin_map = {a.id: a.email for a in admins}

    # Convert to response format
    logs_data = []
    for log in logs:
        log_dict = {
            "id": log.id,
            "admin_id": log.admin_id,
            "admin_email": admin_map.get(log.admin_id, "Unknown"),
            "tenant_id": log.tenant_id,
            "tenant_name": tenant_map.get(log.tenant_id, "Unknown") if log.tenant_id else None,
            "amount": float(log.amount),
            "currency": log.currency,
            "reference_note": log.reference_note,
            "transaction_type": log.transaction_type,
            "created_at": log.created_at.isoformat(),
        }
        logs_data.append(log_dict)

    return {
        "success": True,
        "data": {
            "transactions": logs_data,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit,
        },
    }


@router.get("/wallet-ledger")
def get_wallet_ledger(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
    user_id: Optional[str] = Query(None, description="Filter by user ID"),
    transaction_type: Optional[str] = Query(None, description="Filter by type (credit, debit)"),
    search: Optional[str] = Query(None, description="Search in notes"),
    min_amount: Optional[float] = Query(None, description="Minimum amount"),
    max_amount: Optional[float] = Query(None, description="Maximum amount"),
    date_from: Optional[str] = Query(None, description="From date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="To date (YYYY-MM-DD)"),
    sort_by: str = Query("created_at", description="Sort field: created_at, points"),
    sort_order: str = Query("desc", description="Sort order: asc, desc"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(25, ge=1, le=100, description="Items per page"),
):
    """
    Retrieve wallet transaction ledger (rewards, redemptions, expirations).
    Users can only see their own wallet; Managers see team wallets.
    """
    query = db.query(Wallet)

    # Authorization: Limit based on user role
    if current_user.role == "USER":
        query = query.filter(Wallet.user_id == current_user.id)
    elif hasattr(current_user, 'tenant_id'):
        # Manager: See all users in tenant
        tenant_users = db.query(User.id).filter(User.tenant_id == current_user.tenant_id).all()
        user_ids = [u.id for u in tenant_users]
        query = query.filter(Wallet.user_id.in_(user_ids))

    # Apply filters
    if user_id:
        query = query.filter(Wallet.user_id == user_id)

    if min_amount is not None:
        query = query.filter(Wallet.balance >= Decimal(str(min_amount)))

    if max_amount is not None:
        query = query.filter(Wallet.balance <= Decimal(str(max_amount)))

    # Note: Wallet table doesn't have transaction_type or created_at columns
    # This endpoint returns current wallet state; for full ledger, we'd need a separate 
    # wallet_transactions table. For now, return wallet summaries.

    wallets = query.all()

    # Convert to response format
    ledger_data = []
    for wallet in wallets:
        user = db.query(User).filter(User.id == wallet.user_id).first()
        ledger_dict = {
            "id": wallet.id,
            "user_id": wallet.user_id,
            "user_name": f"{user.first_name} {user.last_name}" if user else "Unknown",
            "user_email": user.email if user else "Unknown",
            "current_balance": float(wallet.balance),
            "currency": "INR",  # Default currency
            "points": float(wallet.balance),
            "status": "ACTIVE" if wallet.balance > 0 else "ZERO",
        }
        ledger_data.append(ledger_dict)

    # Sort and paginate
    if sort_by == "points":
        ledger_data.sort(key=lambda x: x["points"], reverse=(sort_order == "desc"))
    else:
        # Default sort by points if no valid sort field
        ledger_data.sort(key=lambda x: x["points"], reverse=(sort_order == "desc"))

    total = len(ledger_data)
    offset = (page - 1) * limit
    paginated_data = ledger_data[offset:offset + limit]

    return {
        "success": True,
        "data": {
            "transactions": paginated_data,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": (total + limit - 1) // limit,
        },
    }


@router.get("/stats")
def get_ledger_stats(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
    tenant_id: Optional[str] = Query(None, description="Filter by tenant ID"),
):
    """
    Get aggregated statistics for ledger data.
    """
    allocation_query = db.query(AllocationLog)
    wallet_query = db.query(Wallet)

    # Authorization
    if current_user.role != "PLATFORM_ADMIN":
        if hasattr(current_user, 'tenant_id'):
            allocation_query = allocation_query.filter(
                AllocationLog.tenant_id == current_user.tenant_id
            )
            tenant_users = db.query(User.id).filter(User.tenant_id == current_user.tenant_id).all()
            user_ids = [u.id for u in tenant_users]
            wallet_query = wallet_query.filter(Wallet.user_id.in_(user_ids))
        else:
            raise HTTPException(status_code=403, detail="Not authorized")

    # Apply tenant filter if provided
    if tenant_id and current_user.role == "PLATFORM_ADMIN":
        allocation_query = allocation_query.filter(AllocationLog.tenant_id == tenant_id)
        tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        if tenant:
            tenant_users = db.query(User.id).filter(User.tenant_id == tenant_id).all()
            user_ids = [u.id for u in tenant_users]
            wallet_query = wallet_query.filter(Wallet.user_id.in_(user_ids))

    # Calculate stats
    total_allocated = db.query(func.sum(AllocationLog.amount)).filter(
        AllocationLog.status == "COMPLETED"
    ).scalar() or 0

    total_clawed_back = db.query(func.sum(AllocationLog.amount)).filter(
        AllocationLog.status == "REVOKED"
    ).scalar() or 0

    total_in_wallets = db.query(func.sum(Wallet.balance)).scalar() or 0

    allocation_count = allocation_query.count()
    wallet_count = wallet_query.count()

    return {
        "success": True,
        "data": {
            "total_allocated": float(total_allocated),
            "total_clawed_back": float(total_clawed_back),
            "total_in_wallets": float(total_in_wallets),
            "allocation_count": allocation_count,
            "wallet_count": wallet_count,
            "net_distributed": float(total_allocated - total_clawed_back),
        },
    }
