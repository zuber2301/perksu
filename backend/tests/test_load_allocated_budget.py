import pytest
from decimal import Decimal
from fastapi.testclient import TestClient

from models import Tenant


def test_platform_admin_load_allocated_budget(client: TestClient, platform_admin_token: str, test_tenant: Tenant, db):
    initial = float(test_tenant.allocated_budget or 0)
    payload = {"amount": 1234.00, "description": "Platform load"}
    response = client.post(f"/api/tenants/{test_tenant.id}/load-budget", json=payload, headers={"Authorization": f"Bearer {platform_admin_token}"})
    assert response.status_code == 200
    db.refresh(test_tenant)
    assert float(test_tenant.allocated_budget) == pytest.approx(initial + 1234.00)
