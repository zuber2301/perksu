import uuid

from auth.utils import get_password_hash
from models import SystemAdmin, Tenant

from database import SessionLocal


def init_platform_admin():
    """Ensure a platform admin and master tenant exist on startup."""
    print("Verifying platform admin status...")
    db = SessionLocal()
    try:
        # 1. Ensure jSpark (Platform) Tenant exists
        jspark = db.query(Tenant).filter(Tenant.slug == "jspark").first()
        if not jspark:
            print("→ Creating Platform Tenant (jSpark)...")
            jspark = Tenant(
                id=uuid.UUID("00000000-0000-0000-0000-000000000000"),
                name="jSpark Platform",
                slug="jspark",
                subscription_tier="enterprise",
                status="ACTIVE",
            )
            db.add(jspark)
            db.flush()

        # 2. Ensure default System Admin exists
        admin_email = "admin@perksu.com"
        admin = db.query(SystemAdmin).filter(SystemAdmin.email == admin_email).first()
        if not admin:
            print(f"→ Creating default System Admin ({admin_email})...")
            admin = SystemAdmin(
                email=admin_email,
                password_hash=get_password_hash("admin123"),
                first_name="Perksu",
                last_name="Admin",
                is_super_admin=True,
                mfa_enabled=False,  # Disable for simple demo login
            )
            db.add(admin)
            db.flush()

        db.commit()
    except Exception as e:
        print(f"ERROR initializing platform admin: {e}")
        db.rollback()
    finally:
        db.close()
