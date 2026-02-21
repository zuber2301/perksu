"""Schemas for the unified rewards catalog + redemption engine."""

from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, field_validator


# ─────────────────────────────────────────────────
# Catalog
# ─────────────────────────────────────────────────


class CatalogItemResponse(BaseModel):
    id: UUID
    name: str
    brand: Optional[str] = None
    category: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    fulfillment_type: str                # GIFT_CARD_API | INVENTORY_ITEM | MANUAL
    min_denomination_points: int
    max_denomination_points: int
    step_points: int
    denominations: List[int]             # pre-computed list sent to frontend
    inventory_count: Optional[int] = None
    is_active: bool
    tenant_id: Optional[UUID] = None

    model_config = {"from_attributes": True}


class CatalogListResponse(BaseModel):
    items: List[CatalogItemResponse]
    total: int
    categories: List[str]


# ─────────────────────────────────────────────────
# Redeem request / response
# ─────────────────────────────────────────────────


class RedeemRequest(BaseModel):
    catalog_item_id: UUID
    points: int
    # Optional delivery address (required for INVENTORY_ITEM)
    delivery_name: Optional[str] = None
    delivery_phone: Optional[str] = None
    delivery_address: Optional[str] = None
    delivery_city: Optional[str] = None
    delivery_state: Optional[str] = None
    delivery_pincode: Optional[str] = None

    @field_validator("points")
    @classmethod
    def points_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("points must be positive")
        return v


class RedeemResponse(BaseModel):
    status: str              # PENDING | FULFILLED | FAILED
    redemption_id: UUID
    message: str
    item_name: str
    points_spent: int
    wallet_balance_after: int


# ─────────────────────────────────────────────────
# Order history
# ─────────────────────────────────────────────────


class RewardOrderItem(BaseModel):
    id: UUID
    item_name: str
    item_type: str
    category: Optional[str] = None
    image_url: Optional[str] = None
    points_spent: int
    status: str
    voucher_code: Optional[str] = None
    redeem_url: Optional[str] = None
    tracking_number: Optional[str] = None
    failed_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RewardOrderListResponse(BaseModel):
    items: List[RewardOrderItem]
    total: int
    page: int
    page_size: int
    total_pages: int


# ─────────────────────────────────────────────────
# Wallet summary (tight view for the Redeem page)
# ─────────────────────────────────────────────────


class WalletSummary(BaseModel):
    balance: int
    lifetime_earned: int
    lifetime_spent: int


# ─────────────────────────────────────────────────
# Admin catalog management
# ─────────────────────────────────────────────────


class CatalogItemCreate(BaseModel):
    name: str
    brand: Optional[str] = None
    category: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    fulfillment_type: Literal["GIFT_CARD_API", "INVENTORY_ITEM", "MANUAL"] = "GIFT_CARD_API"
    provider_code: Optional[str] = None
    min_denomination_points: int = 500
    max_denomination_points: int = 5000
    step_points: int = 500
    inventory_count: Optional[int] = None
    is_active: bool = True


class CatalogItemUpdate(BaseModel):
    name: Optional[str] = None
    brand: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    fulfillment_type: Optional[Literal["GIFT_CARD_API", "INVENTORY_ITEM", "MANUAL"]] = None
    provider_code: Optional[str] = None
    min_denomination_points: Optional[int] = None
    max_denomination_points: Optional[int] = None
    step_points: Optional[int] = None
    inventory_count: Optional[int] = None
    is_active: Optional[bool] = None
