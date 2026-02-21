from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class BudgetBase(BaseModel):
    name: str
    fiscal_year: int
    fiscal_quarter: Optional[int] = None
    total_points: int
    expiry_date: Optional[datetime] = None


class BudgetCreate(BudgetBase):
    pass


class BudgetUpdate(BaseModel):
    name: Optional[str] = None
    total_points: Optional[int] = None
    status: Optional[str] = None
    expiry_date: Optional[datetime] = None


class BudgetResponse(BudgetBase):
    id: UUID
    tenant_id: UUID
    allocated_points: int
    remaining_points: int
    status: str
    created_by: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DepartmentBudgetBase(BaseModel):
    department_id: UUID
    allocated_points: int
    monthly_cap: Optional[int] = None


class DepartmentBudgetCreate(DepartmentBudgetBase):
    pass


class DepartmentBudgetUpdate(BaseModel):
    allocated_points: Optional[int] = None
    monthly_cap: Optional[int] = None


class DepartmentBudgetResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    budget_id: UUID
    department_id: UUID
    allocated_points: int
    spent_points: int
    remaining_points: int
    monthly_cap: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BudgetAllocationRequest(BaseModel):
    allocations: List[DepartmentBudgetCreate]


class LeadAllocationBase(BaseModel):
    lead_id: UUID
    allocated_points: int


class LeadAllocationCreate(LeadAllocationBase):
    budget_id: UUID


class LeadAllocationResponse(LeadAllocationBase):
    id: UUID
    tenant_id: UUID
    budget_id: UUID
    spent_points: int
    remaining_points: int
    usage_percentage: float
    created_at: datetime

    class Config:
        from_attributes = True


class LeadPointAllocationRequest(BaseModel):
    lead_id: UUID
    budget_id: UUID
    points: int


class EmployeeAllocationRequest(BaseModel):
    user_id: UUID
    points: int


class EmployeeAllocationResponse(BaseModel):
    wallet_id: UUID
    user_id: UUID
    points_allocated: int
    new_balance: int
    created_at: datetime

    class Config:
        from_attributes = True


# ── New Distribution Workflow Schemas ─────────────────────────────────────────

class PerEmployeeDeptDistributionRequest(BaseModel):
    """Distribute budget to departments based on headcount × points_per_user.
    If department_ids is None or empty, all departments in the tenant are targeted.
    Only accessible by hr_admin / tenant_manager.
    """
    points_per_user: int  # points to grant per employee in each department
    department_ids: Optional[List[UUID]] = None  # None / [] = all departments


class DeptDistributionPreviewItem(BaseModel):
    department_id: UUID
    department_name: str
    employee_count: int
    points_to_allocate: int


class PerEmployeeDeptDistributionResponse(BaseModel):
    total_points_allocated: int
    departments_updated: int
    breakdown: List[DeptDistributionPreviewItem]
    master_pool_remaining: int


class BulkUserDistributionRequest(BaseModel):
    """Credit every active user in the tenant with points_per_user.
    Only accessible by hr_admin / tenant_manager.
    """
    points_per_user: int  # points to credit to each active user's wallet
    description: Optional[str] = "Bulk distribution by HR Admin"


class BulkUserDistributionResponse(BaseModel):
    total_users_credited: int
    total_points_distributed: int
    master_pool_remaining: int
