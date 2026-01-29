from pydantic import BaseModel
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal


class BudgetBase(BaseModel):
    name: str
    fiscal_year: int
    fiscal_quarter: Optional[int] = None
    total_points: Decimal
    expiry_date: Optional[datetime] = None


class BudgetCreate(BudgetBase):
    pass


class BudgetUpdate(BaseModel):
    name: Optional[str] = None
    total_points: Optional[Decimal] = None
    status: Optional[str] = None
    expiry_date: Optional[datetime] = None


class BudgetResponse(BudgetBase):
    id: UUID
    tenant_id: UUID
    allocated_points: Decimal
    remaining_points: Decimal
    status: str
    created_by: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


class DepartmentBudgetBase(BaseModel):
    department_id: UUID
    allocated_points: Decimal
    monthly_cap: Optional[Decimal] = None


class DepartmentBudgetCreate(DepartmentBudgetBase):
    pass


class DepartmentBudgetUpdate(BaseModel):
    allocated_points: Optional[Decimal] = None
    monthly_cap: Optional[Decimal] = None


class DepartmentBudgetResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    budget_id: UUID
    department_id: UUID
    allocated_points: Decimal
    spent_points: Decimal
    remaining_points: Decimal
    monthly_cap: Optional[Decimal] = None
    created_at: datetime

    class Config:
        from_attributes = True


class BudgetAllocationRequest(BaseModel):
    allocations: List[DepartmentBudgetCreate]


class LeadAllocationBase(BaseModel):
    lead_id: UUID
    allocated_points: Decimal


class LeadAllocationCreate(LeadAllocationBase):
    budget_id: UUID


class LeadAllocationResponse(LeadAllocationBase):
    id: UUID
    tenant_id: UUID
    budget_id: UUID
    spent_points: Decimal
    remaining_points: Decimal
    usage_percentage: float
    created_at: datetime

    class Config:
        from_attributes = True


class LeadPointAllocationRequest(BaseModel):
    lead_id: UUID
    budget_id: UUID
    points: Decimal
