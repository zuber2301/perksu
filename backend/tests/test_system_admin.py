import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import sys
import os
import uuid

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from database import Base, get_db, SessionLocal as TestingSessionLocal, engine
from models import User, Tenant, SystemAdmin, Department
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
    """Create all tables before each test and drop after"""
    Base.metadata.create_all(bind=engine)
    
    db = TestingSessionLocal()
    
    # 1. Create a System Admin
    admin = SystemAdmin(
        email="admin@perksu.com",
        password_hash=get_password_hash("admin123"),
        first_name="Perksu",
        last_name="Admin",
        is_super_admin=True,
        mfa_enabled=False
    )
    db.add(admin)
    db.commit()
    
    # 2. Create a Tenant and some users
    tenant = Tenant(
        id=uuid.UUID('00000000-0000-0000-0000-000000000000'),
        name="jSpark Platform",
        slug="jspark",
        status="ACTIVE"
    )
    db.add(tenant)
    db.commit()

    # Add department
    dept = Department(
        tenant_id=tenant.id,
        name="Technology (IT)"
    )
    db.add(dept)
    db.commit()
    
    user1 = User(
        tenant_id=tenant.id,
        email="user1@jspark.com",
        password_hash=get_password_hash("pass123"),
        first_name="User",
        last_name="One",
        role="employee",
        department_id=dept.id,
        status="active"
    )
    db.add(user1)
    db.commit()
    
    yield
    Base.metadata.drop_all(bind=engine)

def test_system_admin_login_and_template():
    # 1. Login as system admin
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@perksu.com", "password": "admin123"}
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Try to download template
    # This should now work with the fixed 'role' property on SystemAdmin
    response = client.get("/api/users/template", headers=headers)
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "First Name,Last Name,Work Email" in response.text

def test_system_admin_list_users():
    # 1. Login as system admin
    response = client.post(
        "/api/auth/login",
        json={"email": "admin@perksu.com", "password": "admin123"}
    )
    token = response.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Get users - should work and return user1@jspark.com
    response = client.get("/api/users/", headers=headers)
    assert response.status_code == 200
    users = response.json()
    assert len(users) >= 1
    emails = [u["email"] for u in users]
    assert "user1@jspark.com" in emails
