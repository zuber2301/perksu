import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import sys
import os
from unittest.mock import patch, MagicMock

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import app
from database import Base, get_db
from models import User, Tenant, LoginOTP
from datetime import datetime, timedelta

# Test database setup (using SQLite for unit tests)
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

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
    
    # Create test data
    db = TestingSessionLocal()
    
    # Create test tenant
    tenant = Tenant(
        id="550e8400-e29b-41d4-a716-446655440000",
        name="Test Corp",
        slug="test-corp"
    )
    db.add(tenant)
    db.commit()
    
    # Create test user
    from auth.utils import get_password_hash
    user = User(
        id="770e8400-e29b-41d4-a716-446655440001",
        tenant_id=tenant.id,
        email="test@test.com",
        password_hash=get_password_hash("password123"),
        first_name="Test",
        last_name="User",
        role="employee",
        status="active"
    )
    db.add(user)
    db.commit()
    db.close()
    
    yield
    Base.metadata.drop_all(bind=engine)

class TestOTPAuth:
    """Test Suite for Email OTP Authentication"""

    @patch("auth.routes.send_otp_email")
    def test_request_otp_success(self, mock_send_email):
        """Should successfully generate OTP and call email service"""
        response = client.post(
            "/api/auth/request-otp",
            json={"email": "test@test.com"}
        )
        
        assert response.status_code == 200
        assert response.json()["message"] == "OTP sent successfully"
        assert mock_send_email.called
        
        # Verify it exists in DB
        db = TestingSessionLocal()
        otp_record = db.query(LoginOTP).filter(LoginOTP.email == "test@test.com").first()
        assert otp_record is not None
        assert len(otp_record.otp_code) == 6
        db.close()

    def test_verify_otp_success(self):
        """Should verify valid OTP and return JWT"""
        # 1. Setup - Manual inject OTP into DB
        db = TestingSessionLocal()
        otp_record = LoginOTP(
            email="test@test.com",
            otp_code="123456",
            expires_at=datetime.utcnow() + timedelta(minutes=5)
        )
        db.add(otp_record)
        db.commit()
        db.close()

        # 2. Verify
        response = client.post(
            "/api/auth/verify-otp",
            json={"email": "test@test.com", "otp_code": "123456"}
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == "test@test.com"
        
        # Verify it's marked as used
        db = TestingSessionLocal()
        updated_record = db.query(LoginOTP).filter(LoginOTP.email == "test@test.com").first()
        assert updated_record.used is True
        db.close()

    def test_verify_otp_invalid(self):
        """Should fail verification with wrong code"""
        db = TestingSessionLocal()
        otp_record = LoginOTP(
            email="test@test.com",
            otp_code="123456",
            expires_at=datetime.utcnow() + timedelta(minutes=5)
        )
        db.add(otp_record)
        db.commit()
        db.close()

        response = client.post(
            "/api/auth/verify-otp",
            json={"email": "test@test.com", "otp_code": "wrong!!"}
        )

        assert response.status_code == 401
        assert "Invalid or expired OTP" in response.json()["detail"]

    def test_verify_otp_expired(self):
        """Should fail if OTP is expired"""
        db = TestingSessionLocal()
        otp_record = LoginOTP(
            email="test@test.com",
            otp_code="123456",
            expires_at=datetime.utcnow() - timedelta(minutes=1) # Already expired
        )
        db.add(otp_record)
        db.commit()
        db.close()

        response = client.post(
            "/api/auth/verify-otp",
            json={"email": "test@test.com", "otp_code": "123456"}
        )

        assert response.status_code == 401
        assert "Invalid or expired OTP" in response.json()["detail"]

    def test_verify_otp_lockout(self):
        """Should lock out after 3 failed attempts"""
        db = TestingSessionLocal()
        otp_record = LoginOTP(
            email="test@test.com",
            otp_code="123456",
            expires_at=datetime.utcnow() + timedelta(minutes=5),
            attempts=2
        )
        db.add(otp_record)
        db.commit()
        db.close()

        # 3rd attempt (should fail with 403)
        response = client.post(
            "/api/auth/verify-otp",
            json={"email": "test@test.com", "otp_code": "wrong"}
        )

        assert response.status_code == 403
        assert "Too many attempts" in response.json()["detail"]

    def test_verify_non_existent_user(self):
        """Should fail if email doesn't belong to a user during verification"""
        db = TestingSessionLocal()
        otp_record = LoginOTP(
            email="ghost@company.com",
            otp_code="111111",
            expires_at=datetime.utcnow() + timedelta(minutes=5)
        )
        db.add(otp_record)
        db.commit()
        db.close()

        response = client.post(
            "/api/auth/verify-otp",
            json={"email": "ghost@company.com", "otp_code": "111111"}
        )

        assert response.status_code == 404
        assert "User not found" in response.json()["detail"]
