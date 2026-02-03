from models import Tenant, User
from sqlalchemy import text

from database import SessionLocal


def refactor_emails():
    db = SessionLocal()
    try:
        print("Refactoring email domains to perksu.com...")

        # 1. Update jSpark (Primary) Users
        jspark = db.query(Tenant).filter(Tenant.slug == "jspark").first()
        if jspark:
            # hr@jspark.com -> hr@perksu.com
            db.execute(
                text(
                    "UPDATE users SET email = 'hr@perksu.com' WHERE tenant_id = :tid AND email = 'hr@jspark.com'"
                ),
                {"tid": jspark.id},
            )

            # manager@jspark.com -> lead@perksu.com
            db.execute(
                text(
                    "UPDATE users SET email = 'lead@perksu.com' WHERE tenant_id = :tid AND email = 'manager@jspark.com'"
                ),
                {"tid": jspark.id},
            )

            # employee@jspark.com -> user@perksu.com
            db.execute(
                text(
                    "UPDATE users SET email = 'user@perksu.com' WHERE tenant_id = :tid AND email = 'employee@jspark.com'"
                ),
                {"tid": jspark.id},
            )

            # super_user@jspark.com -> super.admin@perksu.com
            db.execute(
                text(
                    "UPDATE users SET email = 'super.admin@perksu.com' WHERE tenant_id = :tid AND email = 'super_user@jspark.com'"
                ),
                {"tid": jspark.id},
            )

        # 2. Update all other users to [local].[slug]@perksu.com
        tenants = db.query(Tenant).all()
        for tenant in tenants:
            users = db.query(User).filter(User.tenant_id == tenant.id).all()
            for user in users:
                if "@perksu.com" in user.email and tenant.slug == "jspark":
                    continue  # Already processed

                local_part = user.email.split("@")[0]
                new_email = f"{local_part}.{tenant.slug}@perksu.com"

                # Double check uniqueness before updating
                exists = db.query(User).filter(User.email == new_email).first()
                if not exists:
                    user.email = new_email

        db.commit()
        print("Done! All email domains updated to @perksu.com.")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    refactor_emails()
