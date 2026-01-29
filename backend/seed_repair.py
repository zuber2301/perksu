import uuid
from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
from models import Tenant, User, Wallet, Department
from auth.utils import get_password_hash

def seed_master():
    db = SessionLocal()
    try:
        # 1. Ensure jSpark (Platform) Tenant exists
        jspark = db.query(Tenant).filter(Tenant.slug == 'jspark').first()
        if not jspark:
            print("Creating Platform Tenant...")
            jspark = Tenant(
                id=uuid.UUID('00000000-0000-0000-0000-000000000000'),
                name="jSpark Platform",
                slug="jspark",
                subscription_tier="enterprise",
                status="ACTIVE"
            )
            db.add(jspark)
            db.flush()

        # 2. Ensure Platform Admin exists
        admin = db.query(User).filter(User.email == 'admin@perksu.com').first()
        if not admin:
            print("Creating Platform Admin (admin@perksu.com / admin123)...")
            admin = User(
                tenant_id=jspark.id,
                email="admin@perksu.com",
                password_hash=get_password_hash("admin123"),
                first_name="Platform",
                last_name="Owner",
                role="platform_admin",
                is_super_admin=True,
                status="active"
            )
            db.add(admin)
            db.flush()
            
            # Create wallet
            wallet = Wallet(tenant_id=jspark.id, user_id=admin.id, balance=1000000)
            db.add(wallet)
        
        db.commit()
        print("Master seed complete. Login with admin@perksu.com / admin123")
    except Exception as e:
        print(f"Error seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_master()
