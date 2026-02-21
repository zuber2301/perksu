"""
One-time repair script: assigns a 'General' department to any user that currently
has a NULL department_id. Safe to run multiple times (idempotent).
"""
# ---------------------------------------------------------------------------
# Canonical org_role values
# ---------------------------------------------------------------------------
# platform_admin  – Perksu super-admin (cross-tenant)
# hr_admin        – Tenant HR / Tenant Manager
# dept_lead       – Department Lead
# user            – Regular employee
# ---------------------------------------------------------------------------
ORG_ROLES = [
    "platform_admin",
    "hr_admin",
    "dept_lead",
    "user",
]
import uuid
from database import SessionLocal
from models import Department, Tenant, User


def repair():
    db = SessionLocal()
    try:
        # --- 1. Fix missing departments ---
        users_without_dept = (
            db.query(User).filter(User.department_id == None).all()
        )
        if not users_without_dept:
            print("All users already have a department. Nothing to repair (dept).")
        else:
            print(f"Found {len(users_without_dept)} users without a department.")
            tenant_ids = {u.tenant_id for u in users_without_dept}
            general_depts = {}
            for tid in tenant_ids:
                dept = (
                    db.query(Department)
                    .filter(Department.tenant_id == tid, Department.name == "General")
                    .first()
                )
                if not dept:
                    tenant = db.query(Tenant).filter(Tenant.id == tid).first()
                    tenant_name = tenant.name if tenant else str(tid)
                    print(f"  Creating 'General' department for tenant '{tenant_name}'")
                    dept = Department(tenant_id=tid, name="General")
                    db.add(dept)
                    db.flush()
                general_depts[str(tid)] = dept

            for user in users_without_dept:
                dept = general_depts[str(user.tenant_id)]
                user.department_id = dept.id
                print(f"  Assigned '{dept.name}' to user {user.email}")

            db.commit()
            print(f"  → {len(users_without_dept)} users updated.\n")

        # --- 2. Verify no stale org_role values remain ---
        stale = db.query(User).filter(User.org_role.notin_(ORG_ROLES)).all()
        if stale:
            print(f"WARNING: {len(stale)} users still have non-canonical org_roles:")
            for u in stale:
                print(f"  {u.email}: '{u.org_role}'")
        else:
            print("All org_role values are canonical.")

    except Exception as e:
        db.rollback()
        print(f"Repair failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    repair()
