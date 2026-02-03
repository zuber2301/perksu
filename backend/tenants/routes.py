from datetime import datetime
from decimal import Decimal
from typing import List
from uuid import UUID

from auth.tenant_utils import TenantResolver
from auth.utils import (
    get_current_user,
    get_hr_admin,
    get_password_hash,
    get_platform_admin,
)
from config import settings
from fastapi import APIRouter, Depends, HTTPException, Query, status
from models import Department, MasterBudgetLedger, SystemAdmin, Tenant, User, Wallet
from sqlalchemy import func
from sqlalchemy.orm import Session
from tenants.schemas import (
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
    InjectPointsRequest,
    TenantListResponse,
    TenantLoadBudget,
    TenantProvisionCreate,
    TenantResponse,
    TenantStatsResponse,
    TenantUpdate,
    TransactionResponse,
)

from database import get_db

router = APIRouter()


@router.get("/current", response_model=TenantResponse)
async def get_current_tenant(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get the current user's tenant"""
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.post("/invite-link", response_model=dict)
async def generate_invite_link(
    hours: int = Query(
        default=168, description="Link expiry in hours (default: 7 days)"
    ),
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db),
):
    """
    Generate an invite link for users to join the current tenant.

    The Invite-Link Method:
    - Creates a secure JWT token with embedded tenant_id
    - Token expires after specified hours (default: 7 days)
    - Users can share this link or distribute to new employees

    Usage:
    - Share link: {frontend_url}/signup?invite_token={token}
    - Users access endpoint: POST /auth/signup with invite_token parameter
    """
    if hours < 1 or hours > 8760:  # Max 1 year
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Hours must be between 1 and 8760",
        )

    # Get tenant details
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Generate invite token
    invite_token = TenantResolver.create_invite_token(
        tenant_id=current_user.tenant_id, expires_in_hours=hours
    )

    # Construct invite URL
    frontend_url = settings.frontend_url or "http://localhost:5173"
    invite_url = f"{frontend_url}/signup?invite_token={invite_token}"

    return {
        "invite_url": invite_url,
        "invite_token": invite_token,
        "expires_in_hours": hours,
        "tenant_id": str(current_user.tenant_id),
        "message": f"Share this link with new employees. Valid for {hours} hours.",
    }


@router.post("/", response_model=TenantResponse, status_code=status.HTTP_201_CREATED)
async def create_tenant(
    tenant_data: TenantProvisionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_platform_admin),
):
    """Provision a new tenant (Platform Admin only)"""
    # 1. Validation
    # Check if slug already exists
    existing_tenant = db.query(Tenant).filter(Tenant.slug == tenant_data.slug).first()
    if existing_tenant:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Organization with slug '{tenant_data.slug}' already exists.",
        )

    # Check if admin email already exists globally
    existing_user = db.query(User).filter(User.email == tenant_data.admin_email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Admin email '{tenant_data.admin_email}' is already registered.",
        )

    # 2. Create Tenant
    tenant = Tenant(
        name=tenant_data.name,
        slug=tenant_data.slug,
        branding_config=tenant_data.branding_config or {},
        subscription_tier=tenant_data.subscription_tier,
        master_budget_balance=tenant_data.initial_balance,
        status="ACTIVE",
    )
    db.add(tenant)
    db.flush()

    # 3. Initialize Master Budget Ledger
    ledger_entry = MasterBudgetLedger(
        tenant_id=tenant.id,
        transaction_type="credit",
        amount=tenant_data.initial_balance,
        balance_after=tenant_data.initial_balance,
        description="Initial provisioning balance",
    )
    db.add(ledger_entry)
    db.flush()

    # 4. Create Default Departments
    default_depts = [
        "Human Resource (HR)",
        "Technology (IT)",
        "Sales & Marketing",
        "Business Unit -1",
        "Business Unit-2",
        "Business Unit-3",
    ]

    hr_dept_id = None
    last_dept_id = None
    for dept_name in default_depts:
        new_dept = Department(tenant_id=tenant.id, name=dept_name)
        db.add(new_dept)
        db.flush()
        last_dept_id = new_dept.id
        if dept_name == "Human Resource (HR)":
            hr_dept_id = new_dept.id

    # Ensure we have a department ID for the admin user
    hr_dept_id = hr_dept_id or last_dept_id

    # 5. Create Tenant Manager User
    admin_user = User(
        tenant_id=tenant.id,
        email=tenant_data.admin_email,
        password_hash=get_password_hash(tenant_data.admin_password),
        first_name=tenant_data.admin_first_name,
        last_name=tenant_data.admin_last_name,
        role="hr_admin",  # Usually HR Admin is the tenant manager
        org_role="tenant_manager",
        department_id=hr_dept_id,
        is_super_admin=True,
        status="active",
    )
    db.add(admin_user)
    db.flush()

    # 6. Create wallet for admin
    admin_wallet = Wallet(
        tenant_id=tenant.id,
        user_id=admin_user.id,
        balance=0,
        lifetime_earned=0,
        lifetime_spent=0,
    )
    db.add(admin_wallet)

    db.commit()
    db.refresh(tenant)
    return tenant


@router.put("/current", response_model=TenantResponse)
async def update_current_tenant(
    tenant_data: TenantUpdate,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db),
):
    """Update current tenant settings (HR Admin only)"""
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    update_data = tenant_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(tenant, key, value)

    db.commit()
    db.refresh(tenant)
    return tenant


# Department endpoints
@router.get("/departments", response_model=List[DepartmentResponse])
async def get_departments(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get all departments for current tenant"""
    departments = (
        db.query(Department)
        .filter(Department.tenant_id == current_user.tenant_id)
        .all()
    )
    return departments


@router.get("/", response_model=List[TenantResponse])
async def list_tenants(
    db: Session = Depends(get_db), current_user: User = Depends(get_platform_admin)
):
    """List all tenants (Platform Admin only)"""
    return db.query(Tenant).all()


@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant(
    tenant_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_platform_admin),
):
    """Get tenant details (Platform Admin only)"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.post("/{tenant_id}/toggle-status", response_model=TenantResponse)
async def toggle_tenant_status(
    tenant_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_platform_admin),
):
    """Toggle tenant active/inactive status (Platform Admin only)"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenant.status = "INACTIVE" if tenant.status == "ACTIVE" else "ACTIVE"
    db.commit()
    db.refresh(tenant)
    return tenant


# ==================== TENANT MANAGER ENDPOINTS ====================


@router.get("/admin/tenants", response_model=TenantListResponse)
async def list_all_tenants_admin(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    search: str = Query("", min_length=0),
    status_filter: str = Query("", regex="^(ACTIVE|SUSPENDED|ARCHIVED)?$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_platform_admin),
):
    """
    List all tenants with pagination and filtering (Platform Admin only).
    Returns tenant stats including active user count and last activity.
    """
    query = db.query(Tenant)

    # Search by name or slug
    if search:
        query = query.filter(
            (Tenant.name.ilike(f"%{search}%")) | (Tenant.slug.ilike(f"%{search}%"))
        )

    # Filter by status
    if status_filter:
        query = query.filter(Tenant.status == status_filter)

    total = query.count()
    tenants = query.offset(skip).limit(limit).all()

    # Build stats for each tenant
    items = []
    for tenant in tenants:
        active_users = (
            db.query(User)
            .filter(User.tenant_id == tenant.id, User.status == "active")
            .count()
        )

        last_activity = (
            db.query(func.max(MasterBudgetLedger.created_at))
            .filter(MasterBudgetLedger.tenant_id == tenant.id)
            .scalar()
        )

        items.append(
            TenantStatsResponse(
                tenant_id=tenant.id,
                tenant_name=tenant.name,
                active_users=active_users,
                master_balance=float(tenant.master_budget_balance),
                last_activity=last_activity,
                status=tenant.status,
            )
        )

    return TenantListResponse(
        items=items, total=total, page=skip // limit, page_size=limit
    )


@router.get("/admin/tenants/{tenant_id}", response_model=TenantResponse)
async def get_tenant_admin(
    tenant_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_platform_admin),
):
    """Get full tenant details for admin panel (Platform Admin only)"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.put("/admin/tenants/{tenant_id}", response_model=TenantResponse)
async def update_tenant_admin(
    tenant_id: UUID,
    tenant_data: TenantUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_platform_admin),
):
    """
    Update tenant properties (Platform Admin only).
    Can update: branding, theme, governance rules, point economy, recognition laws, etc.
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    update_data = tenant_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(tenant, key, value)

    tenant.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(tenant)
    return tenant


@router.post(
    "/admin/tenants/{tenant_id}/inject-points", response_model=TransactionResponse
)
async def inject_tenant_points(
    tenant_id: UUID,
    request: InjectPointsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_platform_admin),
):
    """
    Inject points into a tenant's master budget (Platform Admin only).
    Creates a ledger entry for audit trail.
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    if request.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    # Update balance
    tenant.master_budget_balance += Decimal(str(request.amount))

    # Record transaction
    ledger_entry = MasterBudgetLedger(
        tenant_id=tenant.id,
        transaction_type="credit",
        amount=request.amount,
        balance_after=tenant.master_budget_balance,
        description=request.description,
    )
    db.add(ledger_entry)
    db.commit()
    db.refresh(ledger_entry)

    return TransactionResponse(
        id=ledger_entry.id,
        tenant_id=ledger_entry.tenant_id,
        transaction_type=ledger_entry.transaction_type,
        amount=float(ledger_entry.amount),
        balance_after=float(ledger_entry.balance_after),
        description=ledger_entry.description,
        created_at=ledger_entry.created_at,
    )


@router.post("/admin/tenants/{tenant_id}/suspend", response_model=TenantResponse)
async def suspend_tenant(
    tenant_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_platform_admin),
):
    """Suspend a tenant (temporary lock) (Platform Admin only)"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    if tenant.status == "SUSPENDED":
        raise HTTPException(status_code=400, detail="Tenant is already suspended")

    tenant.status = "SUSPENDED"
    tenant.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(tenant)
    return tenant


@router.post("/admin/tenants/{tenant_id}/resume", response_model=TenantResponse)
async def resume_tenant(
    tenant_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_platform_admin),
):
    """Resume a suspended tenant (Platform Admin only)"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    if tenant.status != "SUSPENDED":
        raise HTTPException(status_code=400, detail="Tenant is not suspended")

    tenant.status = "ACTIVE"
    tenant.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(tenant)
    return tenant


@router.post("/admin/tenants/{tenant_id}/archive", response_model=TenantResponse)
async def archive_tenant(
    tenant_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_platform_admin),
):
    """Archive a tenant (read-only history mode) (Platform Admin only)"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    tenant.status = "ARCHIVED"
    tenant.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(tenant)
    return tenant


@router.get(
    "/admin/tenants/{tenant_id}/transactions", response_model=List[TransactionResponse]
)
async def get_tenant_transactions(
    tenant_id: UUID,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_platform_admin),
):
    """Get master budget ledger for a tenant (Platform Admin only)"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    transactions = (
        db.query(MasterBudgetLedger)
        .filter(MasterBudgetLedger.tenant_id == tenant_id)
        .order_by(MasterBudgetLedger.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return [
        TransactionResponse(
            id=t.id,
            tenant_id=t.tenant_id,
            transaction_type=t.transaction_type,
            amount=float(t.amount),
            balance_after=float(t.balance_after),
            description=t.description or "",
            created_at=t.created_at,
        )
        for t in transactions
    ]


@router.get("/admin/tenants/{tenant_id}/users")
async def get_tenant_admins(
    tenant_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_platform_admin),
):
    """
    Get high-level view of tenant managers (Platform Admin only).
    Returns users with hr_admin or is_super_admin flags.
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    admins = (
        db.query(User)
        .filter(
            User.tenant_id == tenant_id,
            ((User.role == "hr_admin") | (User.is_super_admin == True)),
        )
        .all()
    )

    return [
        {
            "id": str(admin.id),
            "email": admin.email,
            "name": admin.full_name,
            "role": admin.role,
            "is_super_admin": admin.is_super_admin,
            "status": admin.status,
        }
        for admin in admins
    ]


@router.post("/admin/tenants/{tenant_id}/reset-admin-permissions")
async def reset_admin_permissions(
    tenant_id: UUID,
    admin_id: UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_platform_admin),
):
    """Reset a tenant manager's permissions (Platform Admin only)"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    admin = (
        db.query(User).filter(User.id == admin_id, User.tenant_id == tenant_id).first()
    )
    if not admin:
        raise HTTPException(status_code=404, detail="Admin not found")
    # Only allow resetting tenant admins who are HR Admins
    if admin.role != "hr_admin":
        raise HTTPException(
            status_code=403,
            detail="Platform Admins can only reset permissions for tenant HR Admins (role='hr_admin').",
        )

    # Reset to base permissions
    admin.is_super_admin = False
    admin.role = "manager"
    db.commit()
    db.refresh(admin)

    return {"message": f"Permissions reset for {admin.full_name}", "user": admin}


@router.get("/admin/platform/health")
async def get_platform_health(
    db: Session = Depends(get_db), current_user: User = Depends(get_platform_admin)
):
    """
    Get platform-wide health metrics (Root tenant only).
    Returns: total points across all tenants, active tenants, total users, etc.
    """
    total_points = db.query(func.sum(Tenant.master_budget_balance)).scalar() or 0
    active_tenants = db.query(Tenant).filter(Tenant.status == "ACTIVE").count()
    total_tenants = db.query(Tenant).count()
    total_users = db.query(User).count()

    return {
        "total_points": float(total_points),
        "active_tenants": active_tenants,
        "total_tenants": total_tenants,
        "total_users": total_users,
        "timestamp": datetime.utcnow(),
    }


@router.get("/admin/platform/system-admins")
async def list_system_admins(
    db: Session = Depends(get_db), current_user: User = Depends(get_platform_admin)
):
    """
    List all system admins with their status (Root tenant only).
    Can be used to manage SUPER_ADMIN toggle.
    """
    admins = db.query(SystemAdmin).all()

    return [
        {
            "id": str(admin.id),
            "email": admin.email,
            "name": admin.full_name,
            "is_super_admin": admin.is_super_admin,
            "mfa_enabled": admin.mfa_enabled,
            "last_login": admin.last_login_at,
        }
        for admin in admins
    ]


@router.post("/admin/platform/system-admins/{admin_id}/toggle-super-admin")
async def toggle_super_admin_status(
    admin_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_platform_admin),
):
    """Toggle SUPER_ADMIN status for a system admin (Platform Admin only)"""
    admin = db.query(SystemAdmin).filter(SystemAdmin.id == admin_id).first()
    if not admin:
        raise HTTPException(status_code=404, detail="System admin not found")

    admin.is_super_admin = not admin.is_super_admin
    db.commit()
    db.refresh(admin)

    return {
        "id": str(admin.id),
        "email": admin.email,
        "is_super_admin": admin.is_super_admin,
        "message": f"SUPER_ADMIN status updated to {admin.is_super_admin}",
    }


@router.post("/admin/platform/maintenance-mode")
async def set_maintenance_mode(
    enabled: bool = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_platform_admin),
):
    """
    Enable/disable platform-wide read-only maintenance mode (Platform Admin only).
    When enabled, only System Admins can make changes.
    Note: This is a demonstration endpoint. Actual implementation would require middleware.
    """
    return {
        "maintenance_mode_enabled": enabled,
        "message": f"Platform maintenance mode {'enabled' if enabled else 'disabled'}",
        "timestamp": datetime.utcnow(),
    }


@router.post("/{tenant_id}/load-budget", response_model=TenantResponse)
async def load_tenant_budget(
    tenant_id: UUID,
    budget_data: TenantLoadBudget,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_platform_admin),
):
    """Load budget to a tenant (Platform Admin only)"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Update tenant balance
    tenant.master_budget_balance += Decimal(str(budget_data.amount))

    # Record in ledger
    ledger_entry = MasterBudgetLedger(
        tenant_id=tenant.id,
        transaction_type="credit",
        amount=budget_data.amount,
        balance_after=tenant.master_budget_balance,
        description=budget_data.description,
    )
    db.add(ledger_entry)

    db.commit()
    db.refresh(tenant)
    return tenant


# Department endpoints
@router.get("/departments", response_model=List[DepartmentResponse])
async def get_departments(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get all departments for current tenant"""
    departments = (
        db.query(Department)
        .filter(Department.tenant_id == current_user.tenant_id)
        .all()
    )
    return departments


@router.post("/departments", response_model=DepartmentResponse)
async def create_department(
    department_data: DepartmentCreate,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db),
):
    """Create a new department (HR Admin only)"""
    department = Department(
        tenant_id=current_user.tenant_id, **department_data.model_dump()
    )
    db.add(department)
    db.commit()
    db.refresh(department)
    return department


@router.get("/departments/{department_id}", response_model=DepartmentResponse)
async def get_department(
    department_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific department"""
    department = (
        db.query(Department)
        .filter(
            Department.id == department_id,
            Department.tenant_id == current_user.tenant_id,
        )
        .first()
    )
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    return department


@router.put("/departments/{department_id}", response_model=DepartmentResponse)
async def update_department(
    department_id: UUID,
    department_data: DepartmentUpdate,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db),
):
    """Update a department (HR Admin only)"""
    department = (
        db.query(Department)
        .filter(
            Department.id == department_id,
            Department.tenant_id == current_user.tenant_id,
        )
        .first()
    )
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    update_data = department_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(department, key, value)

    db.commit()
    db.refresh(department)
    return department


@router.delete("/departments/{department_id}")
async def delete_department(
    department_id: UUID,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db),
):
    """Delete a department (HR Admin only)"""
    department = (
        db.query(Department)
        .filter(
            Department.id == department_id,
            Department.tenant_id == current_user.tenant_id,
        )
        .first()
    )
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")

    # Check if department has users
    users_count = db.query(User).filter(User.department_id == department_id).count()
    if users_count > 0:
        raise HTTPException(
            status_code=400, detail="Cannot delete department with active users"
        )

    db.delete(department)
    db.commit()
    return {"message": "Department deleted successfully"}
