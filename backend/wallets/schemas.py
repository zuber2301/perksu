from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel


class WalletResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    user_id: UUID
    balance: Decimal
    lifetime_earned: Decimal
    lifetime_spent: Decimal
    created_at: datetime

    class Config:
        from_attributes = True


class WalletLedgerResponse(BaseModel):
    id: UUID
    wallet_id: UUID
    transaction_type: str
    source: str
    points: Decimal
    balance_after: Decimal
    reference_type: Optional[str] = None
    reference_id: Optional[UUID] = None
    description: Optional[str] = None
    created_by: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PointsAllocationRequest(BaseModel):
    user_id: UUID
    points: Decimal
    description: Optional[str] = None


class BulkPointsAllocationRequest(BaseModel):
    allocations: List[PointsAllocationRequest]


class PointsAdjustmentRequest(BaseModel):
    points: Decimal
    adjustment_type: str  # credit or debit
    reason: str
