from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Numeric, Integer, Text, Date, CheckConstraint, TypeDecorator, CHAR
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, JSONB as PG_JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import json
from database import Base
import uuid

class GUID(TypeDecorator):
    """Platform-independent GUID type."""
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        else:
            return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if not isinstance(value, uuid.UUID):
            try:
                value = uuid.UUID(str(value))
            except (ValueError, TypeError):
                return value
        if dialect.name == 'postgresql':
            return value
        else:
            return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if not isinstance(value, uuid.UUID):
            return uuid.UUID(value)
        return value

class JSONType(TypeDecorator):
    """Platform-independent JSON type."""
    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(PG_JSONB())
        else:
            return dialect.type_descriptor(Text())

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == 'postgresql':
            return value
        else:
            return json.dumps(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if dialect.name != 'postgresql' and isinstance(value, str):
            return json.loads(value)
        return value

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if dialect.name == 'postgresql':
            return value
        else:
            return json.loads(value)

class Tenant(Base):
    __tablename__ = "tenants"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False)
    branding_config = Column(JSONType(), default={})
    subscription_tier = Column(String(50), default='basic')
    master_budget_balance = Column(Numeric(15, 2), default=0)
    status = Column(String(50), default='ACTIVE')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    departments = relationship("Department", back_populates="tenant")
    users = relationship("User", back_populates="tenant")
    budgets = relationship("Budget", back_populates="tenant")
    master_budget_ledger = relationship("MasterBudgetLedger", back_populates="tenant")


class SystemAdmin(Base):
    __tablename__ = "system_admins"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100))
    last_name = Column(String(100))
    is_super_admin = Column(Boolean, default=False)
    mfa_enabled = Column(Boolean, default=True)
    last_login_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"

    @property
    def role(self):
        return "platform_admin"

    @property
    def tenant_id(self):
        # Platform admins operate globally or in a default platform tenant
        return uuid.UUID('00000000-0000-0000-0000-000000000000')

class MasterBudgetLedger(Base):
    __tablename__ = "master_budget_ledger"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    transaction_type = Column(String(20), nullable=False)  # credit/debit
    amount = Column(Numeric(15, 2), nullable=False)
    balance_after = Column(Numeric(15, 2), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    tenant = relationship("Tenant", back_populates="master_budget_ledger")


class Department(Base):
    __tablename__ = "departments"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    parent_id = Column(GUID(), ForeignKey("departments.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    tenant = relationship("Tenant", back_populates="departments")
    users = relationship("User", back_populates="department")
    department_budgets = relationship("DepartmentBudget", back_populates="department")


class User(Base):
    __tablename__ = "users"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    email = Column(String(255), nullable=False)
    personal_email = Column(String(255))
    mobile_phone = Column(String(20))
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    role = Column(String(50), nullable=False)
    department_id = Column(GUID(), ForeignKey("departments.id"), nullable=False)
    manager_id = Column(GUID(), ForeignKey("users.id"))
    avatar_url = Column(String(500))
    date_of_birth = Column(Date)
    hire_date = Column(Date)
    is_super_admin = Column(Boolean, default=False)
    status = Column(String(50), default='pending_invite') # pending_invite, active, deactivated
    invitation_sent_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    tenant = relationship("Tenant", back_populates="users")
    department = relationship("Department", back_populates="users")
    wallet = relationship("Wallet", back_populates="user", uselist=False)
    recognitions_given = relationship("Recognition", foreign_keys="Recognition.from_user_id", back_populates="from_user")
    recognitions_received = relationship("Recognition", foreign_keys="Recognition.to_user_id", back_populates="to_user")
    lead_allocations = relationship("LeadAllocation", back_populates="lead")
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}"


class StagingUser(Base):
    __tablename__ = "staging_users"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    batch_id = Column(GUID(), nullable=False) # To group uploads
    
    # Data from CSV
    raw_full_name = Column(String(255))
    raw_email = Column(String(255))
    raw_department = Column(String(255))
    raw_role = Column(String(50))
    raw_manager_email = Column(String(255))
    raw_personal_email = Column(String(255))
    raw_mobile_phone = Column(String(20))
    raw_date_of_birth = Column(String(50))
    raw_hire_date = Column(String(50))
    
    # Validation results
    is_valid = Column(Boolean, default=True)
    validation_errors = Column(JSONType(), default=[]) # List of strings
    
    # Processed data (if valid)
    first_name = Column(String(100))
    last_name = Column(String(100))
    department_id = Column(GUID())
    manager_id = Column(GUID())
    
    processed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class LoginOTP(Base):
    __tablename__ = "login_otps"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), nullable=False, index=True)
    otp_code = Column(String(10), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    attempts = Column(Integer, default=0)
    used = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Budget(Base):
    __tablename__ = "budgets"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    fiscal_year = Column(Integer, nullable=False)
    fiscal_quarter = Column(Integer)
    total_points = Column(Numeric(15, 2), nullable=False, default=0)
    allocated_points = Column(Numeric(15, 2), nullable=False, default=0)
    status = Column(String(50), default='active')
    expiry_date = Column(DateTime(timezone=True))
    created_by = Column(GUID(), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    tenant = relationship("Tenant", back_populates="budgets")
    department_budgets = relationship("DepartmentBudget", back_populates="budget")
    lead_allocations = relationship("LeadAllocation", back_populates="budget")
    
    @property
    def remaining_points(self):
        return float(self.total_points) - float(self.allocated_points)


class DepartmentBudget(Base):
    __tablename__ = "department_budgets"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    budget_id = Column(GUID(), ForeignKey("budgets.id", ondelete="CASCADE"), nullable=False)
    department_id = Column(GUID(), ForeignKey("departments.id", ondelete="CASCADE"), nullable=False)
    allocated_points = Column(Numeric(15, 2), nullable=False, default=0)
    spent_points = Column(Numeric(15, 2), nullable=False, default=0)
    monthly_cap = Column(Numeric(15, 2))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    budget = relationship("Budget", back_populates="department_budgets")
    department = relationship("Department", back_populates="department_budgets")
    
    @property
    def remaining_points(self):
        return float(self.allocated_points) - float(self.spent_points)


class Wallet(Base):
    __tablename__ = "wallets"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    balance = Column(Numeric(15, 2), nullable=False, default=0)
    lifetime_earned = Column(Numeric(15, 2), nullable=False, default=0)
    lifetime_spent = Column(Numeric(15, 2), nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User", back_populates="wallet")
    ledger_entries = relationship("WalletLedger", back_populates="wallet")


class WalletLedger(Base):
    __tablename__ = "wallet_ledger"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    wallet_id = Column(GUID(), ForeignKey("wallets.id", ondelete="CASCADE"), nullable=False)
    transaction_type = Column(String(20), nullable=False)  # credit/debit
    source = Column(String(50), nullable=False)  # hr_allocation/recognition/redemption/adjustment/expiry/reversal
    points = Column(Numeric(15, 2), nullable=False)
    balance_after = Column(Numeric(15, 2), nullable=False)
    reference_type = Column(String(50))
    reference_id = Column(GUID())
    description = Column(Text)
    created_by = Column(GUID(), ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    wallet = relationship("Wallet", back_populates="ledger_entries")


class LeadAllocation(Base):
    __tablename__ = "lead_allocations"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    budget_id = Column(GUID(), ForeignKey("budgets.id", ondelete="CASCADE"), nullable=False)
    lead_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    
    allocated_points = Column(Numeric(15, 2), nullable=False, default=0)
    spent_points = Column(Numeric(15, 2), nullable=False, default=0)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    budget = relationship("Budget", back_populates="lead_allocations")
    lead = relationship("User")

    @property
    def remaining_points(self):
        return float(self.allocated_points) - float(self.spent_points)
    
    @property
    def usage_percentage(self):
        if float(self.allocated_points) == 0:
            return 0
        return round((float(self.spent_points) / float(self.allocated_points)) * 100, 2)


class Badge(Base):
    __tablename__ = "badges"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"))
    name = Column(String(100), nullable=False)
    description = Column(Text)
    icon_url = Column(String(500))
    points_value = Column(Numeric(15, 2), default=0)
    is_system = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    recognitions = relationship("Recognition", back_populates="badge")


class Recognition(Base):
    __tablename__ = "recognitions"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    from_user_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    to_user_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    badge_id = Column(GUID(), ForeignKey("badges.id"))
    recognition_type = Column(String(50), default='standard')  # standard, individual_award, group_award, ecard
    points = Column(Numeric(15, 2), nullable=False, default=0)
    message = Column(Text, nullable=False)
    ecard_template = Column(String(100))
    visibility = Column(String(20), default='public')  # public/private/department
    status = Column(String(50), default='active')  # pending/active/rejected/revoked
    department_budget_id = Column(GUID(), ForeignKey("department_budgets.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    from_user = relationship("User", foreign_keys=[from_user_id], back_populates="recognitions_given")
    to_user = relationship("User", foreign_keys=[to_user_id], back_populates="recognitions_received")
    badge = relationship("Badge", back_populates="recognitions")
    comments = relationship("RecognitionComment", back_populates="recognition")
    reactions = relationship("RecognitionReaction", back_populates="recognition")


class RecognitionComment(Base):
    __tablename__ = "recognition_comments"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    recognition_id = Column(GUID(), ForeignKey("recognitions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    recognition = relationship("Recognition", back_populates="comments")
    user = relationship("User")


class RecognitionReaction(Base):
    __tablename__ = "recognition_reactions"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    recognition_id = Column(GUID(), ForeignKey("recognitions.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    reaction_type = Column(String(20), default='like')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    recognition = relationship("Recognition", back_populates="reactions")
    user = relationship("User")


class Feed(Base):
    __tablename__ = "feed"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    event_type = Column(String(50), nullable=False)  # recognition/redemption/milestone/birthday/anniversary/achievement
    reference_type = Column(String(50))
    reference_id = Column(GUID())
    actor_id = Column(GUID(), ForeignKey("users.id"))
    target_id = Column(GUID(), ForeignKey("users.id"))
    visibility = Column(String(20), default='public')
    event_metadata = Column("metadata", JSONType, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    actor = relationship("User", foreign_keys=[actor_id])
    target = relationship("User", foreign_keys=[target_id])


class Brand(Base):
    __tablename__ = "brands"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    logo_url = Column(String(500))
    category = Column(String(100))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    vouchers = relationship("Voucher", back_populates="brand")


class Voucher(Base):
    __tablename__ = "vouchers"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    brand_id = Column(GUID(), ForeignKey("brands.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    denomination = Column(Numeric(15, 2), nullable=False)
    points_required = Column(Numeric(15, 2), nullable=False)
    copay_amount = Column(Numeric(15, 2), default=0)
    image_url = Column(String(500))
    terms_conditions = Column(Text)
    validity_days = Column(Integer, default=365)
    is_active = Column(Boolean, default=True)
    stock_quantity = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    brand = relationship("Brand", back_populates="vouchers")
    redemptions = relationship("Redemption", back_populates="voucher")


class TenantVoucher(Base):
    __tablename__ = "tenant_vouchers"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    voucher_id = Column(GUID(), ForeignKey("vouchers.id", ondelete="CASCADE"), nullable=False)
    is_active = Column(Boolean, default=True)
    custom_points_required = Column(Numeric(15, 2))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Redemption(Base):
    __tablename__ = "redemptions"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(GUID(), ForeignKey("users.id"), nullable=False)
    voucher_id = Column(GUID(), ForeignKey("vouchers.id"), nullable=False)
    points_used = Column(Numeric(15, 2), nullable=False)
    copay_amount = Column(Numeric(15, 2), default=0)
    voucher_code = Column(String(255))
    voucher_pin = Column(String(100))
    status = Column(String(50), default='pending')  # pending/processing/completed/failed/cancelled/expired
    provider_reference = Column(String(255))
    fulfilled_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    user = relationship("User")
    voucher = relationship("Voucher", back_populates="redemptions")


class AuditLog(Base):
    __tablename__ = "audit_log"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(GUID(), ForeignKey("tenants.id"))
    actor_id = Column(GUID(), ForeignKey("users.id"))
    action = Column(String(100), nullable=False)
    entity_type = Column(String(100))
    entity_id = Column(GUID())
    old_values = Column(JSONType)
    new_values = Column(JSONType)
    ip_address = Column(String(45))
    user_agent = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(GUID(), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(GUID(), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(GUID(), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text)
    reference_type = Column(String(50))
    reference_id = Column(GUID())
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User")
