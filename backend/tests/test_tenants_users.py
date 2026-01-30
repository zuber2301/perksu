import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from database import Base, get_db, SessionLocal as TestingSessionLocal, engine
from models import Tenant, Department, User, Wallet
from auth.utils import get_password_hash

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_database():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Create test tenant
    tenant = Tenant(
        id="550e8400-e29b-41d4-a716-446655440000",
        name="Test Corp",
        slug="test-corp",
        status="ACTIVE",
        subscription_tier="basic",
        master_budget_balance=10000
    )
    db.add(tenant)
    db.commit()

    # Create test department
    dept = Department(
        id="660e8400-e29b-41d4-a716-446655440001",
        tenant_id=tenant.id,
        name="Human Resource (HR)"
    )
    db.add(dept)
    db.commit()

    # HR admin
    hr = User(
        id="770e8400-e29b-41d4-a716-446655440001",
        tenant_id=tenant.id,
        email="test@test.com",
        password_hash=get_password_hash("password123"),
        first_name="Test",
        last_name="User",
        role="hr_admin",
        department_id=dept.id,
        status="active"
    )
    db.add(hr)

    # Employee
    employee = User(
        id="770e8400-e29b-41d4-a716-446655440002",
        tenant_id=tenant.id,
        email="employee@test.com",
        password_hash=get_password_hash("password123"),
        first_name="Test",
        last_name="Employee",
        role="employee",
        department_id=dept.id,
        status="active"
    )
    db.add(employee)

    # Platform admin (for tenant provisioning)
    platform = User(
        id="770e8400-e29b-41d4-a716-446655440100",
        tenant_id=tenant.id,
        email="platform@test.com",
        password_hash=get_password_hash("password123"),
        first_name="Platform",
        last_name="Admin",
        role="platform_admin",
        department_id=dept.id,
        status="active"
    )
    db.add(platform)
    db.commit()

    yield
    
    Base.metadata.drop_all(bind=engine)
    # Re-create tables so other tests in other files have them if they expect them
    Base.metadata.create_all(bind=engine)
    from startup_utils import init_platform_admin
    init_platform_admin()

    db.close()


def get_auth_header(email: str = "test@test.com", password: str = "password123"):
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_create_tenant_as_platform_admin():
    headers = get_auth_header(email="platform@test.com")

    payload = {
        "name": "New Tenant",
        "slug": "new-tenant",
        "admin_email": "admin@newtenant.com",
        "admin_password": "newpass123",
        "admin_first_name": "New",
        "admin_last_name": "Admin",
        "initial_balance": 5000,
        "subscription_tier": "basic"
    }

    resp = client.post("/api/tenants", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "New Tenant"
    assert data["slug"] == "new-tenant"


def test_create_user_as_hr_admin():
    headers = get_auth_header()

    # create a new user
    payload = {
        "email": "new.employee@test.com",
        "password": "securePass1!",
        "first_name": "New",
        "last_name": "Employee",
        "role": "employee",
        "department_id": "660e8400-e29b-41d4-a716-446655440001"
    }

    resp = client.post("/api/users", json=payload, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "new.employee@test.com"


def test_bulk_upload_and_confirm():
    headers = get_auth_header()

    csv_content = (
        "First Name,Last Name,Work Email,Personal Email,Mobile Number,Role,Department,Manager Email,Date of Birth,Hire Date\n"
        "Alice,Wonderland,alice@perksu.com,alice.personal@gmail.com,+919876543212,employee,Human Resource (HR),,1990-01-01,2024-01-01\n"
    )

    files = {"file": ("users.csv", csv_content, "text/csv")}
    resp = client.post("/api/users/upload", files=files, headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_rows"] >= 1
    assert data["valid_rows"] >= 1


def test_modify_user_attributes():
    headers = get_auth_header()

    update_payload = {
        "email": "employee.updated@test.com",
        "mobile_phone": "+919811112223"
    }

    resp = client.put(
        "/api/users/770e8400-e29b-41d4-a716-446655440002",
        json=update_payload,
        headers=headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "employee.updated@test.com"
    assert data["mobile_phone"] == "+919811112223"
