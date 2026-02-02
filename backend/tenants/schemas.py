from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from uuid import UUID
from datetime import datetime


# ==================== Identity & Branding Schemas ====================
class ThemeConfig(BaseModel):
    primary_color: str = "#007bff"
    secondary_color: str = "#6c757d"
    font_family: str = "system-ui"


class BrandingConfig(BaseModel):
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    theme_config: Optional[ThemeConfig] = None


# ==================== Governance & Security Schemas ====================
class GovernanceConfig(BaseModel):
    domain_whitelist: List[str] = Field(default_factory=list, description="Email domain suffixes, e.g., ['@company.com']")
    auth_method: str = "OTP_ONLY"  # OTP_ONLY, PASSWORD_AND_OTP, SSO_SAML


# ==================== Point Economy Schemas ====================
class PointEconomyConfig(BaseModel):
    currency_label: str = "Points"
    conversion_rate: float = 1.0  # $1 = X Points
    auto_refill_threshold: float = 20.0  # Percentage


class AwardTiers(BaseModel):
    Gold: Optional[float] = 5000
    Silver: Optional[float] = 2500
    Bronze: Optional[float] = 1000


class RecognitionRules(BaseModel):
    award_tiers: Dict[str, float] = Field(default_factory=lambda: {"Gold": 5000, "Silver": 2500, "Bronze": 1000})
    peer_to_peer_enabled: bool = True
    expiry_policy: str = "never"  # 90_days, 180_days, 1_year, never


# ==================== Core Tenant Schemas ====================
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


class TenantLoadBudget(BaseModel):
    amount: float
    description: Optional[str] = "Manual budget load"


class TenantUpdate(BaseModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    
    # Identity & Branding
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    theme_config: Optional[ThemeConfig] = None
    branding_config: Optional[Dict[str, Any]] = None
    
    # Governance & Security
    domain_whitelist: Optional[List[str]] = None
    auth_method: Optional[str] = None
    
    # Point Economy
    currency_label: Optional[str] = None
    conversion_rate: Optional[float] = None
    auto_refill_threshold: Optional[float] = None
    
    # Recognition Laws
    award_tiers: Optional[Dict[str, float]] = None
    peer_to_peer_enabled: Optional[bool] = None
    expiry_policy: Optional[str] = None
    
    # Financials & Status
    subscription_tier: Optional[str] = None
    status: Optional[str] = None


class TenantResponse(TenantBase):
    id: UUID
    
    # Identity & Branding
    logo_url: Optional[str] = None
    favicon_url: Optional[str] = None
    theme_config: Optional[Dict[str, Any]] = Field(default_factory=dict)
    branding_config: Optional[Dict[str, Any]] = Field(default_factory=dict)
    
    # Governance & Security
    domain_whitelist: Optional[List[str]] = Field(default_factory=list)
    auth_method: Optional[str] = "OTP_ONLY"
    
    # Point Economy
    currency_label: Optional[str] = "Points"
    conversion_rate: Optional[float] = 1.0
    auto_refill_threshold: Optional[float] = 20.0
    
    # Recognition Laws
    award_tiers: Optional[Dict[str, float]] = Field(default_factory=lambda: {"Gold": 5000, "Silver": 2500, "Bronze": 1000})
    peer_to_peer_enabled: Optional[bool] = True
    expiry_policy: Optional[str] = "never"
    
    # Financials
    subscription_tier: Optional[str] = "basic"
    master_budget_balance: Optional[float] = 0.0
    
    # Status
    status: Optional[str] = "ACTIVE"
    
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TenantStatsResponse(BaseModel):
    tenant_id: UUID
    tenant_name: str
    active_users: int
    master_balance: float
    last_activity: Optional[datetime] = None
    status: str


class TenantListResponse(BaseModel):
    items: List[TenantStatsResponse]
    total: int
    page: int
    page_size: int


class InjectPointsRequest(BaseModel):
    amount: float
    description: str


class TransactionResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    transaction_type: str
    amount: float
    balance_after: float
    description: str
    created_at: datetime
    
    class Config:
        from_attributes = True


# ==================== Department Schemas ====================
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
