import pandas as pd
import io
import uuid
from sqlalchemy.orm import Session
from models import User, StagingUser, Department, Wallet
from auth.utils import get_password_hash
import secrets
import string

def generate_random_password(length=12):
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return ''.join(secrets.choice(alphabet) for i in range(length))

def process_bulk_upload(db: Session, tenant_id: uuid.UUID, file_content: bytes, file_extension: str):
    batch_id = uuid.uuid4()
    
    # Read file
    if file_extension == 'csv':
        df = pd.read_csv(io.BytesIO(file_content))
    else:
        df = pd.read_excel(io.BytesIO(file_content))
    
    # Normalize headers
    df.columns = [c.strip().lower().replace(' ', '_') for c in df.columns]
    
    # Required headers mapping
    # Expected: full_name, email, department, role, manager_email
    
    staging_records = []
    
    # Pre-fetch existing departments and users for validation
    departments = {d.name.lower(): d.id for d in db.query(Department).filter(Department.tenant_id == tenant_id).all()}
    
    for index, row in df.iterrows():
        errors = []
        full_name = str(row.get('full_name', '')).strip()
        email = str(row.get('email', '')).strip()
        dept_name = str(row.get('department', '')).strip()
        role = str(row.get('role', 'employee')).strip().lower()
        manager_email = str(row.get('manager_email', '')).strip()
        
        # Validation
        if not full_name:
            errors.append("Full Name is required")
        if not email or '@' not in email:
            errors.append("Invalid Email format")
        
        # Check duplicate email in actual users
        existing_user = db.query(User).filter(User.tenant_id == tenant_id, User.email == email).first()
        if existing_user:
            errors.append(f"Email {email} already exists")
            
        # Dept validation
        dept_id = departments.get(dept_name.lower())
        if not dept_id and dept_name:
            errors.append(f"Department '{dept_name}' not found")
            
        # Role validation
        valid_roles = ['hr_admin', 'manager', 'employee']
        if role not in valid_roles:
            errors.append(f"Invalid role '{role}'. Must be one of {valid_roles}")

        # Split name
        name_parts = full_name.split(' ', 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""

        staging_user = StagingUser(
            tenant_id=tenant_id,
            batch_id=batch_id,
            raw_full_name=full_name,
            raw_email=email,
            raw_department=dept_name,
            raw_role=role,
            raw_manager_email=manager_email,
            is_valid=len(errors) == 0,
            validation_errors=errors,
            first_name=first_name,
            last_name=last_name,
            department_id=dept_id
        )
        db.add(staging_user)
        staging_records.append(staging_user)
    
    db.commit()
    
    return batch_id, len(staging_records), sum(1 for r in staging_records if r.is_valid)

def commit_staging_batch(db: Session, tenant_id: uuid.UUID, batch_id: uuid.UUID):
    staging_users = db.query(StagingUser).filter(
        StagingUser.tenant_id == tenant_id,
        StagingUser.batch_id == batch_id,
        StagingUser.is_valid == True,
        StagingUser.processed == False
    ).all()
    
    created_count = 0
    
    # Second pass for manager mapping (as some managers might be in the same batch)
    # We'll first create all users, then link managers
    
    for s_user in staging_users:
        # Create user
        # We generate a temporary password. Users will use OTP to login first time anyway
        # or reset password.
        temp_password = generate_random_password()
        
        user = User(
            tenant_id=tenant_id,
            email=s_user.raw_email,
            password_hash=get_password_hash(temp_password),
            first_name=s_user.first_name,
            last_name=s_user.last_name,
            role=s_user.raw_role,
            department_id=s_user.department_id,
            status='pending_invite'
        )
        db.add(user)
        db.flush()
        
        # Create wallet
        wallet = Wallet(
            tenant_id=tenant_id,
            user_id=user.id,
            balance=0
        )
        db.add(wallet)
        
        s_user.processed = True
        created_count += 1
    
    db.commit()
    
    # Final pass for manager lookup
    # Only for users created in this batch or previous
    all_users = db.query(StagingUser).filter(StagingUser.batch_id == batch_id).all()
    for s_user in all_users:
        if s_user.raw_manager_email:
            # Lookup manager by email
            manager = db.query(User).filter(User.tenant_id == tenant_id, User.email == s_user.raw_manager_email).first()
            if manager:
                # Update user
                user = db.query(User).filter(User.tenant_id == tenant_id, User.email == s_user.raw_email).first()
                if user:
                    user.manager_id = manager.id
    
    db.commit()
    return created_count
