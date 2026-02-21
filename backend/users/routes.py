import csv
import io
from typing import List, Optional
from uuid import UUID

from auth.utils import (
    get_current_user,
    get_hr_admin,
    get_password_hash,
    get_platform_admin,
    verify_password,
)
from fastapi import APIRouter, Depends, File, HTTPException, Path, Query, UploadFile
from fastapi.responses import Response
from models import StagingUser, Tenant, User, Wallet
from sqlalchemy.orm import Session, joinedload
from users.schemas import (
    BulkActionRequest,
    BulkUploadResponse,
    PasswordChange,
    StagingUserResponse,
    UserCreate,
    UserListResponse,
    UserResponse,
    UserUpdate,
)
from users.service import commit_staging_batch, process_bulk_upload

from database import get_db

router = APIRouter()


@router.get("/", response_model=List[UserListResponse])
async def get_users(
    tenant_id: Optional[UUID] = Query(
        None,
        description="Filter by tenant_id (Platform Admin only). Omit to get current tenant users.",
    ),
    department_id: Optional[UUID] = Query(None, description="Filter by department_id"),
    role: Optional[str] = Query(None, description="Filter by role"),
    status: Optional[str] = Query(
        default=None,
        description="Filter by status (active, deactivated, pending_invite). Defaults to all statuses for admins.",
    ),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get users with tenant-aware filtering.

    Tenant Isolation:
    - Regular users: Can only see users from their own tenant
    - Platform Admins: Can view all tenants, or filter by specific tenant_id

    The "Tenant-Aware" Query Pattern:
    Every SELECT query automatically includes tenant_id filter for non-admins.
    This ensures data isolation at the database layer.

    Example queries:
    - GET /users -> Returns all users in current user's tenant
    - GET /users?tenant_id=UUID -> (Admin only) Returns users from specified tenant
    - GET /users?department_id=UUID -> Returns users in department (auto-scoped to tenant)
    """
    query = db.query(User)

    # Apply tenant filter based on user role
    if current_user.role == "platform_admin":
        # Platform admin can view any tenant, or filter by tenant_id
        if tenant_id:
            query = query.filter(User.tenant_id == tenant_id)
    else:
        # Regular users only see their own tenant (Tenant Isolation)
        query = query.filter(User.tenant_id == current_user.tenant_id)

    # Apply additional filters
    if department_id:
        query = query.filter(User.department_id == department_id)
    if role:
        query = query.filter(User.role == role)
    
    # Status filtering: 
    # If explicitly requested, use it.
    # Otherwise, for regular users default to 'active'. 
    # For HR/Managers, show all by default unless they specify.
    if status:
        query = query.filter(User.status == status)
    elif current_user.role not in ["platform_admin", "hr_admin"]:
        query = query.filter(User.status == "active")

    users = query.offset(skip).limit(limit).all()
    return users


@router.get("/admin/by-tenant/{tenant_id}", response_model=List[UserListResponse])
async def get_users_by_tenant(
    tenant_id: UUID = Path(..., description="The tenant_id to query users from"),
    department_id: Optional[UUID] = Query(
        None, description="Optional department filter"
    ),
    role: Optional[str] = Query(None, description="Optional role filter"),
    status: Optional[str] = Query(None, description="Optional status filter"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_platform_admin),
    db: Session = Depends(get_db),
):
    """
    Platform Admin endpoint: View all users for a specific tenant.

    This is the "Platform Admin View" mentioned in the spec:
    "In your Tenant Manager section, when you click on a tenant, your UI should call:
    GET /users?tenant_id=XYZ"

    This allows platform admins to see all users associated with a specific tenant_id,
    effectively giving them a "window" into that organization.

    Permission: Platform Admin only
    """
    # Verify tenant exists
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Tenant not found"
        )

    # Query users for this specific tenant
    query = db.query(User).options(joinedload(User.department)).filter(User.tenant_id == tenant_id)

    if department_id:
        query = query.filter(User.department_id == department_id)
    if role:
        query = query.filter(User.role == role)
    if status:
        query = query.filter(User.status == status)

    users = query.offset(skip).limit(limit).all()

    return users


@router.post("/", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db),
):
    """Create a new user (HR Admin only)"""
    # Check if email already exists globally
    existing_user = (
        db.query(User)
        .filter(User.email == user_data.email)
        .first()
    )
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create user
    user = User(
        tenant_id=current_user.tenant_id,
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        role=user_data.role,
        org_role=user_data.org_role,
        department_id=user_data.department_id,
        manager_id=user_data.manager_id,
        personal_email=user_data.personal_email,
        mobile_phone=user_data.mobile_phone,
        date_of_birth=user_data.date_of_birth,
        hire_date=user_data.hire_date,
        status="active",  # Set to active since password is provided during manual creation
    )
    db.add(user)
    db.flush()

    # Create wallet for user
    wallet = Wallet(
        tenant_id=current_user.tenant_id,
        user_id=user.id,
        balance=0,
        lifetime_earned=0,
        lifetime_spent=0,
    )
    db.add(wallet)

    db.commit()
    db.refresh(user)
    return user


@router.get("/search", response_model=List[UserListResponse])
async def search_users(
    q: str = Query(..., min_length=2),
    limit: int = 10,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Search users by name or email"""
    search_term = f"%{q}%"
    users = (
        db.query(User)
        .filter(
            User.tenant_id == current_user.tenant_id,
            User.status == "active",
            (
                User.first_name.ilike(search_term)
                | User.last_name.ilike(search_term)
                | User.email.ilike(search_term)
            ),
        )
        .limit(limit)
        .all()
    )
    return users


@router.get(
    "/direct-reports", response_model=List[UserListResponse]
)  # Fixed from {user_id}/direct-reports for convenience
async def get_my_direct_reports(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    """Get direct reports for the current logged in user"""
    reports = (
        db.query(User)
        .filter(
            User.tenant_id == current_user.tenant_id,
            User.manager_id == current_user.id,
            User.status == "active",
        )
        .all()
    )
    return reports


# --- Bulk Provisioning Endpoints ---


@router.get("/template")
async def download_template(current_user: User = Depends(get_hr_admin)):
    """Download CSV template for bulk user upload"""
    output = io.StringIO()
    writer = csv.writer(output)
    # Comprehensive headers to match users table requirements
    writer.writerow(
        [
            "First Name",
            "Last Name",
            "Work Email",
            "Personal Email",
            "Password",
            "Mobile Number",
            "Role",
            "Department",
            "Manager Email",
            "Date of Birth",
            "Hire Date",
        ]
    )
    writer.writerow(
        [
            "Sarah",
            "Manager",
            "sarah.manager@perksu.com",
            "sarah.personal@gmail.com",
            "jspark123",
            "+919876543210",
            "manager",
            "Technology (IT)",
            "",
            "1985-05-20",
            "2020-01-15",
        ]
    )
    writer.writerow(
        [
            "John",
            "Employee",
            "john.employee@perksu.com",
            "john.e@yahoo.com",
            "jspark123",
            "+919876543211",
            "employee",
            "Sales & Marketing",
            "sarah.manager@perksu.com",
            "1992-08-12",
            "2022-03-01",
        ]
    )

    content = output.getvalue()
    return Response(
        content=content,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=user_upload_template.csv"
        },
    )


@router.post("/upload", response_model=BulkUploadResponse)
async def upload_users_csv(
    file: UploadFile = File(...),
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db),
):
    """Upload CSV/Excel file to staging area"""
    content = await file.read()
    ext = file.filename.split(".")[-1].lower()

    if ext not in ["csv", "xlsx"]:
        raise HTTPException(
            status_code=400, detail="Only .csv and .xlsx files are supported"
        )

    batch_id, total, valid = process_bulk_upload(
        db, current_user.tenant_id, content, ext
    )

    return BulkUploadResponse(
        batch_id=batch_id,
        total_rows=total,
        valid_rows=valid,
        invalid_rows=total - valid,
    )


@router.get("/staging/{batch_id}", response_model=List[StagingUserResponse])
async def get_staging_users(
    batch_id: UUID,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db),
):
    """List staging records for a specific batch"""
    records = (
        db.query(StagingUser)
        .filter(
            StagingUser.tenant_id == current_user.tenant_id,
            StagingUser.batch_id == batch_id,
        )
        .order_by(StagingUser.created_at.asc())
        .all()
    )
    return records


@router.post("/staging/{batch_id}/confirm")
async def confirm_staging_import(
    batch_id: UUID,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db),
):
    """Commit valid staging records to production"""
    count = commit_staging_batch(db, current_user.tenant_id, batch_id)
    return {"message": f"Successfully provisioned {count} users", "count": count}


@router.post("/bulk-action")
async def bulk_user_action(
    request: BulkActionRequest,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db),
):
    """Bulk actions on users (activate, deactivate, resend invite)"""
    users = (
        db.query(User)
        .filter(User.id.in_(request.user_ids), User.tenant_id == current_user.tenant_id)
        .all()
    )

    for user in users:
        if request.action == "deactivate":
            user.status = "deactivated"
        elif request.action == "activate" or request.action == "reactivate":
            user.status = "active"
        elif request.action == "resend_invite":
            user.invitation_sent_at = func.now()
            # In a real system, trigger email here

    db.commit()
    return {"message": f"Bulk {request.action} completed for {len(users)} users"}


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a specific user"""
    user = (
        db.query(User)
        .filter(User.id == user_id, User.tenant_id == current_user.tenant_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: UUID,
    user_data: UserUpdate,
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db),
):
    """Update a user (HR Admin only)"""
    user = (
        db.query(User)
        .filter(User.id == user_id, User.tenant_id == current_user.tenant_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = user_data.model_dump(exclude_unset=True)

    # Never allow department_id to be unset
    if "department_id" in update_data and update_data["department_id"] is None:
        raise HTTPException(
            status_code=400,
            detail="department_id is required and cannot be removed from a user.",
        )

    for key, value in update_data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return user


@router.put("/me/password")
async def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change current user's password"""
    if not verify_password(password_data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect current password")

    current_user.password_hash = get_password_hash(password_data.new_password)
    db.commit()
    return {"message": "Password changed successfully"}


@router.get("/{user_id}/direct-reports", response_model=List[UserListResponse])
async def get_direct_reports(
    user_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get direct reports for a user"""
    reports = (
        db.query(User)
        .filter(
            User.tenant_id == current_user.tenant_id,
            User.manager_id == user_id,
            User.status == "active",
        )
        .all()
    )
    return reports
