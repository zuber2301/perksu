from database import SessionLocal
from models import User, Tenant, Department
from tenants.routes import get_current_tenant
import asyncio

async def test():
    db = SessionLocal()
    # Find the acme manager
    user = db.query(User).filter(User.email == 'acme_mgr@perksu.com').first()
    if not user:
        print("User not found")
        return
    
    # Mock current_user dependency
    tenant = await get_current_tenant(current_user=user, db=db)
    print(f"Tenant name: {tenant.name}")
    print(f"Master Budget Balance: {tenant.master_budget_balance}")
    print(f"Allocated Budget: {tenant.allocated_budget}")
    db.close()

if __name__ == "__main__":
    asyncio.run(test())
