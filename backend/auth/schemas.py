from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr


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
    org_role: str = "user"
    department_id: Optional[UUID] = None
    department_name: Optional[str] = None
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


class SignUpRequest(BaseModel):
    """
    User sign-up with automatic tenant resolution.

    Tenant resolution happens in this order:
    1. If invite_token provided: extract tenant_id from token
    2. If email provided: match domain against tenant whitelist
    """

    email: EmailStr
    password: str
    first_name: str
    last_name: str
    invite_token: Optional[str] = None
    personal_email: Optional[EmailStr] = None
    mobile_phone: Optional[str] = None


class SignUpResponse(BaseModel):
    """Response after successful sign-up"""

    access_token: str
    token_type: str
    user: UserResponse
    message: str = "Account created successfully"


class InviteLinkResponse(BaseModel):
    """Response containing invite token for a user to join a tenant"""

    invite_url: str
    invite_token: str
    expires_in_hours: int
    tenant_id: UUID
