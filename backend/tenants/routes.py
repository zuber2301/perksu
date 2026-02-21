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
from models import Department, DepartmentBudget, MasterBudgetLedger, Budget, SystemAdmin, Tenant, User, Wallet
from sqlalchemy import func
from sqlalchemy.orm import Session
from tenants.schemas import (
    DepartmentCreate,
    DepartmentResponse,
    DepartmentUpdate,
    DepartmentAllocate,
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


@router.get("/admin/tenants/{tenant_id}/overview-stats")
async def get_tenant_overview_stats(
    tenant_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get aggregated overview stats for a tenant.
    Returns total budget allocated, total spent, budget remaining and user counts by org_role.
    Accessible by users within the tenant or platform admins.
    """
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Allow access to tenant members or platform-level super admins
    if not (
        getattr(current_user, "tenant_id", None) == tenant_id
        or getattr(current_user, "is_super_admin", False)
    ):
        raise HTTPException(status_code=403, detail="Forbidden")

    # Total budget ever allocated by platform admin to this org
    stored_allocated_budget = float(tenant.allocated_budget or 0)

    # Note: total_allocated in the overview usually refers to what's been given to the org
    # whereas Budget sums are internal distributions. We'll use the Org's allocated_budget.
    total_spent = (
        db.query(func.coalesce(func.sum(MasterBudgetLedger.amount), 0))
        .filter(MasterBudgetLedger.tenant_id == tenant_id, MasterBudgetLedger.transaction_type == "debit")
        .scalar()
        or 0
    )

    # User counts by org_role
    role_counts = (
        db.query(User.org_role, func.count(User.id))
        .filter(User.tenant_id == tenant_id)
        .group_by(User.org_role)
        .all()
    )

    counts = {r: c for (r, c) in role_counts}

    return {
        "tenant_id": str(tenant.id),
        "total_budget_allocated": stored_allocated_budget,
        "total_spent": float(total_spent),
        "budget_remaining": float(tenant.master_budget_balance or 0),
        "user_counts": {
            "tenant_manager": counts.get("tenant_manager", 0),
            "lead": counts.get("lead", 0),
            "user": counts.get("user", counts.get("employee", 0)),
            "employee": counts.get("employee", 0),
            "by_org_role": counts,
        },
        "timestamp": datetime.utcnow(),
    }


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
        budget_allocation_balance=tenant_data.initial_balance,
        allocated_budget=tenant_data.initial_balance,
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
        role="hr_admin",  # HR Admin role
        org_role="hr_admin",  # Consolidated to use org_role only
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
async def get_tenant_manager(
    tenant_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_platform_admin),
):
    """Get full tenant details for manager panel (Platform Admin only)"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.put("/admin/tenants/{tenant_id}", response_model=TenantResponse)
async def update_tenant_manager(
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

    # Update balance and tenant allocated budget (the total allocated by platform admin)
    tenant.master_budget_balance = (tenant.master_budget_balance or 0) + Decimal(str(request.amount))
    tenant.budget_allocation_balance = (tenant.budget_allocation_balance or 0) + Decimal(str(request.amount))
    tenant.allocated_budget = (tenant.allocated_budget or 0) + Decimal(str(request.amount))

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
async def get_tenant_managers(
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

    managers = (
        db.query(User)
        .filter(
            User.tenant_id == tenant_id,
            ((User.role == "hr_admin") | (User.is_super_admin == True)),
        )
        .all()
    )

    return [
        {
            "id": str(manager.id),
            "email": manager.email,
            "name": manager.full_name,
            "role": manager.role,
            "is_super_admin": manager.is_super_admin,
            "status": manager.status,
        }
        for manager in managers
    ]


@router.post("/admin/tenants/{tenant_id}/reset-manager-permissions")
async def reset_manager_permissions(
    tenant_id: UUID,
    manager_id: UUID = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_platform_admin),
):
    """Reset a tenant manager's permissions (Platform Admin only)"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    manager = (
        db.query(User).filter(User.id == manager_id, User.tenant_id == tenant_id).first()
    )
    if not manager:
        raise HTTPException(status_code=404, detail="Manager not found")
    # Only allow resetting tenant managers who are HR Admins
    if manager.role != "hr_admin":
        raise HTTPException(
            status_code=403,
            detail="Platform Admins can only reset permissions for tenant HR Admins (role='hr_admin').",
        )

    # Reset to base permissions
    manager.is_super_admin = False
    manager.role = "manager"
    db.commit()
    db.refresh(manager)

    return {"message": f"Permissions reset for {manager.full_name}", "user": manager}


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

    amount_dec = Decimal(str(budget_data.amount))
    # Update tenant balances
    tenant.master_budget_balance = (tenant.master_budget_balance or 0) + amount_dec
    tenant.budget_allocation_balance = (tenant.budget_allocation_balance or 0) + amount_dec
    tenant.allocated_budget = (tenant.allocated_budget or 0) + amount_dec

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


# ------------------ Department Management (Tenant Manager) ------------------
@router.get("/management/departments")
async def get_departments_management(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Return department financial overview for tenant managers or HR admins"""
    # Require tenant-scoped user
    if not getattr(current_user, "tenant_id", None):
        raise HTTPException(status_code=403, detail="Forbidden")

    departments = db.query(Department).filter(Department.tenant_id == current_user.tenant_id).all()

    items = []
    for d in departments:
        dept_budget_balance = (
            db.query(func.coalesce(func.sum(DepartmentBudget.allocated_points - DepartmentBudget.spent_points), 0))
            .filter(DepartmentBudget.department_id == d.id)
            .scalar() or 0
        )

        user_wallet_sum = (
            db.query(func.coalesce(func.sum(Wallet.balance), 0))
            .join(User, User.id == Wallet.user_id)
            .filter(User.department_id == d.id)
            .scalar() or 0
        )

        lead = db.query(User).filter(User.department_id == d.id, User.org_role == "dept_lead").first()
        lead_name = f"{lead.first_name} {lead.last_name}" if lead else None

        items.append({
            "id": str(d.id),
            "name": d.name,
            "lead_name": lead_name,
            "dept_budget_balance": float(dept_budget_balance),
            "user_wallet_sum": float(user_wallet_sum),
            "total_liability": float(dept_budget_balance + user_wallet_sum),
            "employee_count": db.query(func.count(User.id)).filter(User.department_id == d.id).scalar(),
        })

    return items


@router.post("/departments/{department_id}/allocate")
async def allocate_department_budget(
    department_id: UUID,
    allocation_data: DepartmentAllocate,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db),
):
    """Allocate points from tenant master pool to a department's budget pool"""
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    amount_dec = Decimal(str(allocation_data.amount))
    if tenant.master_budget_balance < amount_dec:
        raise HTTPException(
            status_code=400, 
            detail=f"Insufficient tenant balance. Available: {tenant.master_budget_balance}, Requested: {amount_dec}"
        )

    # Find or create the active budget for this tenant
    budget = db.query(Budget).filter(Budget.tenant_id == tenant.id, Budget.status == "active").first()
    if not budget:
        budget = db.query(Budget).filter(Budget.tenant_id == tenant.id).order_by(Budget.created_at.desc()).first()
        if not budget:
            budget = Budget(
                tenant_id=tenant.id,
                name="Main Rewards Pool",
                fiscal_year=datetime.now().year,
                total_points=0,
                status="active"
            )
            db.add(budget)
            db.flush()

    # Find or create department budget entry
    dept_budget = db.query(DepartmentBudget).filter(
        DepartmentBudget.department_id == department_id,
        DepartmentBudget.budget_id == budget.id
    ).first()

    if not dept_budget:
        dept_budget = DepartmentBudget(
            tenant_id=tenant.id,
            budget_id=budget.id,
            department_id=department_id,
            allocated_points=0,
            spent_points=0
        )
        db.add(dept_budget)
        db.flush()

    # Perform movement
    tenant.master_budget_balance -= amount_dec
    tenant.budget_allocation_balance -= amount_dec
    dept_budget.allocated_points += amount_dec
    # Update budget totals
    budget.total_points = Decimal(str(budget.total_points or 0)) + amount_dec
    budget.allocated_points = Decimal(str(budget.allocated_points or 0)) + amount_dec

    db.commit()
    return {"message": f"Successfully allocated {allocation_data.amount} points to department"}


@router.get("/master-pool")
async def get_master_pool(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Return the current tenant's master pool balance (HR Admin / Tenant Manager)"""
    if not getattr(current_user, "tenant_id", None):
        raise HTTPException(status_code=403, detail="Forbidden")

    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Sum up everything already allocated (strategic check)
    current_dept_allocated = (
        db.query(func.coalesce(func.sum(DepartmentBudget.allocated_points), 0))
        .filter(DepartmentBudget.tenant_id == tenant.id)
        .scalar()
        or 0
    )

    # Use budget_allocation_balance as the primary balance for distribution
    # ALSO include remaining points in any 'active' budget that haven't been allocated to departments yet
    master_balance = float(tenant.budget_allocation_balance or tenant.master_budget_balance or 0)
    
    active_budget = db.query(Budget).filter(Budget.tenant_id == tenant.id, Budget.status == "active").first()
    budget_unallocated = float(active_budget.remaining_points) if active_budget else 0
    
    total_available = master_balance + budget_unallocated

    return {
        "balance": total_available,
        "availablePoints": total_available,
        "allocated": float(tenant.allocated_budget or 0),
        "department_allocated_sum": float(current_dept_allocated),
        "available_for_allocation": total_available,
        "master_pool_balance": master_balance,
        "budget_pool_balance": budget_unallocated
    }


# Helper permission for Tenant Admin actions
async def get_tenant_admin(current_user: User = Depends(get_current_user)) -> User:
    if getattr(current_user, "role", None) in ["hr_admin", "platform_admin"]:
        return current_user
    if getattr(current_user, "org_role", None) in ["hr_admin", "platform_admin"]:
        return current_user
    raise HTTPException(status_code=403, detail="Tenant admin access required")


@router.post("/departments/{department_id}/add-points")
async def add_points_to_department(
    department_id: UUID,
    request: InjectPointsRequest,
    current_user: User = Depends(get_tenant_admin),
    db: Session = Depends(get_db),
):
    """Move points into a department budget. Pulls from active budget pool first, then falls back to tenant master pool."""
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    if request.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")

    amount_dec = Decimal(str(request.amount))
    
    # 1. Try to find an active budget that already has unallocated points
    active_budget = (
        db.query(Budget)
        .filter(Budget.tenant_id == tenant.id, Budget.status == "active")
        .order_by(Budget.created_at.desc())
        .first()
    )
    
    budget_unallocated = Decimal(str(active_budget.remaining_points)) if active_budget else Decimal(0)
    
    # 2. Case A: Active budget has enough points. Just move them.
    if active_budget and budget_unallocated >= amount_dec:
        active_budget.allocated_points = Decimal(str(active_budget.allocated_points)) + amount_dec
    
    # 3. Case B: Need to pull from Master Pool (either fully or partially)
    else:
        # Check if master pool has enough
        master_pool = Decimal(str(tenant.budget_allocation_balance or 0))
        if amount_dec > master_pool + budget_unallocated:
             raise HTTPException(
                status_code=400, 
                detail=f"Insufficient points. Total Available: {float(master_pool + budget_unallocated)}"
            )
        
        # Pull what we can from active budget, then rest from master pool
        from_master = amount_dec - budget_unallocated
        
        # Deduct from tenant master pool
        tenant.master_budget_balance = Decimal(str(tenant.master_budget_balance or 0)) - from_master
        tenant.budget_allocation_balance = Decimal(str(tenant.budget_allocation_balance or 0)) - from_master
        
        ledger = MasterBudgetLedger(
            tenant_id=tenant.id,
            transaction_type="debit",
            amount=float(from_master),
            balance_after=tenant.budget_allocation_balance,
            description=f"Allocated to department {department_id} from master pool",
        )
        db.add(ledger)
        
        # If we have an active budget, expand its total_points; Else create one
        if active_budget:
            active_budget.total_points = Decimal(str(active_budget.total_points)) + from_master
            active_budget.allocated_points = Decimal(str(active_budget.allocated_points)) + amount_dec
        else:
            from datetime import datetime
            active_budget = Budget(
                tenant_id=tenant.id,
                name=f"Ad-hoc Allocation {datetime.utcnow().date()}",
                fiscal_year=datetime.utcnow().year,
                total_points=amount_dec,
                allocated_points=amount_dec,
                status="active",
                created_by=current_user.id,
            )
            db.add(active_budget)
            db.flush()

    # 4. Find or create DepartmentBudget entry for this specific Budget + Dept
    dept_budget = (
        db.query(DepartmentBudget)
        .filter(DepartmentBudget.department_id == department_id, DepartmentBudget.budget_id == active_budget.id)
        .first()
    )
    if not dept_budget:
        dept_budget = DepartmentBudget(
            tenant_id=tenant.id,
            budget_id=active_budget.id,
            department_id=department_id,
            allocated_points=amount_dec,
            spent_points=0,
        )
        db.add(dept_budget)
    else:
        dept_budget.allocated_points = Decimal(str(dept_budget.allocated_points or 0)) + amount_dec

    db.commit()

    return {
        "message": f"Successfully allocated {request.amount} points to department",
        "new_dept_balance": float(dept_budget.allocated_points - dept_budget.spent_points)
    }

    updated_dept_balance = (
        db.query(func.coalesce(func.sum(DepartmentBudget.allocated_points - DepartmentBudget.spent_points), 0))
        .filter(DepartmentBudget.department_id == department_id)
        .scalar() or 0
    )

    db.refresh(tenant)

    return {
        "department_id": str(department_id),
        "dept_budget_balance": float(updated_dept_balance),
        "master_balance": float(tenant.master_budget_balance),
    }


@router.post("/departments/{department_id}/assign-lead")
async def assign_department_lead(
    department_id: UUID,
    payload: dict,
    current_user: User = Depends(get_tenant_admin),
    db: Session = Depends(get_db),
):
    """Assign a department lead (Tenant Manager / HR Admin)"""
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id required")

    user = (
        db.query(User)
        .filter(User.id == user_id, User.tenant_id == current_user.tenant_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if str(user.department_id) != str(department_id):
        raise HTTPException(status_code=400, detail="User does not belong to the specified department")

    existing_leads = (
        db.query(User)
        .filter(User.department_id == department_id, User.org_role == "dept_lead")
        .all()
    )
    for l in existing_leads:
        l.org_role = "employee"

    user.org_role = "dept_lead"

    db.commit()

    return {"message": "Lead assigned", "department_id": str(department_id), "lead_id": str(user.id)}
