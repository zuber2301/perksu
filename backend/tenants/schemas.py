from pydantic import BaseModel
from typing import Optional, Dict, Any
from uuid import UUID
from datetime import datetime


class TenantBase(BaseModel):
    name: str
    slug: str


class TenantCreate(TenantBase):
    pass


class TenantProvisionCreate(TenantBase):
    admin_email: str
    admin_password: str
    admin_first_name: str
    admin_last_name: str
    initial_balance: float = 0.0
    subscription_tier: str = "basic"
    branding_config: Optional[Dict[str, Any]] = None


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    branding_config: Optional[Dict[str, Any]] = None
    subscription_tier: Optional[str] = None
    status: Optional[str] = None


class TenantResponse(TenantBase):
    id: UUID
    branding_config: Dict[str, Any]
    subscription_tier: str
    master_budget_balance: float
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DepartmentBase(BaseModel):
    name: str
    parent_id: Optional[UUID] = None


class DepartmentCreate(DepartmentBase):
    pass


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[UUID] = None


class DepartmentResponse(DepartmentBase):
    id: UUID
    tenant_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True
