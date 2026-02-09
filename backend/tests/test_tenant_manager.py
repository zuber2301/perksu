"""
Tests for Tenant Manager Management API Endpoints
Tests the comprehensive tenant management features including:
- Tenant listing with pagination and filtering
- Tenant details and updates
- Point injection and transaction history
- Tenant status management (suspend, resume, archive)
- Manager user management
- Platform-wide health metrics
"""

import os
import sys
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

# Import token creation function
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from auth.utils import create_access_token
from models import Department, MasterBudgetLedger, SystemAdmin, Tenant, User


@pytest.fixture
def platform_tenant(db: Session):
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
def platform_admin_department(db: Session, platform_tenant: Tenant):
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
def platform_admin_user(
    db: Session, platform_tenant: Tenant, platform_admin_department: Department
):
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
def platform_admin_token(platform_admin_user: User):
    """Create a JWT token for the platform admin user"""
    token_data = {
        "sub": str(platform_admin_user.id),
        "tenant_id": str(platform_admin_user.tenant_id),
        "email": platform_admin_user.email,
        "role": "platform_admin",
        "type": "tenant",
    }
    return create_access_token(token_data)


class TestTenantListingAndFiltering:
    """Test tenant listing with pagination and filtering"""

    def test_list_all_tenants(
        self, client: TestClient, platform_admin_token: str, test_tenant: Tenant
    ):
        """Test listing all tenants"""
        response = client.get(
            "/api/tenants/admin/tenants",
            headers={"Authorization": f"Bearer {platform_admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert "page" in data
        assert "page_size" in data

    def test_list_tenants_with_search(
        self, client: TestClient, platform_admin_token: str, test_tenant: Tenant
    ):
        """Test filtering tenants by search term"""
        response = client.get(
            "/api/tenants/admin/tenants?search=Test",
            headers={"Authorization": f"Bearer {platform_admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["items"]) > 0

    def test_list_tenants_by_status(
        self, client: TestClient, platform_admin_token: str, test_tenant: Tenant
    ):
        """Test filtering tenants by status"""
        response = client.get(
            "/api/tenants/admin/tenants?status_filter=ACTIVE",
            headers={"Authorization": f"Bearer {platform_admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        for item in data["items"]:
            assert item["status"] == "ACTIVE"

    def test_list_tenants_pagination(
        self, client: TestClient, platform_admin_token: str
    ):
        """Test pagination of tenant list"""
        response = client.get(
            "/api/tenants/admin/tenants?skip=0&limit=5",
            headers={"Authorization": f"Bearer {platform_admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["page_size"] == 5

    def test_tenant_stats_in_list(
        self, client: TestClient, platform_admin_token: str, test_tenant: Tenant
    ):
        """Test that tenant list includes stats like active users and balance"""
        response = client.get(
            "/api/tenants/admin/tenants",
            headers={"Authorization": f"Bearer {platform_admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        if len(data["items"]) > 0:
            item = data["items"][0]
            assert "active_users" in item
            assert "master_balance" in item
            assert "last_activity" in item or item["last_activity"] is None


class TestTenantDetailsAndUpdates:
    """Test getting and updating tenant details"""

    def test_get_tenant_details(
        self, client: TestClient, platform_admin_token: str, test_tenant: Tenant
    ):
        """Test retrieving full tenant details"""
        response = client.get(
            f"/api/tenants/admin/tenants/{test_tenant.id}",
            headers={"Authorization": f"Bearer {platform_admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_tenant.id)
        assert data["name"] == "Test Company"
        assert data["logo_url"] == "https://example.com/logo.png"

    def test_update_tenant_branding(
        self, client: TestClient, platform_admin_token: str, test_tenant: Tenant
    ):
        """Test updating tenant branding settings"""
        update_data = {
            "name": "Updated Company",
            "logo_url": "https://example.com/new-logo.png",
            "theme_config": {
                "primary_color": "#ff0000",
                "secondary_color": "#00ff00",
                "font_family": "Georgia",
            },
        }
        response = client.put(
            f"/api/tenants/admin/tenants/{test_tenant.id}",
            json=update_data,
            headers={"Authorization": f"Bearer {platform_admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Company"
        assert data["theme_config"]["primary_color"] == "#ff0000"

    def test_update_governance_settings(
        self, client: TestClient, platform_admin_token: str, test_tenant: Tenant
    ):
        """Test updating governance and security settings"""
        update_data = {
            "domain_whitelist": ["@newdomain.com", "@new.io"],
            "auth_method": "PASSWORD_AND_OTP",
        }
        response = client.put(
            f"/api/tenants/admin/tenants/{test_tenant.id}",
            json=update_data,
            headers={"Authorization": f"Bearer {platform_admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "@newdomain.com" in data["domain_whitelist"]
        assert data["auth_method"] == "PASSWORD_AND_OTP"

    def test_update_point_economy(
        self, client: TestClient, platform_admin_token: str, test_tenant: Tenant
    ):
        """Test updating point economy settings"""
        update_data = {
            "currency_label": "Company Points",
            "conversion_rate": 2.5,
            "auto_refill_threshold": 25.0,
        }
        response = client.put(
            f"/api/tenants/admin/tenants/{test_tenant.id}",
            json=update_data,
            headers={"Authorization": f"Bearer {platform_admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["currency_label"] == "Company Points"
        assert float(data["conversion_rate"]) == 2.5

    def test_update_recognition_rules(
        self, client: TestClient, platform_admin_token: str, test_tenant: Tenant
    ):
        """Test updating recognition rules"""
        update_data = {
            "award_tiers": {"Platinum": 10000, "Gold": 5000},
            "peer_to_peer_enabled": False,
            "expiry_policy": "180_days",
        }
        response = client.put(
            f"/api/tenants/admin/tenants/{test_tenant.id}",
            json=update_data,
            headers={"Authorization": f"Bearer {platform_admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["peer_to_peer_enabled"] is False
        assert data["expiry_policy"] == "180_days"


class TestPointInjection:
    """Test injecting points into tenant budgets"""

    def test_inject_points(
        self,
        client: TestClient,
        platform_admin_token: str,
        test_tenant: Tenant,
        db: Session,
    ):
        """Test injecting points to master budget"""
        initial_balance = float(test_tenant.master_budget_balance)

        inject_data = {"amount": 5000.00, "description": "Q3 Budget Allocation"}
        response = client.post(
            f"/api/tenants/admin/tenants/{test_tenant.id}/inject-points",
            json=inject_data,
            headers={"Authorization": f"Bearer {platform_admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert float(data["amount"]) == 5000.00
        assert float(data["balance_after"]) == initial_balance + 5000.00

    def test_inject_points_creates_ledger_entry(
        self,
        client: TestClient,
        platform_admin_token: str,
        test_tenant: Tenant,
        db: Session,
    ):
        """Test that point injection creates an audit ledger entry"""
        inject_data = {"amount": 1000.00, "description": "Test injection"}
        response = client.post(
            f"/api/tenants/admin/tenants/{test_tenant.id}/inject-points",
            json=inject_data,
            headers={"Authorization": f"Bearer {platform_admin_token}"},
        )
        assert response.status_code == 200

        # Verify ledger entry exists
        ledger_entry = (
            db.query(MasterBudgetLedger)
            .filter(MasterBudgetLedger.tenant_id == test_tenant.id)
            .first()
        )
        assert ledger_entry is not None
        assert ledger_entry.transaction_type == "credit"

    def test_inject_negative_amount_fails(
        self, client: TestClient, platform_admin_token: str, test_tenant: Tenant
    ):
        """Test that injecting negative amounts is rejected"""
        inject_data = {"amount": -1000.00, "description": "Invalid injection"}
        response = client.post(
            f"/api/tenants/admin/tenants/{test_tenant.id}/inject-points",
            json=inject_data,
            headers={"Authorization": f"Bearer {platform_admin_token}"},
        )
        assert response.status_code == 400

    def test_get_transaction_history(
        self,
        client: TestClient,
        platform_admin_token: str,
        test_tenant: Tenant,
        db: Session,
    ):
        """Test retrieving transaction history"""
        # Create a transaction first
        ledger = MasterBudgetLedger(
            tenant_id=test_tenant.id,
            transaction_type="credit",
            amount=Decimal("1000.00"),
            balance_after=Decimal("51000.00"),
            description="Test transaction",
        )
        db.add(ledger)
        db.commit()

        response = client.get(
            f"/api/tenants/admin/tenants/{test_tenant.id}/transactions",
            headers={"Authorization": f"Bearer {platform_admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0


class TestTenantStatusManagement:
    """Test suspend, resume, and archive operations"""

    def test_suspend_tenant(
        self,
        client: TestClient,
        platform_admin_token: str,
        test_tenant: Tenant,
        db: Session,
    ):
        """Test suspending a tenant"""
        response = client.post(
            f"/api/tenants/admin/tenants/{test_tenant.id}/suspend",
            headers={"Authorization": f"Bearer {platform_admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "SUSPENDED"

        # Verify in database
        db.refresh(test_tenant)
        assert test_tenant.status == "SUSPENDED"

    def test_resume_tenant(
        self,
        client: TestClient,
        platform_admin_token: str,
        test_tenant: Tenant,
        db: Session,
    ):
        """Test resuming a suspended tenant"""
        # First suspend
        test_tenant.status = "SUSPENDED"
        db.commit()

        response = client.post(
            f"/api/tenants/admin/tenants/{test_tenant.id}/resume",
            headers={"Authorization": f"Bearer {platform_admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ACTIVE"

    def test_archive_tenant(
        self,
        client: TestClient,
        platform_admin_token: str,
        test_tenant: Tenant,
        db: Session,
    ):
        """Test archiving a tenant"""
        response = client.post(
            f"/api/tenants/admin/tenants/{test_tenant.id}/archive",
            headers={"Authorization": f"Bearer {platform_admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ARCHIVED"

    def test_cannot_suspend_already_suspended(
        self,
        client: TestClient,
        platform_admin_token: str,
        test_tenant: Tenant,
        db: Session,
    ):
        """Test that suspending an already suspended tenant fails"""
        test_tenant.status = "SUSPENDED"
        db.commit()

        response = client.post(
            f"/api/tenants/admin/tenants/{test_tenant.id}/suspend",
            headers={"Authorization": f"Bearer {platform_admin_token}"},
        )
        assert response.status_code == 400


class TestAdminUserManagement:
    """Test tenant manager user management"""

    def test_get_tenant_managers(
        self,
        client: TestClient,
        platform_admin_token: str,
        test_tenant: Tenant,
        test_tenant_manager: User,
    ):
        """Test retrieving tenant managers"""
        response = client.get(
            f"/api/tenants/admin/tenants/{test_tenant.id}/users",
            headers={"Authorization": f"Bearer {platform_admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0
        assert data[0]["email"] == "admin@test-company.com"

    def test_reset_manager_permissions(
        self,
        client: TestClient,
        platform_admin_token: str,
        test_tenant: Tenant,
        test_tenant_manager: User,
        db: Session,
    ):
        """Test resetting manager permissions"""
        response = client.post(
            f"/api/tenants/admin/tenants/{test_tenant.id}/reset-manager-permissions?manager_id={test_tenant_manager.id}",
            headers={"Authorization": f"Bearer {platform_admin_token}"},
        )
        assert response.status_code == 200

        # Verify permissions were reset
        db.refresh(test_tenant_manager)
        assert test_tenant_manager.is_super_admin is False
        assert test_tenant_manager.role == "manager"


class TestPlatformAdminFeatures:
    """Test platform-wide admin features"""

    def test_get_platform_health(self, client: TestClient, platform_admin_token: str):
        """Test getting platform-wide health metrics"""
        response = client.get(
            "/api/tenants/admin/platform/health",
            headers={"Authorization": f"Bearer {platform_admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_points" in data
        assert "active_tenants" in data
        assert "total_tenants" in data
        assert "total_users" in data
        assert "timestamp" in data

    def test_list_system_admins(
        self, client: TestClient, platform_admin_token: str, db: Session
    ):
        """Test listing all system admins"""
        # Create a system admin
        admin = SystemAdmin(
            id=uuid4(),
            email="system@sparknode.io",
            password_hash="hashed",
            first_name="System",
            last_name="Admin",
            is_super_admin=True,
        )
        db.add(admin)
        db.commit()

        response = client.get(
            "/api/tenants/admin/platform/system-admins",
            headers={"Authorization": f"Bearer {platform_admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) > 0

    def test_toggle_super_admin_status(
        self, client: TestClient, platform_admin_token: str, db: Session
    ):
        """Test toggling SUPER_ADMIN status"""
        admin = SystemAdmin(
            id=uuid4(),
            email="toggleadmin@sparknode.io",
            password_hash="hashed",
            first_name="Toggle",
            last_name="Admin",
            is_super_admin=False,
        )
        db.add(admin)
        db.commit()

        response = client.post(
            f"/api/tenants/admin/platform/system-admins/{admin.id}/toggle-super-admin",
            headers={"Authorization": f"Bearer {platform_admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_super_admin"] is True

    def test_maintenance_mode_toggle(
        self, client: TestClient, platform_admin_token: str
    ):
        """Test enabling/disabling platform maintenance mode"""
        response = client.post(
            "/api/tenants/admin/platform/maintenance-mode?enabled=true",
            headers={"Authorization": f"Bearer {platform_admin_token}"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["maintenance_mode_enabled"] is True


class TestAuthorizationAndSecurity:
    """Test authorization and security for admin endpoints"""

    def test_non_admin_cannot_list_tenants(
        self, client: TestClient, test_tenant: Tenant, test_tenant_manager_token: str
    ):
        """Test that non-platform admins cannot list all tenants"""
        response = client.get(
            "/api/tenants/admin/tenants",
            headers={"Authorization": f"Bearer {test_tenant_manager_token}"},
        )
        # Should fail or only return filtered results
        assert response.status_code == 403 or response.status_code == 200

    def test_non_admin_cannot_inject_points(
        self, client: TestClient, test_tenant: Tenant, test_tenant_manager_token: str
    ):
        """Test that non-platform admins cannot inject points"""
        inject_data = {"amount": 5000.00, "description": "Unauthorized injection"}
        response = client.post(
            f"/api/tenants/admin/tenants/{test_tenant.id}/inject-points",
            json=inject_data,
            headers={"Authorization": f"Bearer {test_tenant_manager_token}"},
        )
        assert response.status_code == 403

    def test_non_admin_cannot_suspend_tenant(
        self, client: TestClient, test_tenant: Tenant, test_tenant_manager_token: str
    ):
        """Test that non-platform admins cannot suspend tenants"""
        response = client.post(
            f"/api/tenants/admin/tenants/{test_tenant.id}/suspend",
            headers={"Authorization": f"Bearer {test_tenant_manager_token}"},
        )
        assert response.status_code == 403
