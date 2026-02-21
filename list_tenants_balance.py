from database import SessionLocal
from models import Tenant

db = SessionLocal()
tenants = db.query(Tenant).all()
for t in tenants:
    print(f"Slug: {t.slug}, Name: {t.name}, Balance: {t.master_budget_balance}")
db.close()
