"""
Pydantic schemas for points allocation and distribution endpoints
"""

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field


class AllocationRequest(BaseModel):
    """Request to allocate points to a tenant"""

    tenant_id: UUID
    amount: Decimal = Field(gt=0, description="Amount of points to allocate")
    currency: str = Field(default="INR", description="Currency code (ISO 4217)")
    reference_note: Optional[str] = Field(
        None, description="Reference note for audit (e.g., Invoice #)"
    )


class AllocationResponse(BaseModel):
    """Response from point allocation"""

    success: bool
    tenant_id: str
    amount_allocated: str
    new_allocation_balance: str
    currency: str
    allocation_log_id: str
    platform_log_id: str


class DelegationRequest(BaseModel):
    """Request to delegate points to a lead"""

    lead_id: UUID
    amount: Decimal = Field(gt=0, description="Amount of points to delegate")
    delegation_note: Optional[str] = Field(None, description="Note for audit trail")


class DelegationResponse(BaseModel):
    """Response from point delegation"""

    success: bool
    tenant_id: str
    lead_id: str
    amount_delegated: str
    lead_new_balance: str
    tenant_remaining_balance: str
    note: Optional[str]


class AwardRequest(BaseModel):
    """Request to award points to a user"""

    to_user_id: UUID
    amount: Decimal = Field(gt=0, description="Amount of points to award")
    recognition_message: str = Field(
        ..., description="Message describing why points are being awarded"
    )
    recognition_id: Optional[UUID] = Field(
        None, description="Optional link to recognition record"
    )


class AwardResponse(BaseModel):
    """Response from point award"""

    success: bool
    tenant_id: str
    to_user_id: str
    amount_awarded: str
    recipient_new_wallet_balance: str
    tenant_remaining_pool: str
    ledger_entry_id: str


class ClawbackRequest(BaseModel):
    """Request to clawback allocation from tenant"""

    reason: Optional[str] = Field(None, description="Reason for clawback")


class ClawbackResponse(BaseModel):
    """Response from clawback operation"""

    success: bool
    tenant_id: str
    amount_clawed_back: str
    new_balance: str
    platform_log_id: str
    reason: Optional[str]


class TenantAllocationStatsResponse(BaseModel):
    """Tenant allocation statistics for manager dashboard"""

    tenant_id: str
    tenant_name: str
    budget_allocation_balance: str
    currency: str
    currency_label: str
    status: str
    message: str = Field(
        ..., description="User-friendly message about allocation status"
    )


class AllocationLogResponse(BaseModel):
    """Log entry for point allocation"""

    id: UUID
    tenant_id: UUID
    allocated_by: UUID
    amount: Decimal
    currency: str
    reference_note: Optional[str]
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class PlatformBillingLogResponse(BaseModel):
    """Platform-level billing log entry"""

    id: UUID
    admin_id: UUID
    tenant_id: UUID
    amount: Decimal
    currency: str
    reference_note: Optional[str]
    transaction_type: str
    created_at: datetime

    class Config:
        from_attributes = True
