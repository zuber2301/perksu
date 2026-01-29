from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
from decimal import Decimal

from database import get_db
from models import Tenant, Department, User, MasterBudgetLedger, Wallet
from auth.utils import get_current_user, get_hr_admin, get_platform_admin, get_password_hash
from tenants.schemas import (
    TenantCreate, TenantUpdate, TenantResponse, TenantProvisionCreate,
    DepartmentCreate, DepartmentUpdate, DepartmentResponse, TenantLoadBudget
)

router = APIRouter()


@router.get("/current", response_model=TenantResponse)
async def get_current_tenant(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the current user's tenant"""
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


@router.post("/", response_model=TenantResponse)
async def create_tenant(
    tenant_data: TenantProvisionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_platform_admin)
):
    """Provision a new tenant (Platform Admin only)"""
    # 1. Create Tenant
    tenant = Tenant(
        name=tenant_data.name,
        slug=tenant_data.slug,
        branding_config=tenant_data.branding_config or {},
        subscription_tier=tenant_data.subscription_tier,
        master_budget_balance=tenant_data.initial_balance,
        status='ACTIVE'
    )
    db.add(tenant)
    db.flush()

    # 2. Initialize Master Budget Ledger
    ledger_entry = MasterBudgetLedger(
        tenant_id=tenant.id,
        transaction_type='credit',
        amount=tenant_data.initial_balance,
        balance_after=tenant_data.initial_balance,
        description="Initial provisioning balance"
    )
    db.add(ledger_entry)

    # 3. Create Tenant Admin User
    admin_user = User(
        tenant_id=tenant.id,
        email=tenant_data.admin_email,
        password_hash=get_password_hash(tenant_data.admin_password),
        first_name=tenant_data.admin_first_name,
        last_name=tenant_data.admin_last_name,
        role='hr_admin', # Usually HR Admin is the tenant admin
        is_super_admin=True,
        status='active'
    )
    db.add(admin_user)
    db.flush()

    # Create wallet for admin
    admin_wallet = Wallet(
        tenant_id=tenant.id,
        user_id=admin_user.id,
        balance=0,
        lifetime_earned=0,
        lifetime_spent=0
    )
    db.add(admin_wallet)

    db.commit()
    db.refresh(tenant)
    return tenant


@router.put("/current", response_model=TenantResponse)
async def update_current_tenant(
    tenant_data: TenantUpdate,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
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


@router.get("/", response_model=List[TenantResponse])
async def list_tenants(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_platform_admin)
):
    """List all tenants (Platform Admin only)"""
    return db.query(Tenant).all()


@router.get("/{tenant_id}", response_model=TenantResponse)
async def get_tenant(
    tenant_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_platform_admin)
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
    current_user: User = Depends(get_platform_admin)
):
    """Toggle tenant active/inactive status (Platform Admin only)"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    
    tenant.status = 'INACTIVE' if tenant.status == 'ACTIVE' else 'ACTIVE'
    db.commit()
    db.refresh(tenant)
    return tenant


@router.post("/{tenant_id}/load-budget", response_model=TenantResponse)
async def load_tenant_budget(
    tenant_id: UUID,
    budget_data: TenantLoadBudget,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_platform_admin)
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
        transaction_type='credit',
        amount=budget_data.amount,
        balance_after=tenant.master_budget_balance,
        description=budget_data.description
    )
    db.add(ledger_entry)
    
    db.commit()
    db.refresh(tenant)
    return tenant


# Department endpoints
@router.get("/departments", response_model=List[DepartmentResponse])
async def get_departments(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all departments for current tenant"""
    departments = db.query(Department).filter(
        Department.tenant_id == current_user.tenant_id
    ).all()
    return departments


@router.post("/departments", response_model=DepartmentResponse)
async def create_department(
    department_data: DepartmentCreate,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    """Create a new department (HR Admin only)"""
    department = Department(
        tenant_id=current_user.tenant_id,
        **department_data.model_dump()
    )
    db.add(department)
    db.commit()
    db.refresh(department)
    return department


@router.get("/departments/{department_id}", response_model=DepartmentResponse)
async def get_department(
    department_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific department"""
    department = db.query(Department).filter(
        Department.id == department_id,
        Department.tenant_id == current_user.tenant_id
    ).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    return department


@router.put("/departments/{department_id}", response_model=DepartmentResponse)
async def update_department(
    department_id: UUID,
    department_data: DepartmentUpdate,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    """Update a department (HR Admin only)"""
    department = db.query(Department).filter(
        Department.id == department_id,
        Department.tenant_id == current_user.tenant_id
    ).first()
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
    db: Session = Depends(get_db)
):
    """Delete a department (HR Admin only)"""
    department = db.query(Department).filter(
        Department.id == department_id,
        Department.tenant_id == current_user.tenant_id
    ).first()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found")
    
    # Check if department has users
    users_count = db.query(User).filter(User.department_id == department_id).count()
    if users_count > 0:
        raise HTTPException(
            status_code=400,
            detail="Cannot delete department with active users"
        )
    
    db.delete(department)
    db.commit()
    return {"message": "Department deleted successfully"}
