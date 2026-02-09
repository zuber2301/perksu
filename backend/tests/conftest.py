"""Test utilities and shims for backend tests."""

import csv as _csv
import io as _io
import sys as _sys
import types as _types

# Lightweight pandas shim when pandas is not installed
try:
    import pandas  # type: ignore
except Exception:
    pandas = _types.SimpleNamespace()

    class _DataFrame:
        def __init__(self, rows):
            # rows is a list of dicts
            self._rows = rows
            self.columns = list(rows[0].keys()) if rows else []

        def iterrows(self):
            for i, r in enumerate(self._rows):
                yield i, r

        def __setattr__(self, name, value):
            if name == "columns":
                old_cols = getattr(self, "columns", [])
                new_cols = value
                if old_cols and new_cols and len(old_cols) == len(new_cols):
                    remapped = []
                    for r in self._rows:
                        new_row = {}
                        for old, new in zip(old_cols, new_cols):
                            new_row[new] = r.get(old, "")
                        remapped.append(new_row)
                    self._rows = remapped
                object.__setattr__(self, name, value)
            else:
                object.__setattr__(self, name, value)

    def _read_csv(bytestream):
        text = (
            bytestream.read().decode("utf-8")
            if hasattr(bytestream, "read")
            else str(bytestream)
        )
        reader = _csv.DictReader(_io.StringIO(text))
        rows = [dict(r) for r in reader]
        return _DataFrame(rows)

    def _read_excel(bytestream):
        raise RuntimeError("read_excel not available in test shim")

    pandas.read_csv = _read_csv
    pandas.read_excel = _read_excel
    _sys.modules["pandas"] = pandas

__all__ = ["pandas"]

import sys
import os

# Ensure backend package is first on sys.path so plain `import database` resolves
# to `backend/database.py` during tests.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Create a file-based test database for better connection sharing
SQLALCHEMY_DATABASE_URL = "sqlite:///./test_api.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

import importlib

# Import the backend `database` module explicitly and ensure the name
# `database` in sys.modules refers to it so downstream imports use the
# in-memory engine/session during tests.
try:
    backend_db = importlib.import_module("backend.database")
except Exception:
    # fallback: import by plain name if package layout differs
    backend_db = importlib.import_module("database")

sys.modules["database"] = backend_db
sys.modules["backend.database"] = backend_db

# Patch the real database module so everyone uses our file-based DB
backend_db.SessionLocal = TestingSessionLocal
backend_db.engine = engine
Base = backend_db.Base

from database import get_db


def _override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


# Avoid multiple imports by checking if models already in sys.modules
import models  # registers all model classes on Base

# Ensure the test DB schema exists before the app or any routes are imported
print(f"DEBUG: Tables in Base.metadata: {Base.metadata.tables.keys()}")
Base.metadata.create_all(bind=engine)

# Seed platform admin
from startup_utils import init_platform_admin

init_platform_admin()

try:
    # If the app is importable, import it after creating tables and override its DB dependency
    if "main" not in sys.modules:
        from main import app
    else:
        app = sys.modules["main"].app
    app.dependency_overrides[get_db] = _override_get_db
except Exception:
    pass

import pytest
from fastapi.testclient import TestClient
from uuid import uuid4
from decimal import Decimal
from models import Tenant, Department, User


# Ensure every test has the DB override, even if legacy tests try to clobber it
@pytest.fixture(autouse=True)
def force_db_override():
    from database import get_db

    if "main" in sys.modules:
        sys.modules["main"].app.dependency_overrides[get_db] = _override_get_db


# Provide the app fixture for tests that need it
@pytest.fixture
def app_instance():
    """Provide the FastAPI app instance"""
    if "main" in sys.modules:
        return sys.modules["main"].app
    else:
        import main

        return main.app


# Provide the TestClient fixture
@pytest.fixture
def client(app_instance):
    """Provide a test client for API testing"""
    return TestClient(app_instance)


# Provide a database session fixture
@pytest.fixture
def db():
    """Provide a test database session"""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


# Helper function to create test tokens
def create_test_token(user_id, tenant_id=None, role="platform_admin"):
    """Create a test JWT token"""
    from uuid import UUID

    from auth.utils import create_access_token

    if isinstance(user_id, UUID):
        user_id = str(user_id)
    if isinstance(tenant_id, UUID):
        tenant_id = str(tenant_id)

    token_data = {
        "sub": user_id,
        "tenant_id": tenant_id,
        "email": f"test-{user_id}@example.com",
        "role": role,
        "type": "tenant",
    }
    return create_access_token(token_data)


@pytest.fixture
def platform_tenant(db):
    """Get or create the platform tenant"""
    platform_tenant = db.query(Tenant).filter(Tenant.slug == "jspark").first()
    if not platform_tenant:
        platform_tenant = Tenant(
            id=uuid4(),
            name="jSpark Platform",
            slug="jspark",
            subscription_tier="enterprise",
            master_budget_balance=Decimal("1000000.00"),
            status="ACTIVE",
        )
        db.add(platform_tenant)
        db.commit()
    return platform_tenant


@pytest.fixture
def platform_admin_department(db, platform_tenant):
    """Create an admin department for platform admins"""
    dept = (
        db.query(Department)
        .filter(
            Department.tenant_id == platform_tenant.id,
            Department.name == "Platform Admin",
        )
        .first()
    )
    if not dept:
        dept = Department(
            id=uuid4(), tenant_id=platform_tenant.id, name="Platform Admin"
        )
        db.add(dept)
        db.commit()
    return dept


@pytest.fixture
def platform_admin_user(db, platform_tenant, platform_admin_department):
    """Create a platform admin user for testing"""
    admin = User(
        id=uuid4(),
        tenant_id=platform_tenant.id,
        email="admin@sparknode.io",
        password_hash="hashed_password",
        first_name="Platform",
        last_name="Admin",
        role="platform_admin",
        department_id=platform_admin_department.id,
        is_super_admin=True,
        status="active",
    )
    db.add(admin)
    db.commit()
    return admin


@pytest.fixture
def platform_admin_token(platform_admin_user):
    """Create a JWT token for the platform admin user"""
    from auth.utils import create_access_token
    token_data = {
        "sub": str(platform_admin_user.id),
        "tenant_id": str(platform_admin_user.tenant_id),
        "email": platform_admin_user.email,
        "role": "platform_admin",
        "type": "tenant",
    }
    return create_access_token(token_data)


@pytest.fixture
def test_tenant(db):
    """Create a test tenant"""
    unique_slug = f"test-company-{uuid4().hex[:8]}"
    tenant = Tenant(
        id=uuid4(),
        name="Test Company",
        slug=unique_slug,
        subscription_tier="premium",
        master_budget_balance=Decimal("50000.00"),
        status="ACTIVE",
        logo_url="https://example.com/logo.png",
        favicon_url="https://example.com/favicon.ico",
        theme_config={
            "primary_color": "#007bff",
            "secondary_color": "#6c757d",
            "font_family": "system-ui",
        },
        domain_whitelist=["@test-company.com", "@test.io"],
        auth_method="OTP_ONLY",
        currency_label="Test Credits",
        conversion_rate=1.0,
        auto_refill_threshold=20.0,
        award_tiers={"Gold": 5000, "Silver": 2500, "Bronze": 1000},
        peer_to_peer_enabled=True,
        expiry_policy="1_year",
    )
    db.add(tenant)
    db.commit()
    return tenant


@pytest.fixture
def test_tenant_manager_department(db, test_tenant):
    """Create an admin department for the test tenant"""
    dept = Department(id=uuid4(), tenant_id=test_tenant.id, name="Admin")
    db.add(dept)
    db.commit()
    return dept


@pytest.fixture
def test_tenant_manager(db, test_tenant, test_tenant_manager_department):
    """Create a tenant manager user"""
    admin = User(
        id=uuid4(),
        tenant_id=test_tenant.id,
        email="admin@test-company.com",
        password_hash="hashed_password",
        first_name="Tenant",
        last_name="Manager",
        role="hr_admin",
        department_id=test_tenant_manager_department.id,
        is_super_admin=True,
        status="active",
    )
    db.add(admin)
    db.commit()
    return admin


@pytest.fixture
def test_tenant_manager_token(test_tenant_manager):
    """Create a JWT token for the test tenant manager user"""
    from auth.utils import create_access_token
    token_data = {
        "sub": str(test_tenant_manager.id),
        "tenant_id": str(test_tenant_manager.tenant_id),
        "email": test_tenant_manager.email,
        "role": "hr_admin",
        "type": "tenant",
    }
    return create_access_token(token_data)


# Keep a session-scoped fixture to drop the schema at the end of the test session
@pytest.fixture(scope="session", autouse=True)
def teardown_database():
    yield
    Base.metadata.drop_all(bind=engine)
    try:
        if os.path.exists("./test_api.db"):
            os.remove("./test_api.db")
    except Exception:
        pass
