from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from auth.utils import get_current_user, get_hr_admin, get_platform_admin, get_manager_or_above
from budgets.schemas import (
    BudgetAllocationRequest,
    BudgetCreate,
    BudgetResponse,
    BudgetUpdate,
    DepartmentBudgetResponse,
    EmployeeAllocationRequest,
    LeadAllocationResponse,
    LeadPointAllocationRequest,
)
from fastapi import APIRouter, Depends, HTTPException
from models import (
    AuditLog,
    Budget,
    Tenant,
    DepartmentBudget,
    LeadAllocation,
    User,
    Wallet,
    WalletLedger,
)
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db

router = APIRouter()


@router.get("/", response_model=List[BudgetResponse])
async def get_budgets(
    fiscal_year: int = None,
    status: str = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all budgets for current tenant"""
    query = db.query(Budget).filter(Budget.tenant_id == current_user.tenant_id)

    if fiscal_year:
        query = query.filter(Budget.fiscal_year == fiscal_year)
    if status:
        query = query.filter(Budget.status == status)

    budgets = query.order_by(Budget.fiscal_year.desc(), Budget.created_at.desc()).all()

    # Calculate remaining points manually since it's a computed property
    result = []
    for budget in budgets:
        budget_dict = {
            "id": budget.id,
            "tenant_id": budget.tenant_id,
            "name": budget.name,
            "fiscal_year": budget.fiscal_year,
            "fiscal_quarter": budget.fiscal_quarter,
            "total_points": budget.total_points,
            "allocated_points": budget.allocated_points,
            "remaining_points": Decimal(str(budget.total_points))
            - Decimal(str(budget.allocated_points)),
            "status": budget.status,
            "expiry_date": budget.expiry_date,
            "created_by": budget.created_by,
            "created_at": budget.created_at,
        }
        result.append(budget_dict)

    return result


@router.post("/", response_model=BudgetResponse)
async def create_budget(
    budget_data: BudgetCreate,
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """Create a new budget (Platform Admin only). Ensure tenant-level allocation cap is not exceeded."""
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Check tenant allocation cap
    existing_total = (
        db.query(func.coalesce(func.sum(Budget.total_points), 0))
        .filter(Budget.tenant_id == tenant.id)
        .scalar()
        or 0
    )

    if Decimal(str(existing_total)) + Decimal(str(budget_data.total_points)) > Decimal(
        str(tenant.allocated_budget or 0)
    ):
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient tenant allocated budget. Available: {tenant.allocated_budget or 0}",
        )

    budget = Budget(
        tenant_id=current_user.tenant_id,
        name=budget_data.name,
        fiscal_year=budget_data.fiscal_year,
        fiscal_quarter=budget_data.fiscal_quarter,
        total_points=budget_data.total_points,
        allocated_points=0,
        status="draft",
        expiry_date=budget_data.expiry_date,
        created_by=current_user.id,
    )
    db.add(budget)

    # Audit log (only set actor_id if user exists in users table)
    actor_id = None
    try:
        if hasattr(current_user, "id"):
            existing_actor = db.query(User).filter(User.id == current_user.id).first()
            if existing_actor:
                actor_id = current_user.id
    except Exception:
        actor_id = None

    audit = AuditLog(
        tenant_id=current_user.tenant_id,
        actor_id=actor_id,
        action="budget_created",
        entity_type="budget",
        entity_id=budget.id,
        new_values={"name": budget.name, "total_points": str(budget.total_points)},
    )
    db.add(audit)

    db.commit()
    db.refresh(budget)

    return {
        "id": budget.id,
        "tenant_id": budget.tenant_id,
        "name": budget.name,
        "fiscal_year": budget.fiscal_year,
        "fiscal_quarter": budget.fiscal_quarter,
        "total_points": budget.total_points,
        "allocated_points": budget.allocated_points,
        "remaining_points": Decimal(str(budget.total_points))
        - Decimal(str(budget.allocated_points)),
        "status": budget.status,
        "expiry_date": budget.expiry_date,
        "created_by": budget.created_by,
        "created_at": budget.created_at,
    }


@router.get("/{budget_id}", response_model=BudgetResponse)
async def get_budget(
    budget_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific budget"""
    budget = (
        db.query(Budget)
        .filter(Budget.id == budget_id, Budget.tenant_id == current_user.tenant_id)
        .first()
    )
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    return {
        "id": budget.id,
        "tenant_id": budget.tenant_id,
        "name": budget.name,
        "fiscal_year": budget.fiscal_year,
        "fiscal_quarter": budget.fiscal_quarter,
        "total_points": budget.total_points,
        "allocated_points": budget.allocated_points,
        "remaining_points": Decimal(str(budget.total_points))
        - Decimal(str(budget.allocated_points)),
        "status": budget.status,
        "expiry_date": budget.expiry_date,
        "created_by": budget.created_by,
        "created_at": budget.created_at,
    }


@router.put("/{budget_id}", response_model=BudgetResponse)
async def update_budget(
    budget_id: UUID,
    budget_data: BudgetUpdate,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db),
):
    """Update a budget (HR Admin only)"""
    budget = (
        db.query(Budget)
        .filter(Budget.id == budget_id, Budget.tenant_id == current_user.tenant_id)
        .first()
    )
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    old_values = {
        "name": budget.name,
        "total_points": str(budget.total_points),
        "status": budget.status,
    }

    update_data = budget_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(budget, key, value)

    # Audit log (only set actor_id if user exists in users table)
    actor_id = None
    try:
        if hasattr(current_user, "id"):
            existing_actor = db.query(User).filter(User.id == current_user.id).first()
            if existing_actor:
                actor_id = current_user.id
    except Exception:
        actor_id = None

    audit = AuditLog(
        tenant_id=current_user.tenant_id,
        actor_id=actor_id,
        action="budget_updated",
        entity_type="budget",
        entity_id=budget.id,
        old_values=old_values,
        new_values=update_data,
    )
    db.add(audit)

    db.commit()
    db.refresh(budget)

    return {
        "id": budget.id,
        "tenant_id": budget.tenant_id,
        "name": budget.name,
        "fiscal_year": budget.fiscal_year,
        "fiscal_quarter": budget.fiscal_quarter,
        "total_points": budget.total_points,
        "allocated_points": budget.allocated_points,
        "remaining_points": Decimal(str(budget.total_points))
        - Decimal(str(budget.allocated_points)),
        "status": budget.status,
        "expiry_date": budget.expiry_date,
        "created_by": budget.created_by,
        "created_at": budget.created_at,
    }


@router.post("/{budget_id}/allocate")
async def allocate_budget_to_departments(
    budget_id: UUID,
    allocation_data: BudgetAllocationRequest,
    current_user: User = Depends(get_manager_or_above),
    db: Session = Depends(get_db),
):
    """Allocate budget to departments (Tenant Manager / HR Admin / Manager)"""
    budget = (
        db.query(Budget)
        .filter(Budget.id == budget_id, Budget.tenant_id == current_user.tenant_id)
        .first()
    )
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    # Calculate total allocation
    total_allocation = sum(a.allocated_points for a in allocation_data.allocations)

    # Check if allocation exceeds budget
    current_allocated = (
        db.query(DepartmentBudget)
        .filter(DepartmentBudget.budget_id == budget_id)
        .with_entities(func.coalesce(func.sum(DepartmentBudget.allocated_points), 0))
        .scalar()
    )

    available = Decimal(str(budget.total_points)) - Decimal(str(current_allocated))

    if total_allocation > available:
        raise HTTPException(
            status_code=400,
            detail=f"Allocation ({total_allocation}) exceeds available budget ({available})",
        )

    # Create department budgets
    created = []
    for allocation in allocation_data.allocations:
        # Check if department budget already exists
        existing = (
            db.query(DepartmentBudget)
            .filter(
                DepartmentBudget.budget_id == budget_id,
                DepartmentBudget.department_id == allocation.department_id,
            )
            .first()
        )

        if existing:
            existing.allocated_points = (
                Decimal(str(existing.allocated_points)) + allocation.allocated_points
            )
            if allocation.monthly_cap:
                existing.monthly_cap = allocation.monthly_cap
            created.append(existing)
        else:
            dept_budget = DepartmentBudget(
                tenant_id=current_user.tenant_id,
                budget_id=budget_id,
                department_id=allocation.department_id,
                allocated_points=allocation.allocated_points,
                spent_points=0,
                monthly_cap=allocation.monthly_cap,
            )
            db.add(dept_budget)
            created.append(dept_budget)

    # Update budget allocated points
    budget.allocated_points = Decimal(str(budget.allocated_points)) + total_allocation

    # Audit log (only set actor_id if user exists in users table)
    actor_id = None
    try:
        if hasattr(current_user, "id"):
            existing_actor = db.query(User).filter(User.id == current_user.id).first()
            if existing_actor:
                actor_id = current_user.id
    except Exception:
        actor_id = None

    audit = AuditLog(
        tenant_id=current_user.tenant_id,
        actor_id=actor_id,
        action="budget_allocated",
        entity_type="budget",
        entity_id=budget_id,
        new_values={
            "allocations": [
                {
                    "department_id": str(a.department_id),
                    "points": str(a.allocated_points),
                }
                for a in allocation_data.allocations
            ]
        },
    )
    db.add(audit)

    db.commit()

    return {
        "message": "Budget allocated successfully",
        "total_allocated": str(total_allocation),
    }


@router.get("/{budget_id}/departments", response_model=List[DepartmentBudgetResponse])
async def get_department_budgets(
    budget_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all department budgets for a budget"""
    dept_budgets = (
        db.query(DepartmentBudget)
        .filter(
            DepartmentBudget.budget_id == budget_id,
            DepartmentBudget.tenant_id == current_user.tenant_id,
        )
        .all()
    )

    result = []
    for db_item in dept_budgets:
        result.append(
            {
                "id": db_item.id,
                "tenant_id": db_item.tenant_id,
                "budget_id": db_item.budget_id,
                "department_id": db_item.department_id,
                "allocated_points": db_item.allocated_points,
                "spent_points": db_item.spent_points,
                "remaining_points": Decimal(str(db_item.allocated_points))
                - Decimal(str(db_item.spent_points)),
                "monthly_cap": db_item.monthly_cap,
                "created_at": db_item.created_at,
            }
        )

    return result


@router.post("/{budget_id}/departments/{department_id}/allocate_employee")
async def allocate_to_employee(
    budget_id: UUID,
    department_id: UUID,
    allocation: EmployeeAllocationRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Allocate points from a department budget to a specific employee wallet.

    Allowed for HR Admins / Platform Admins, or the department lead for the target department.
    This updates the DepartmentBudget.spent_points and creates a WalletLedger entry.
    """
    # Permission check: HR/admins can allocate across departments; department leads only for their department
    is_admin = current_user.role in ["hr_admin", "platform_admin"] or current_user.org_role in ["hr_admin", "platform_admin"]
    is_dept_lead = (
        getattr(current_user, "department_id", None) == department_id
        and getattr(current_user, "org_role", None) == "dept_lead"
    )
    if not (is_admin or is_dept_lead):
        raise HTTPException(status_code=403, detail="Permission denied")
    # Ensure department budget exists and belongs to tenant
    dept_budget = (
        db.query(DepartmentBudget)
        .filter(
            DepartmentBudget.budget_id == budget_id,
            DepartmentBudget.department_id == department_id,
            DepartmentBudget.tenant_id == current_user.tenant_id,
        )
        .first()
    )
    if not dept_budget:
        raise HTTPException(status_code=404, detail="Department budget not found")

    # Ensure there are enough remaining points in the department budget
    remaining = Decimal(str(dept_budget.allocated_points)) - Decimal(
        str(dept_budget.spent_points)
    )
    if Decimal(str(allocation.points)) > remaining:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient department budget. Available: {remaining}",
        )

    # Validate target user
    user = (
        db.query(User)
        .filter(User.id == allocation.user_id, User.tenant_id == current_user.tenant_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.department_id != department_id:
        raise HTTPException(
            status_code=400, detail="User does not belong to the specified department"
        )

    # Get or create wallet
    wallet = (
        db.query(Wallet)
        .filter(Wallet.user_id == user.id, Wallet.tenant_id == current_user.tenant_id)
        .first()
    )
    if not wallet:
        wallet = Wallet(
            tenant_id=current_user.tenant_id,
            user_id=user.id,
            balance=0,
            lifetime_earned=0,
            lifetime_spent=0,
        )
        db.add(wallet)
        db.flush()  # ensure wallet.id is available

    # Credit wallet
    old_balance = Decimal(str(wallet.balance))
    wallet.balance = old_balance + Decimal(str(allocation.points))
    wallet.lifetime_earned = Decimal(str(wallet.lifetime_earned)) + Decimal(
        str(allocation.points)
    )

    # Create ledger entry
    ledger = WalletLedger(
        tenant_id=current_user.tenant_id,
        wallet_id=wallet.id,
        transaction_type="credit",
        source="hr_allocation",
        points=allocation.points,
        balance_after=wallet.balance,
        description=f"HR allocation from dept {department_id}",
        created_by=current_user.id,
    )
    db.add(ledger)

    # Update department budget spent points
    dept_budget.spent_points = Decimal(str(dept_budget.spent_points)) + Decimal(
        str(allocation.points)
    )

    # Audit (only set actor_id if user exists in users table)
    actor_id = None
    try:
        if hasattr(current_user, "id"):
            existing_actor = db.query(User).filter(User.id == current_user.id).first()
            if existing_actor:
                actor_id = current_user.id
    except Exception:
        actor_id = None

    audit = AuditLog(
        tenant_id=current_user.tenant_id,
        actor_id=actor_id,
        action="department_employee_allocation",
        entity_type="department_budget",
        entity_id=dept_budget.id,
        old_values={
            "spent_points": str(
                Decimal(str(dept_budget.spent_points)) - Decimal(str(allocation.points))
            )
        },
        new_values={
            "spent_points": str(dept_budget.spent_points),
            "user_id": str(user.id),
            "points": str(allocation.points),
        },
    )
    db.add(audit)

    db.commit()
    db.refresh(wallet)

    return {
        "wallet_id": wallet.id,
        "user_id": user.id,
        "points_allocated": allocation.points,
        "new_balance": wallet.balance,
        "created_at": ledger.created_at,
    }


@router.put("/{budget_id}/activate")
async def activate_budget(
    budget_id: UUID,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db),
):
    """Activate a budget (HR Admin only)"""
    budget = (
        db.query(Budget)
        .filter(Budget.id == budget_id, Budget.tenant_id == current_user.tenant_id)
        .first()
    )
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    if budget.status != "draft":
        raise HTTPException(
            status_code=400, detail="Only draft budgets can be activated"
        )

    budget.status = "active"

    # Audit log (only set actor_id if user exists in users table)
    actor_id = None
    try:
        if hasattr(current_user, "id"):
            existing_actor = db.query(User).filter(User.id == current_user.id).first()
            if existing_actor:
                actor_id = current_user.id
    except Exception:
        actor_id = None

    audit = AuditLog(
        tenant_id=current_user.tenant_id,
        actor_id=actor_id,
        action="budget_activated",
        entity_type="budget",
        entity_id=budget_id,
    )
    db.add(audit)

    db.commit()

    return {"message": "Budget activated successfully"}


@router.get("/leads/all", response_model=List[LeadAllocationResponse])
async def get_all_lead_allocations(
    budget_id: Optional[UUID] = None,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db),
):
    """Get all lead point allocations (HR Admin only)"""
    query = db.query(LeadAllocation).filter(
        LeadAllocation.tenant_id == current_user.tenant_id
    )
    if budget_id:
        query = query.filter(LeadAllocation.budget_id == budget_id)

    allocations = query.all()
    return allocations


@router.post("/leads/allocate")
async def allocate_points_to_lead(
    allocation_data: LeadPointAllocationRequest,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db),
):
    """Allocate points to a specific Lead (HR Admin only)"""
    budget = (
        db.query(Budget)
        .filter(
            Budget.id == allocation_data.budget_id,
            Budget.tenant_id == current_user.tenant_id,
        )
        .first()
    )
    if not budget:
        raise HTTPException(status_code=404, detail="Budget not found")

    # Check if budget has enough remaining points
    if budget.remaining_points < float(allocation_data.points):
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient budget. Available: {budget.remaining_points}",
        )

    # Create or update lead allocation
    lead_alloc = (
        db.query(LeadAllocation)
        .filter(
            LeadAllocation.budget_id == allocation_data.budget_id,
            LeadAllocation.lead_id == allocation_data.lead_id,
        )
        .first()
    )

    if lead_alloc:
        lead_alloc.allocated_points = (
            Decimal(str(lead_alloc.allocated_points)) + allocation_data.points
        )
    else:
        lead_alloc = LeadAllocation(
            tenant_id=current_user.tenant_id,
            budget_id=allocation_data.budget_id,
            lead_id=allocation_data.lead_id,
            allocated_points=allocation_data.points,
            spent_points=0,
        )
        db.add(lead_alloc)

    # Update budget allocated points
    budget.allocated_points = (
        Decimal(str(budget.allocated_points)) + allocation_data.points
    )

    # Audit log
    audit = AuditLog(
        tenant_id=current_user.tenant_id,
        actor_id=current_user.id,
        action="lead_points_allocated",
        entity_type="lead_allocation",
        entity_id=lead_alloc.id,
        new_values={
            "lead_id": str(allocation_data.lead_id),
            "points": str(allocation_data.points),
        },
    )
    db.add(audit)

    db.commit()
    db.refresh(lead_alloc)

    return {
        "message": "Points allocated to lead successfully",
        "total_allocated": str(lead_alloc.allocated_points),
    }
