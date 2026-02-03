from datetime import date, datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, field_validator

VALID_ROLES = ["platform_admin", "hr_admin", "manager", "employee"]
VALID_ORG_ROLES = [
    "platform_admin",
    "tenant_manager",
    "hr_admin",
    "tenant_lead",
    "manager",
    "corporate_user",
    "employee",
]


class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    role: Literal["platform_admin", "hr_admin", "manager", "employee"]
    org_role: Literal[
        "platform_admin",
        "tenant_manager",
        "hr_admin",
        "tenant_lead",
        "manager",
        "corporate_user",
        "employee",
    ] = "employee"
    department_id: UUID
    manager_id: Optional[UUID] = None
    personal_email: Optional[EmailStr] = None
    mobile_phone: Optional[str] = None
    date_of_birth: Optional[date] = None
    hire_date: Optional[date] = None

    @field_validator("mobile_phone")
    @classmethod
    def validate_mobile_phone(cls, v):
        if not v:
            return v

        # Strip common formatting
        cleaned = "".join(c for c in v if c.isdigit() or c == "+")

        # Auto-fix 10 digit or 91... forms
        if len(cleaned) == 10 and cleaned.isdigit():
            cleaned = "+91" + cleaned
        elif len(cleaned) == 12 and cleaned.startswith("91"):
            cleaned = "+" + cleaned

        if not (cleaned.startswith("+91") and len(cleaned) == 13):
            raise ValueError(
                "Mobile must follow +91XXXXXXXXXX format (e.g., +919876543210)"
            )

        return cleaned


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    personal_email: Optional[EmailStr] = None
    mobile_phone: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[Literal["platform_admin", "hr_admin", "manager", "employee"]] = None
    org_role: Optional[
        Literal[
            "platform_admin",
            "tenant_manager",
            "hr_admin",
            "tenant_lead",
            "manager",
            "corporate_user",
            "employee",
        ]
    ] = None
    department_id: Optional[UUID] = None
    manager_id: Optional[UUID] = None
    avatar_url: Optional[str] = None
    date_of_birth: Optional[date] = None
    hire_date: Optional[date] = None
    status: Optional[str] = None


class UserResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    email: str
    personal_email: Optional[str] = None
    mobile_phone: Optional[str] = None
    first_name: str
    last_name: str
    role: str
    org_role: str = "employee"
    department_id: Optional[UUID] = None
    manager_id: Optional[UUID] = None
    avatar_url: Optional[str] = None
    date_of_birth: Optional[date] = None
    hire_date: Optional[date] = None
    is_super_admin: bool = False
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class UserListResponse(BaseModel):
    id: UUID
    email: str
    first_name: str
    last_name: str
    role: str
    org_role: str = "employee"
    department_id: Optional[UUID] = None
    avatar_url: Optional[str] = None
    status: str

    class Config:
        from_attributes = True


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class StagingUserResponse(BaseModel):
    id: UUID
    batch_id: UUID
    raw_full_name: Optional[str] = None
    raw_email: Optional[str] = None
    raw_department: Optional[str] = None
    raw_role: Optional[str] = None
    raw_manager_email: Optional[str] = None
    raw_personal_email: Optional[str] = None
    raw_mobile_phone: Optional[str] = None
    raw_date_of_birth: Optional[str] = None
    raw_hire_date: Optional[str] = None
    is_valid: bool
    validation_errors: list[str]
    processed: bool
    created_at: datetime

    class Config:
        from_attributes = True


class BulkUploadResponse(BaseModel):
    batch_id: UUID
    total_rows: int
    valid_rows: int
    invalid_rows: int


class BulkActionRequest(BaseModel):
    user_ids: list[UUID]
    action: Literal["deactivate", "activate", "resend_invite", "reactivate"]
