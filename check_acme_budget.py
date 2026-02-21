from database import SessionLocal
from models import Tenant, Budget, Department, DepartmentBudget, MasterBudgetLedger
from sqlalchemy import func

db = SessionLocal()
tenant = db.query(Tenant).filter(Tenant.slug == 'acme-corp').first()
if not tenant:
    print("Tenant 'acme' not found")
else:
    print(f"Tenant: {tenant.name} ({tenant.slug})")
    print(f"  master_budget_balance: {tenant.master_budget_balance}")
    print(f"  budget_allocation_balance: {tenant.budget_allocation_balance}")
    print(f"  allocated_budget: {tenant.allocated_budget}")
    
    budgets = db.query(Budget).filter(Budget.tenant_id == tenant.id).all()
    print(f"\nBudgets:")
    for b in budgets:
        print(f"  - {b.name} (ID: {b.id}): Total: {b.total_points}, Allocated: {b.allocated_points}, Status: {b.status}")
        
    dept_budgets = db.query(DepartmentBudget).filter(DepartmentBudget.tenant_id == tenant.id).all()
    print(f"\nDepartment Budgets:")
    for db_item in dept_budgets:
        dept = db.query(Department).filter(Department.id == db_item.department_id).first()
        print(f"  - Dept: {dept.name}, Allocated: {db_item.allocated_points}, Spent: {db_item.spent_points}")
        
    ledger = db.query(MasterBudgetLedger).filter(MasterBudgetLedger.tenant_id == tenant.id).order_by(MasterBudgetLedger.created_at.desc()).all()
    print(f"\nMaster Budget Ledger (Last 5):")
    for l in ledger[:5]:
        print(f"  - {l.transaction_type}: {l.amount} (Balance After: {l.balance_after}) - {l.description}")

db.close()
