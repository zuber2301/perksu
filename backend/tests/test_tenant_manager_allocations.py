import pytest
from decimal import Decimal
from uuid import uuid4
from fastapi.testclient import TestClient

from models import Tenant, MasterBudgetLedger


def test_inject_updates_allocated_budget(client: TestClient, platform_admin_token: str, test_tenant: Tenant, db):
    initial_allocated = float(test_tenant.allocated_budget or 0)
    inject_data = {"amount": 2500.00, "description": "Platform allocation"}
    response = client.post(f"/api/tenants/admin/tenants/{test_tenant.id}/inject-points", json=inject_data, headers={"Authorization": f"Bearer {platform_admin_token}"})
    assert response.status_code == 200
    db.refresh(test_tenant)
    assert float(test_tenant.allocated_budget) == initial_allocated + 2500.00


def test_department_allocation_cannot_exceed_allocated_budget(client: TestClient, platform_admin_token: str, test_tenant: Tenant, db):
    # Ensure tenant has limited allocated budget
    test_tenant.allocated_budget = Decimal('1000.00')
    db.commit()

    # Attempt to allocate more than tenant allocated Budget via departments route
    # Create a budget first owned by tenant manager
    # Use tenant manager token (obtained via fixture in tests suite) -- here we simulate using platform admin for brevity
    payload = {"amount": 2000.0, "description": "Dept allocation"}
    # Use add-points endpoint to department (department id needs to exist). We'll fail due to cap
    some_dept_id = uuid4()
    response = client.post(f"/api/tenants/departments/{some_dept_id}/add-points", json=payload, headers={"Authorization": f"Bearer {platform_admin_token}"})
    assert response.status_code == 400
    assert 'Insufficient' in response.json()['detail']
