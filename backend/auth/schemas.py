from pydantic import BaseModel, EmailStr
from typing import Optional
from uuid import UUID


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: Optional[UUID] = None
    tenant_id: Optional[UUID] = None
    email: Optional[str] = None
    role: Optional[str] = None
    type: Optional[str] = "tenant"  # "system" or "tenant"
    impersonator_id: Optional[UUID] = None


class SystemAdminResponse(BaseModel):
    id: UUID
    email: EmailStr
    first_name: str
    last_name: str
    is_super_admin: bool
    mfa_enabled: bool

    class Config:
        from_attributes = True


class LoginRequest(BaseModel):
    email: EmailStr
    password: Optional[str] = None


class OTPRequest(BaseModel):
    email: Optional[EmailStr] = None
    mobile_phone: Optional[str] = None


class OTPVerify(BaseModel):
    email: Optional[EmailStr] = None
    mobile_phone: Optional[str] = None
    otp_code: str


class UserResponse(BaseModel):
    id: UUID
    tenant_id: UUID
    email: str
    first_name: str
    last_name: str
    role: str
    org_role: str = 'employee'
    department_id: Optional[UUID] = None
    avatar_url: Optional[str] = None
    is_super_admin: bool = False
    status: str

    class Config:
        from_attributes = True


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: Optional[UserResponse] = None
    system_admin: Optional[SystemAdminResponse] = None
