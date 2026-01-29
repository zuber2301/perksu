import uuid
from sqlalchemy.orm import Session
from database import SessionLocal, engine, Base
from models import Tenant, User, Wallet, Department, Budget, MasterBudgetLedger
from auth.utils import get_password_hash
from datetime import datetime, timedelta

def seed_master():
    db = SessionLocal()
    try:
        # 1. Ensure jSpark (Platform) Tenant exists
        jspark = db.query(Tenant).filter(Tenant.slug == 'jspark').first()
        if not jspark:
            print("Creating Platform Tenant...")
            jspark = Tenant(
                id=uuid.UUID('00000000-0000-0000-0000-000000000000'),
                name="jSpark", # Integration tests expect "jSpark" not "jSpark Platform"
                slug="jspark",
                subscription_tier="enterprise",
                status="ACTIVE",
                master_budget_balance=1000000
            )
            db.add(jspark)
            db.flush()

        # 1.1 Ensure jSpark has a department
        dept = db.query(Department).filter(Department.tenant_id == jspark.id).first()
        if not dept:
            print("Creating default department for jSpark...")
            dept = Department(
                tenant_id=jspark.id,
                name="Engineering"
            )
            db.add(dept)
            db.flush()

        # 1.2 Ensure jSpark has a budget
        budget = db.query(Budget).filter(Budget.tenant_id == jspark.id).first()
        if not budget:
            print("Creating default budget for jSpark...")
            budget = Budget(
                tenant_id=jspark.id,
                name="Q1 2026 Rewards",
                fiscal_year=2026,
                total_points=100000,
                status="active"
            )
            db.add(budget)
            db.flush()

        # 2. Ensure Platform Admin exists
        users_to_create = [
            {
                "email": "super_user@jspark.com",
                "password": "jspark123",
                "first_name": "Platform",
                "last_name": "Owner",
                "role": "platform_admin",
                "is_super_admin": True,
                "tenant_id": jspark.id
            },
            {
                "email": "admin@triton.com",
                "password": "jspark123",
                "first_name": "Triton",
                "last_name": "Admin",
                "role": "hr_admin",
                "is_super_admin": True,
                "tenant_id": jspark.id # Using jspark id for simplicity in tests
            },
            {
                "email": "employee@triton.com",
                "password": "jspark123",
                "first_name": "Triton",
                "last_name": "Employee",
                "role": "employee",
                "is_super_admin": False,
                "tenant_id": jspark.id
            },
            {
                "email": "manager@jspark.com",
                "password": "jspark123",
                "first_name": "Sarah",
                "last_name": "Manager",
                "role": "manager",
                "is_super_admin": False,
                "tenant_id": jspark.id
            },
            {
                "email": "hr@jspark.com",
                "password": "jspark123",
                "first_name": "HR",
                "last_name": "User",
                "role": "hr_admin",
                "is_super_admin": False,
                "tenant_id": jspark.id
            }
        ]

        for u_data in users_to_create:
            user = db.query(User).filter(User.email == u_data["email"]).first()
            if not user:
                print(f"Creating user {u_data['email']}...")
                user = User(
                    tenant_id=u_data["tenant_id"],
                    email=u_data["email"],
                    password_hash=get_password_hash(u_data["password"]),
                    first_name=u_data["first_name"],
                    last_name=u_data["last_name"],
                    role=u_data["role"],
                    is_super_admin=u_data["is_super_admin"],
                    status="active"
                )
                db.add(user)
                db.flush()
                
                # Create wallet
                wallet = Wallet(tenant_id=u_data["tenant_id"], user_id=user.id, balance=1000000)
                db.add(wallet)

        # 3. Create a seeded Budget with Expiry
        active_budget = db.query(Budget).filter(Budget.tenant_id == jspark.id, Budget.status == 'active').first()
        if not active_budget:
            print("Seeding active budget...")
            expiry = datetime.now() + timedelta(days=90)
            active_budget = Budget(
                tenant_id=jspark.id,
                name="Q1 2026 Rewards",
                fiscal_year=2026,
                fiscal_quarter=1,
                total_points=500000,
                allocated_points=0,
                status='active',
                expiry_date=expiry
            )
            db.add(active_budget)
        
        db.commit()
        print("Master seed complete. Login with super_user@jspark.com / jspark123")
    except Exception as e:
        print(f"Error seeding: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_master()
