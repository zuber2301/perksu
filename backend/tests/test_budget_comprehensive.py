import pytest
import uuid
from decimal import Decimal
from fastapi.testclient import TestClient
from models import Tenant, Department, User, Budget, DepartmentBudget, Wallet

@pytest.fixture
def budget_flow_data(db, test_tenant):
    # 1. Create a Department
    dept = Department(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        name="Engineering"
    )
    db.add(dept)
    
    # 2. Create an HR Admin
    hr_admin = User(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        email="hr@test.com",
        password_hash="hash",
        first_name="HR",
        last_name="Admin",
        role="hr_admin",
        org_role="hr_admin",
        department_id=dept.id,
        status="active"
    )
    db.add(hr_admin)
    
    # 3. Create a Dept Lead
    lead = User(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        email="lead@test.com",
        password_hash="hash",
        first_name="Dept",
        last_name="Lead",
        role="dept_lead",
        org_role="dept_lead",
        department_id=dept.id,
        status="active"
    )
    db.add(lead)
    
    # 4. Create an Employee
    employee = User(
        id=uuid.uuid4(),
        tenant_id=test_tenant.id,
        email="emp@test.com",
        password_hash="hash",
        first_name="Emp",
        last_name="Loyee",
        role="user",
        org_role="user",
        department_id=dept.id,
        status="active"
    )
    db.add(employee)
    
    # Ensure employee has a wallet
    wallet = Wallet(
        tenant_id=test_tenant.id,
        user_id=employee.id,
        balance=Decimal("0.00")
    )
    db.add(wallet)
    
    db.commit()
    
    from auth.utils import create_access_token
    
    hr_token = create_access_token({
        "sub": str(hr_admin.id), 
        "tenant_id": str(test_tenant.id), 
        "email": hr_admin.email,
        "role": "hr_admin", 
        "type": "tenant"
    })
    lead_token = create_access_token({
        "sub": str(lead.id), 
        "tenant_id": str(test_tenant.id), 
        "email": lead.email,
        "role": "dept_lead", 
        "type": "tenant"
    })
    
    return {
        "tenant": test_tenant,
        "dept": dept,
        "hr_admin": hr_admin,
        "hr_token": hr_token,
        "lead": lead,
        "lead_token": lead_token,
        "employee": employee
    }

def test_full_budget_flow(client: TestClient, platform_admin_token, budget_flow_data, db):
    tenant = budget_flow_data["tenant"]
    hr_token = budget_flow_data["hr_token"]
    dept = budget_flow_data["dept"]
    employee = budget_flow_data["employee"]
    
    # STEP 1: Platform Admin loads the tenant's master pool
    load_payload = {"amount": 50000.00, "description": "Quarterly load"}
    # Note: the route in test_load_allocated_budget was /api/tenants/{test_tenant.id}/load-budget
    # Let's verify the actual route for loading budget
    response = client.post(
        f"/api/tenants/{tenant.id}/load-budget", 
        json=load_payload, 
        headers={"Authorization": f"Bearer {platform_admin_token}"}
    )
    assert response.status_code == 200
    
    db.refresh(tenant)
    assert float(tenant.allocated_budget) >= 50000.00
    
    # STEP 2: HR Admin creates an Organizational Budget
    budget_payload = {
        "name": "Q1 2026 Budget",
        "fiscal_year": 2026,
        "fiscal_quarter": 1,
        "total_points": 20000.00
    }
    response = client.post(
        "/api/budgets/", 
        json=budget_payload, 
        headers={"Authorization": f"Bearer {hr_token}"}
    )
    assert response.status_code == 200
    budget_id = response.json()["id"]
    
    # STEP 3: HR Admin allocates budget to departments
    allocate_payload = {
        "allocations": [
            {
                "department_id": str(dept.id),
                "allocated_points": 10000.00,
                "monthly_cap": 5000.00
            }
        ]
    }
    response = client.post(
        f"/api/budgets/{budget_id}/allocate",
        json=allocate_payload,
        headers={"Authorization": f"Bearer {hr_token}"}
    )
    assert response.status_code == 200
    
    # STEP 4: HR Admin activates the budget
    response = client.put(
        f"/api/budgets/{budget_id}/activate",
        headers={"Authorization": f"Bearer {hr_token}"}
    )
    assert response.status_code == 200
    
    # STEP 5: HR Admin (or lead) tops up an employee's wallet from the department budget
    # The endpoint is: POST /api/budgets/{budget_id}/departments/{department_id}/allocate_employee
    topup_payload = {
        "user_id": str(employee.id),
        "points": 500.00
    }
    response = client.post(
        f"/api/budgets/{budget_id}/departments/{dept.id}/allocate_employee",
        json=topup_payload,
        headers={"Authorization": f"Bearer {hr_token}"}
    )
    assert response.status_code == 200
    
    # Verify wallet update
    db.refresh(employee)
    wallet = db.query(Wallet).filter(Wallet.user_id == employee.id).first()
    assert float(wallet.balance) == 500.00
    
    # Verify department budget update
    dept_budget = db.query(DepartmentBudget).filter(
        DepartmentBudget.budget_id == budget_id,
        DepartmentBudget.department_id == dept.id
    ).first()
    assert float(dept_budget.spent_points) == 500.00
    
def test_lead_allocation_and_recognition_flow(client: TestClient, platform_admin_token, budget_flow_data, db):
    tenant = budget_flow_data["tenant"]
    hr_token = budget_flow_data["hr_token"]
    lead = budget_flow_data["lead"]
    lead_token = budget_flow_data["lead_token"]
    employee = budget_flow_data["employee"]
    
    # Prerequisite: Load Master Pool
    client.post(f"/api/tenants/{tenant.id}/load-budget", json={"amount": 10000.00}, headers={"Authorization": f"Bearer {platform_admin_token}"})
    
    # 1. Create and Activate Budget
    budget_payload = {"name": "Recognition Budget", "fiscal_year": 2026, "total_points": 5000.00}
    res = client.post("/api/budgets/", json=budget_payload, headers={"Authorization": f"Bearer {hr_token}"})
    budget_id = res.json()["id"]
    client.put(f"/api/budgets/{budget_id}/activate", headers={"Authorization": f"Bearer {hr_token}"})
    
    # 2. Allocate points to Dept Lead
    lead_alloc_payload = {
        "lead_id": str(lead.id),
        "budget_id": str(budget_id),
        "points": 1000.00
    }
    response = client.post(
        "/api/budgets/leads/allocate",
        json=lead_alloc_payload,
        headers={"Authorization": f"Bearer {hr_token}"}
    )
    assert response.status_code == 200
    
    # 3. Dept Lead gives an Individual Award to Employee using their lead budget
    rec_payload = {
        "to_user_id": str(employee.id),
        "points": 200.00,
        "message": "Excellent work on the project! This is a high impact contribution.",
        "recognition_type": "individual_award",
        "visibility": "public"
    }
    response = client.post(
        "/api/recognitions/",
        json=rec_payload,
        headers={"Authorization": f"Bearer {lead_token}"}
    )
    assert response.status_code == 200
    
    # 4. Verify financial deduct from Lead Allocation (not wallet)
    db.refresh(lead)
    from models import LeadAllocation
    lead_alloc = db.query(LeadAllocation).filter(LeadAllocation.lead_id == lead.id).first()
    assert float(lead_alloc.spent_points) == 200.00
    
    # 5. Verify Employee wallet credited
    wallet = db.query(Wallet).filter(Wallet.user_id == employee.id).first()
    assert float(wallet.balance) == 200.00

def test_insufficient_tenant_budget(client: TestClient, platform_admin_token, budget_flow_data, db):
    tenant = budget_flow_data["tenant"]
    hr_token = budget_flow_data["hr_token"]
    
    # Reset tenant budget
    tenant.allocated_budget = Decimal("1000.00")
    db.commit()
    
    # Attempt to create a budget of 2000
    budget_payload = {
        "name": "Exploit Budget",
        "fiscal_year": 2026,
        "total_points": 2000.00
    }
    response = client.post(
        "/api/budgets/", 
        json=budget_payload, 
        headers={"Authorization": f"Bearer {hr_token}"}
    )
    assert response.status_code == 400
    assert "Insufficient tenant allocated budget" in response.json()["detail"]
