"""Redemption System Schemas"""

from datetime import datetime
from decimal import Decimal
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, field_validator

# =====================================================
# VOUCHER CATALOG SCHEMAS
# =====================================================


class VoucherCatalogBase(BaseModel):
    vendor_name: str  # Amazon, Swiggy, Zomato, Movies
    vendor_code: str
    voucher_denomination: int  # Amount in INR
    point_cost: int
    markup_percentage: Decimal = Decimal("0.0")
    api_partner: Optional[str] = None  # Xoxoday, EGifting
    status: Literal["active", "inactive", "soldout"] = "active"


class VoucherCatalogCreate(VoucherCatalogBase):
    image_url: Optional[str] = None


class VoucherCatalogUpdate(BaseModel):
    vendor_name: Optional[str] = None
    point_cost: Optional[int] = None
    markup_percentage: Optional[Decimal] = None
    status: Optional[Literal["active", "inactive", "soldout"]] = None
    image_url: Optional[str] = None
    vendor_balance: Optional[Decimal] = None


class VoucherCatalogResponse(VoucherCatalogBase):
    id: UUID
    tenant_id: UUID
    image_url: Optional[str] = None
    vendor_balance: Decimal = Decimal("0.0")
    last_synced_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DynamicRewardResponse(BaseModel):
    utid: str
    rewardName: str
    brandName: str
    value: float
    currencyCode: str
    pointsRequired: float
    imageUrl: Optional[str] = None
    category: Optional[str] = None


# =====================================================
# MERCHANDISE CATALOG SCHEMAS
# =====================================================


class MerchandiseCatalogBase(BaseModel):
    name: str
    category: Literal["apparel", "tech", "accessories", "wellness", "home", "other"]
    point_cost: int
    markup_percentage: Decimal = Decimal("0.0")
    stock_quantity: int = 0
    status: Literal["active", "inactive", "discontinued"] = "active"


class MerchandiseCatalogCreate(MerchandiseCatalogBase):
    description: Optional[str] = None
    image_url: Optional[str] = None


class MerchandiseCatalogUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    point_cost: Optional[int] = None
    markup_percentage: Optional[Decimal] = None
    stock_quantity: Optional[int] = None
    status: Optional[Literal["active", "inactive", "discontinued"]] = None
    image_url: Optional[str] = None


class MerchandiseCatalogResponse(MerchandiseCatalogBase):
    id: UUID
    tenant_id: UUID
    description: Optional[str] = None
    image_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# =====================================================
# REDEMPTION SCHEMAS
# =====================================================


class RedemptionInitiate(BaseModel):
    """Initial redemption request"""

    item_type: Literal["VOUCHER", "MERCH"]
    item_id: Optional[UUID] = None
    utid: Optional[str] = None
    item_name: str
    point_cost: int
    actual_cost: Decimal
    delivery_details: Optional[dict] = None


class RedemptionOTPVerify(BaseModel):
    """OTP verification for redemption"""

    redemption_id: UUID
    otp_code: str


class RedemptionDeliveryDetails(BaseModel):
    """Delivery details for redemption"""

    # For vouchers
    voucher_code: Optional[str] = None
    voucher_url: Optional[str] = None

    # For merchandise
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    address_line_1: Optional[str] = None
    address_line_2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    pincode: Optional[str] = None
    country: str = "India"


class RedemptionResponse(BaseModel):
    id: UUID
    user_id: UUID
    tenant_id: UUID
    item_type: Literal["VOUCHER", "MERCH"]
    item_name: str
    point_cost: int
    actual_cost: Decimal
    markup_amount: Decimal
    status: str  # PENDING, OTP_VERIFIED, PROCESSING, COMPLETED, SHIPPED, FAILED
    voucher_code: Optional[str] = None
    tracking_number: Optional[str] = None
    failed_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RedemptionHistoryResponse(BaseModel):
    """Redemption history for user"""

    id: UUID
    item_name: str
    item_type: str
    point_cost: int
    status: str
    created_at: datetime
    voucher_code: Optional[str] = None
    tracking_number: Optional[str] = None

    class Config:
        from_attributes = True


class RedemptionListResponse(BaseModel):
    """List of redemptions with pagination"""

    items: list[RedemptionHistoryResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# =====================================================
# ADMIN SCHEMAS
# =====================================================


class RedemptionRequestAdmin(BaseModel):
    """Admin view of redemption request"""

    id: UUID
    user_email: str
    user_name: str
    item_name: str
    status: str
    delivery_details: dict
    created_at: datetime
    processed_at: Optional[datetime] = None


class RedemptionRequestUpdate(BaseModel):
    """Update redemption request (mark as shipped, add tracking)"""

    status: Literal["PROCESSING", "SHIPPED", "COMPLETED", "FAILED"]
    tracking_number: Optional[str] = None
    failed_reason: Optional[str] = None


class VendorBalanceResponse(BaseModel):
    """Vendor balance monitor for admins"""

    vendor_name: str
    api_partner: str
    current_balance: Decimal
    last_synced_at: Optional[datetime] = None
    total_redeemed: int = 0
    total_spent: Decimal = Decimal("0.0")


class RedemptionAnalytics(BaseModel):
    """Analytics for redemption dashboard"""

    total_redemptions: int
    total_points_redeemed: int
    total_revenue: Decimal
    pending_requests: int
    fulfilled_orders: int
    top_items: list[tuple[str, int]] = []  # (item_name, count)


class MarkupManagementUpdate(BaseModel):
    """Update markup/convenience fees"""

    item_type: Literal["VOUCHER", "MERCH"]
    item_id: UUID
    markup_percentage: Decimal

    @field_validator("markup_percentage")
    @classmethod
    def validate_markup(cls, v):
        if v < Decimal("0") or v > Decimal("100"):
            raise ValueError("Markup percentage must be between 0 and 100")
        return v

    status: str
    provider_reference: Optional[str] = None
    fulfilled_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RedemptionDetailResponse(RedemptionResponse):
    voucher_name: str
    brand_name: str
    denomination: Decimal
