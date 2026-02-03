import io
import secrets
import string
import uuid

import pandas as pd
from auth.utils import get_password_hash
from models import Department, StagingUser, User, Wallet
from sqlalchemy.orm import Session


def generate_random_password(length=12):
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    return "".join(secrets.choice(alphabet) for i in range(length))


def process_bulk_upload(
    db: Session, tenant_id: uuid.UUID, file_content: bytes, file_extension: str
):
    batch_id = uuid.uuid4()

    # Read file
    if file_extension == "csv":
        try:
            df = pd.read_csv(io.BytesIO(file_content))
        except UnicodeDecodeError:
            df = pd.read_csv(io.BytesIO(file_content), encoding="latin1")
    else:
        df = pd.read_excel(io.BytesIO(file_content))

    # Normalize headers: strip, lower, replace spaces, and remove special characters
    df.columns = [
        c.strip().lower().replace(" ", "_").replace("-", "_") for c in df.columns
    ]

    # Required headers mapping
    # Expected: first_name, last_name, work_email, personal_email, mobile_number, department, role, manager_email, date_of_birth, hire_date

    staging_records = []

    # Pre-fetch existing departments for validation
    departments = {
        d.name.lower(): d.id
        for d in db.query(Department).filter(Department.tenant_id == tenant_id).all()
    }

    def parse_date(date_str):
        if not date_str or str(date_str).lower() == "nan":
            return None
        try:
            # Handle pandas/numpy timestamp objects
            if hasattr(date_str, "strftime"):
                return date_str.strftime("%Y-%m-%d")
            # Common formats
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y", "%d-%m-%Y"):
                try:
                    from datetime import datetime

                    return datetime.strptime(str(date_str).strip(), fmt).strftime(
                        "%Y-%m-%d"
                    )
                except:
                    continue
            return str(date_str).strip()
        except:
            return str(date_str).strip()

    for index, row in df.iterrows():
        errors = []
        # Support both "full_name" (legacy) or "first_name"/"last_name"
        first_name = str(row.get("first_name", "")).strip()
        last_name = str(row.get("last_name", "")).strip()
        full_name = str(row.get("full_name", "")).strip()

        if not first_name and full_name:
            name_parts = full_name.split(" ", 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ""

        email = str(row.get("work_email", row.get("email", ""))).strip()
        personal_email = str(row.get("personal_email", "")).strip()
        mobile_phone = str(
            row.get("mobile_number", row.get("mobile_phone", ""))
        ).strip()

        # Clean mobile phone
        if mobile_phone and mobile_phone.lower() != "nan":
            # Handle pandas float conversion (e.g. 919876543210.0)
            if mobile_phone.endswith(".0"):
                mobile_phone = mobile_phone[:-2]

            # Remove spaces, dashes, parentheses
            mobile_phone = "".join(c for c in mobile_phone if c.isdigit() or c == "+")

            # Auto-prepend +91 if 10 digits provided
            if len(mobile_phone) == 10 and mobile_phone.isdigit():
                mobile_phone = "+91" + mobile_phone
            # Prepend + if 91 provided without it
            elif len(mobile_phone) == 12 and mobile_phone.startswith("91"):
                mobile_phone = "+" + mobile_phone
        else:
            mobile_phone = None

        dept_name = str(row.get("department", "")).strip()
        role = str(row.get("role", "employee")).strip().lower()
        manager_email = str(row.get("manager_email", "")).strip()
        dob = parse_date(row.get("date_of_birth"))
        hire_date = parse_date(row.get("hire_date"))

        # Validation
        if not first_name:
            errors.append("First Name is required")
        if not email or "@" not in email:
            errors.append("Invalid Work Email format")

        # Mobile number validation (Simplified +91 check)
        if mobile_phone and not (
            mobile_phone.startswith("+91") and len(mobile_phone) == 13
        ):
            errors.append(
                "Mobile must follow +91XXXXXXXXXX format (e.g., +919876543210)"
            )

        # Check duplicate identifier in actual users (email or mobile)
        existing_user = (
            db.query(User)
            .filter(
                User.tenant_id == tenant_id,
                (User.email == email)
                | ((User.mobile_phone == mobile_phone) if mobile_phone else False),
            )
            .first()
        )

        if existing_user:
            if existing_user.email == email:
                errors.append(f"Work email {email} already exists")
            elif existing_user.mobile_phone == mobile_phone:
                errors.append(f"Mobile number {mobile_phone} already exists")

        # Dept validation
        dept_id = departments.get(dept_name.lower())
        if not dept_id:
            if not dept_name:
                errors.append("Department is required")
            else:
                errors.append(f"Department '{dept_name}' not found")

        # Role validation
        valid_roles = ["hr_admin", "manager", "employee", "platform_admin"]
        if role not in valid_roles:
            errors.append(f"Invalid role '{role}'")

        staging_user = StagingUser(
            tenant_id=tenant_id,
            batch_id=batch_id,
            raw_full_name=f"{first_name} {last_name}".strip(),
            raw_email=email,
            raw_department=dept_name,
            raw_role=role,
            raw_manager_email=manager_email,
            raw_personal_email=personal_email,
            raw_mobile_phone=mobile_phone,
            raw_date_of_birth=dob,
            raw_hire_date=hire_date,
            is_valid=len(errors) == 0,
            validation_errors=errors,
            first_name=first_name,
            last_name=last_name,
            department_id=dept_id,
        )
        db.add(staging_user)
        db.flush()  # Insert immediately to avoid batching issues with SQLAlchemy 2.0 Identity tracking
        staging_records.append(staging_user)

    db.commit()

    return batch_id, len(staging_records), sum(1 for r in staging_records if r.is_valid)


def commit_staging_batch(db: Session, tenant_id: uuid.UUID, batch_id: uuid.UUID):
    staging_users = (
        db.query(StagingUser)
        .filter(
            StagingUser.tenant_id == tenant_id,
            StagingUser.batch_id == batch_id,
            StagingUser.is_valid == True,
            StagingUser.processed == False,
        )
        .all()
    )

    created_count = 0

    # Second pass for manager mapping (as some managers might be in the same batch)
    # We'll first create all users, then link managers

    for s_user in staging_users:
        # Create user
        # We generate a temporary password. Users will use OTP to login first time anyway
        temp_password = generate_random_password()

        user = User(
            tenant_id=tenant_id,
            email=s_user.raw_email,
            personal_email=s_user.raw_personal_email,
            mobile_phone=s_user.raw_mobile_phone,
            password_hash=get_password_hash(temp_password),
            first_name=s_user.first_name,
            last_name=s_user.last_name,
            role=s_user.raw_role,
            department_id=s_user.department_id,
            date_of_birth=(
                s_user.raw_date_of_birth if s_user.raw_date_of_birth else None
            ),
            hire_date=s_user.raw_hire_date if s_user.raw_hire_date else None,
            status="pending_invite",
        )
        db.add(user)
        db.flush()

        # Create wallet
        wallet = Wallet(tenant_id=tenant_id, user_id=user.id, balance=0)
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
            manager = (
                db.query(User)
                .filter(
                    User.tenant_id == tenant_id, User.email == s_user.raw_manager_email
                )
                .first()
            )
            if manager:
                # Update user
                user = (
                    db.query(User)
                    .filter(User.tenant_id == tenant_id, User.email == s_user.raw_email)
                    .first()
                )
                if user:
                    user.manager_id = manager.id

    db.commit()
    return created_count
