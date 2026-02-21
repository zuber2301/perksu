import csv
import os
import sys
from uuid import UUID

# Add parent directory to path to allow imports from backend
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from auth.utils import get_password_hash
from models import Department, User, Wallet

from database import SessionLocal


def _get_or_create_general_dept(db, tenant_id: UUID):
    """Return (or create) the 'General' department for a given tenant."""
    dept = (
        db.query(Department)
        .filter(Department.tenant_id == tenant_id, Department.name == "General")
        .first()
    )
    if not dept:
        dept = Department(tenant_id=tenant_id, name="General")
        db.add(dept)
        db.flush()
    return dept


def import_users_from_csv(file_path: str):
    db = SessionLocal()
    try:
        with open(file_path, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                email = row["email"]
                personal_email = row.get("personal_email")
                mobile_phone = row.get("mobile_phone")
                first_name = row["first_name"]
                last_name = row["last_name"]
                role = row["role"]
                password = row["password"]
                tenant_id = UUID(row["tenant_id"])
                status = row.get("status", "active")
                dept_name = row.get("department", "").strip()

                # Check if user exists
                existing_user = db.query(User).filter(User.email == email).first()
                if existing_user:
                    print(f"User {email} already exists. Skipping.")
                    continue

                # Resolve department — mandatory; fall back to 'General'
                dept = None
                if dept_name:
                    dept = (
                        db.query(Department)
                        .filter(
                            Department.tenant_id == tenant_id,
                            Department.name.ilike(dept_name),
                        )
                        .first()
                    )
                if not dept:
                    dept = _get_or_create_general_dept(db, tenant_id)

                # Create user
                new_user = User(
                    email=email,
                    personal_email=personal_email,
                    mobile_phone=mobile_phone,
                    first_name=first_name,
                    last_name=last_name,
                    role=role,
                    password_hash=get_password_hash(password),
                    tenant_id=tenant_id,
                    department_id=dept.id,
                    status=status,
                )
                db.add(new_user)
                db.flush()  # Get user id

                # Create wallet
                new_wallet = Wallet(
                    user_id=new_user.id, tenant_id=new_user.tenant_id, balance=0
                )
                db.add(new_wallet)

                print(f"Created user: {email} with role: {role}")

            db.commit()
            print("Import completed successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error during import: {e}")
        import traceback

        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        # Default to data/personas.csv if no argument provided and it exists
        default_path = os.path.join(
            os.path.dirname(
                os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            ),
            "data",
            "personas.csv",
        )
        if os.path.exists(default_path):
            csv_path = default_path
        else:
            print("Usage: python import_users.py <path_to_csv>")
            sys.exit(1)
    else:
        csv_path = sys.argv[1]

    if not os.path.exists(csv_path):
        print(f"File not found: {csv_path}")
        sys.exit(1)

    import_users_from_csv(csv_path)
