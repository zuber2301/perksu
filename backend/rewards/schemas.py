"""Schemas for the unified rewards catalog + redemption engine."""

from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, field_validator


# ─────────────────────────────────────────────────
# Catalog Browsing
# ─────────────────────────────────────────────────


class CatalogItemResponse(BaseModel):
    id: UUID
    source_type: Literal["MASTER", "CUSTOM"]
    name: str
    brand: Optional[str] = None
    category: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    fulfillment_type: str                # GIFT_CARD_API | INVENTORY_ITEM | MANUAL
    
    # Points (Single for custom, Range for master)
    points_cost: Optional[int] = None    # Set for CUSTOM items
    min_points: Optional[int] = None     # Set for MASTER items
    max_points: Optional[int] = None
    step_points: Optional[int] = None
    points_per_rupee: Optional[int] = None
    denominations: List[int] = []        # Pre-computed list for MASTER range
    
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
    # Optional delivery address
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
# Wallet summary
# ─────────────────────────────────────────────────


class WalletSummary(BaseModel):
    balance: int
    lifetime_earned: int
    lifetime_spent: int


# ─────────────────────────────────────────────────
# Admin management
# ─────────────────────────────────────────────────


class MasterCatalogItemCreate(BaseModel):
    name: str
    brand: Optional[str] = None
    category: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    fulfillment_type: str = "GIFT_CARD_API"
    provider_code: Optional[str] = None
    min_points: int = 500
    max_points: int = 10000
    step_points: int = 500
    points_per_rupee: int = 1
    is_active_global: bool = True


class TenantCatalogSettingUpdate(BaseModel):
    is_enabled: bool
    custom_min_points: Optional[int] = None
    custom_max_points: Optional[int] = None
    custom_step_points: Optional[int] = None


class CustomCatalogItemCreate(BaseModel):
    name: str
    brand: Optional[str] = None
    category: str = "Merchandise"
    description: Optional[str] = None
    image_url: Optional[str] = None
    fulfillment_type: Literal["INVENTORY_ITEM", "MANUAL"] = "INVENTORY_ITEM"
    points_cost: int
    inventory_count: Optional[int] = None
    is_active: bool = True
