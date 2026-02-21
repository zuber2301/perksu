from database import SessionLocal
from models import User, Tenant
from sqlalchemy import func
from decimal import Decimal

db = SessionLocal()
user = db.query(User).filter(User.email == 'acme_mgr@perksu.com').first()
tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()

print(f"Tenant: {tenant.name}")
print(f"  master_budget_balance: {tenant.master_budget_balance} (Type: {type(tenant.master_budget_balance)})")
print(f"  budget_allocation_balance: {tenant.budget_allocation_balance} (Type: {type(tenant.budget_allocation_balance)})")

# Emulate get_master_pool logic
balance = float(tenant.budget_allocation_balance or tenant.master_budget_balance or 0)
print(f"Calculated Balance: {balance}")

db.close()
