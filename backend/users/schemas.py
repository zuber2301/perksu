from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, Literal
from uuid import UUID
from datetime import datetime, date

VALID_ROLES = ['platform_admin', 'hr_admin', 'manager', 'employee']


class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    role: Literal['platform_admin', 'hr_admin', 'manager', 'employee']
    department_id: Optional[UUID] = None
    manager_id: Optional[UUID] = None


class UserCreate(UserBase):
    password: str


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    personal_email: Optional[EmailStr] = None
    mobile_phone: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: Optional[Literal['platform_admin', 'hr_admin', 'manager', 'employee']] = None
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
    action: Literal['deactivate', 'activate', 'resend_invite']
