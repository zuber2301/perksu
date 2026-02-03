from datetime import datetime, timedelta
from uuid import UUID

from auth.email_service import send_otp_email
from auth.schemas import (
    LoginRequest,
    LoginResponse,
    OTPRequest,
    OTPVerify,
    SignUpRequest,
    SignUpResponse,
    Token,
    UserResponse,
)
from auth.tenant_utils import TenantResolver
from auth.utils import (
    create_access_token,
    generate_otp,
    get_current_user,
    get_password_hash,
    get_system_admin,
    verify_password,
)
from config import settings
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from models import LoginOTP, SystemAdmin, Tenant, User, Wallet
from sqlalchemy.orm import Session

from database import get_db

router = APIRouter()


@router.post("/signup", response_model=SignUpResponse)
async def signup(signup_data: SignUpRequest, db: Session = Depends(get_db)):
    """
    User sign-up with automatic tenant resolution.

    Flow:
    1. Resolve tenant_id (via invite token or email domain matching)
    2. Validate no existing user with same email
    3. Create user with resolved tenant_id and initialize wallet
    4. Return JWT token for immediate authentication

    Raises:
        - 400: Email already registered or no associated organization found
        - 422: Invalid email format
    """
    # Step 1: Resolve Tenant ID
    tenant_id = TenantResolver.resolve_tenant(
        email=signup_data.email, invite_token=signup_data.invite_token, db=db
    )

    if not tenant_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No associated organization found for this domain. Please use an invite link or contact your administrator.",
        )

    # Step 2: Check if user already exists (globally, not just in tenant)
    existing_user = db.query(User).filter(User.email == signup_data.email).first()

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered. Please log in or use a different email.",
        )

    # Step 3: Get tenant to determine department structure
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Tenant validation failed",
        )

    # Get or create default department
    _ = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    from models import Department

    default_dept_record = (
        db.query(Department)
        .filter(Department.tenant_id == tenant_id, Department.name == "General")
        .first()
    )

    if not default_dept_record:
        default_dept_record = Department(tenant_id=tenant_id, name="General")
        db.add(default_dept_record)
        db.flush()

    # Step 4: Create the user with tenant_id (The "Magic Link")
    new_user = User(
        tenant_id=tenant_id,
        email=signup_data.email,
        password_hash=get_password_hash(signup_data.password),
        first_name=signup_data.first_name,
        last_name=signup_data.last_name,
        personal_email=signup_data.personal_email,
        mobile_phone=signup_data.mobile_phone,
        department_id=default_dept_record.id,
        role="employee",
        org_role="employee",
        status="active",
    )
    db.add(new_user)
    db.flush()

    # Step 5: Initialize wallet
    wallet = Wallet(
        tenant_id=tenant_id,
        user_id=new_user.id,
        balance=0,
        lifetime_earned=0,
        lifetime_spent=0,
    )
    db.add(wallet)
    db.commit()
    db.refresh(new_user)

    # Step 6: Create JWT token
    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={
            "sub": str(new_user.id),
            "tenant_id": str(new_user.tenant_id),
            "email": new_user.email,
            "role": new_user.role,
            "type": "tenant",
        },
        expires_delta=access_token_expires,
    )

    return SignUpResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse.from_orm(new_user),
        message="Account created successfully",
    )


@router.post("/request-otp", response_model=dict)
async def request_otp(otp_data: OTPRequest, db: Session = Depends(get_db)):
    """Generate and send OTP to user personal email or mobile phone if valid"""
    identifier = None
    target_user = None

    if otp_data.email:
        identifier = otp_data.email
        target_user = (
            db.query(User).filter(User.personal_email == otp_data.email).first()
        )
    elif otp_data.mobile_phone:
        identifier = otp_data.mobile_phone
        target_user = (
            db.query(User).filter(User.mobile_phone == otp_data.mobile_phone).first()
        )
    else:
        raise HTTPException(status_code=400, detail="Email or Mobile Phone is required")

    if not target_user:
        # User requested: "verification is must"
        # To avoid enumeration, we still return "sent", but we don't actually send anything.
        return {
            "message": "If an account is associated with this identifier, an OTP has been sent."
        }

    otp_code = generate_otp()
    expires_at = datetime.utcnow() + timedelta(minutes=5)

    new_otp = LoginOTP(
        email=identifier,  # Storing the identifier (email or phone) in the email field of LoginOTP for simplicity
        otp_code=otp_code,
        expires_at=expires_at,
    )
    db.add(new_otp)
    db.commit()

    # Send via appropriate channel
    if otp_data.email:
        send_otp_email(otp_data.email, otp_code)
        print(f"OTP Email sent to {otp_data.email}")
    else:
        # TODO: Implement actual SMS service (Twilio, AWS SNS, etc.)
        # For now, we simulate sending SMS
        print(f"SMS OTP [{otp_code}] sent to {otp_data.mobile_phone}")

    return {"message": "OTP sent successfully"}


@router.post("/verify-otp", response_model=LoginResponse)
async def verify_otp(verify_data: OTPVerify, db: Session = Depends(get_db)):
    """Verify OTP and return JWT token"""
    identifier = verify_data.email or verify_data.mobile_phone
    if not identifier:
        raise HTTPException(
            status_code=400, detail="Identifier (email or mobile_phone) is required"
        )

    record = (
        db.query(LoginOTP)
        .filter(
            LoginOTP.email == identifier,
            LoginOTP.used == False,
            LoginOTP.expires_at > datetime.utcnow(),
        )
        .order_by(LoginOTP.created_at.desc())
        .first()
    )

    if not record or record.otp_code != verify_data.otp_code:
        if record:
            record.attempts += 1
            db.commit()
            if record.attempts >= 3:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Too many attempts. Please request a new OTP.",
                )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired OTP"
        )

    # Mark as used
    record.used = True
    db.commit()

    # Find user (verify against personal_email or mobile_phone)
    if verify_data.email:
        user = db.query(User).filter(User.personal_email == verify_data.email).first()
    else:
        user = (
            db.query(User).filter(User.mobile_phone == verify_data.mobile_phone).first()
        )

    if not user:
        # If no user exists, we might need to handle registration or error.
        # Given "tenant-aware" and "multi-tenant" nature, usually we need a tenant_id.
        # For simplicity, if user doesn't exist, we'll deny login unless it's a signup flow.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found. Please contact your administrator.",
        )

    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="User account is not active"
        )

    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "tenant_id": str(user.tenant_id),
            "email": user.email,
            "role": user.role,
            "type": "tenant",
        },
        expires_delta=access_token_expires,
    )

    return LoginResponse(
        access_token=access_token, token_type="bearer", user=UserResponse.from_orm(user)
    )


@router.post("/login", response_model=LoginResponse)
async def login(login_data: LoginRequest, db: Session = Depends(get_db)):
    """Authenticate user or system admin and return JWT token"""
    # 1. Check SystemAdmin table first
    system_admin = (
        db.query(SystemAdmin).filter(SystemAdmin.email == login_data.email).first()
    )
    if system_admin and verify_password(
        login_data.password, system_admin.password_hash
    ):
        access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
        access_token = create_access_token(
            data={
                "sub": str(system_admin.id),
                "email": system_admin.email,
                "role": "platform_admin",
                "type": "system",
            },
            expires_delta=access_token_expires,
        )
        return LoginResponse(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse(
                id=system_admin.id,
                tenant_id=UUID("00000000-0000-0000-0000-000000000000"),
                email=system_admin.email,
                first_name=system_admin.first_name,
                last_name=system_admin.last_name,
                role="platform_admin",
                is_super_admin=system_admin.is_super_admin,
                status="active",
            ),
        )

    # 2. Check regular User table
    user = db.query(User).filter(User.email == login_data.email).first()

    if not user or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="User account is not active"
        )

    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "tenant_id": str(user.tenant_id),
            "email": user.email,
            "role": user.role,
            "type": "tenant",
        },
        expires_delta=access_token_expires,
    )

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=UserResponse(
            id=user.id,
            tenant_id=user.tenant_id,
            email=user.email,
            first_name=user.first_name,
            last_name=user.last_name,
            role=user.role,
            department_id=user.department_id,
            avatar_url=user.avatar_url,
            is_super_admin=user.is_super_admin,
            status=user.status,
        ),
    )


@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)
):
    """OAuth2 compatible token endpoint"""
    user = db.query(User).filter(User.email == form_data.username).first()

    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "tenant_id": str(user.tenant_id),
            "email": user.email,
            "role": user.role,
        },
        expires_delta=access_token_expires,
    )

    return Token(access_token=access_token, token_type="bearer")


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current authenticated user information"""
    return UserResponse(
        id=current_user.id,
        tenant_id=current_user.tenant_id,
        email=current_user.email,
        first_name=current_user.first_name,
        last_name=current_user.last_name,
        role=current_user.role,
        department_id=current_user.department_id,
        avatar_url=current_user.avatar_url,
        status=current_user.status,
    )


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """Logout user (client should discard the token)"""
    return {"message": "Successfully logged out"}


@router.post("/impersonate/{tenant_id}", response_model=LoginResponse)
async def impersonate_tenant(
    tenant_id: UUID,
    db: Session = Depends(get_db),
    current_admin: SystemAdmin = Depends(get_system_admin),
):
    """Allows a system admin to impersonate a tenant manager"""
    # Find the tenant manager for this tenant
    user = (
        db.query(User).filter(User.tenant_id == tenant_id, User.role == "admin").first()
    )

    if not user:
        # If no admin, try to find any active user in that tenant
        user = (
            db.query(User)
            .filter(User.tenant_id == tenant_id, User.status == "active")
            .first()
        )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No user found for this tenant to impersonate",
        )

    access_token_expires = timedelta(minutes=settings.access_token_expire_minutes)
    access_token = create_access_token(
        data={
            "sub": str(user.id),
            "tenant_id": str(user.tenant_id),
            "email": user.email,
            "role": user.role,
            "type": "tenant",
            "impersonator_id": str(current_admin.id),
        },
        expires_delta=access_token_expires,
    )

    return LoginResponse(
        access_token=access_token, token_type="bearer", user=UserResponse.from_orm(user)
    )
