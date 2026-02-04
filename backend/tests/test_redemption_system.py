import pytest
from uuid import uuid4
from decimal import Decimal
from models import Tenant, User, Wallet, Notification, Feed, Redemption, WalletLedger
from auth.utils import get_password_hash
from tests.conftest import create_test_token

@pytest.fixture
def setup_redemption_data(db):
    # Cleanup previous data to avoid UNIQUE constraints in sqlite
    # Since the in-memory DB is shared across tests in a module
    from models import Department
    db.query(Notification).delete()
    db.query(Feed).delete()
    db.query(Redemption).delete()
    db.query(Wallet).delete()
    db.query(User).delete()
    db.query(Department).delete()
    db.query(Tenant).delete()
    db.commit()

    # Create Tenant
    suffix = uuid4().hex[:6]
    tenant = Tenant(
        id=uuid4(),
        name=f"Redemption Tech {suffix}",
        slug=f"redemption-tech-{suffix}",
        currency="INR",
        markup_percent=Decimal("10.0"), # 10% markup
        master_budget_balance=Decimal("5000.0"),
        master_budget_threshold=Decimal("100.0"),
        status="ACTIVE"
    )
    db.add(tenant)
    db.flush()

    # Create Department
    from models import Department
    dept = Department(id=uuid4(), tenant_id=tenant.id, name="Engineers")
    db.add(dept)
    db.flush()

    # Create Manager (Tenant Manager)
    manager = User(
        id=uuid4(),
        tenant_id=tenant.id,
        email="manager@redemption.com",
        password_hash=get_password_hash("password"),
        first_name="Manager",
        last_name="User",
        role="hr_admin",
        org_role="tenant_manager",
        department_id=dept.id,
        status="active"
    )
    db.add(manager)

    # Create Lead (Tenant Lead)
    lead = User(
        id=uuid4(),
        tenant_id=tenant.id,
        email="lead@redemption.com",
        password_hash=get_password_hash("password"),
        first_name="Lead",
        last_name="User",
        role="employee",
        org_role="tenant_lead",
        department_id=dept.id,
        manager_id=manager.id,
        status="active"
    )
    db.add(lead)

    # Create Employee (reporting to lead)
    employee = User(
        id=uuid4(),
        tenant_id=tenant.id,
        email="emp@redemption.com",
        password_hash=get_password_hash("password"),
        first_name="Emp",
        last_name="Loyee",
        role="employee",
        org_role="employee",
        department_id=dept.id,
        manager_id=lead.id,
        status="active"
    )
    db.add(employee)
    db.flush()

    # Create Wallets
    emp_wallet = Wallet(tenant_id=tenant.id, user_id=employee.id, balance=Decimal("2000.0"))
    db.add(emp_wallet)
    
    db.commit()

    return {
        "tenant": tenant,
        "manager": manager,
        "lead": lead,
        "employee": employee,
        "emp_wallet": emp_wallet
    }

def get_headers(user):
    token = create_test_token(user.id, user.tenant_id, user.role)
    return {"Authorization": f"Bearer {token}"}

def test_dynamic_catalog_filtering_and_markup(client, db, setup_redemption_data):
    user = setup_redemption_data["employee"]
    headers = get_headers(user)
    
    response = client.get("/api/redemptions/vouchers", headers=headers)
    assert response.status_code == 200
    data = response.json()
    
    # Should only see INR vouchers (Amazon.in, Swiggy)
    # Starbucks US ($) should be filtered out
    for item in data:
        assert item["currencyCode"] == "INR"
        # Check markup: Value 500 + 10% = 550
        if item["value"] == 500:
            assert item["pointsRequired"] == 550.0
        if item["value"] == 1000:
            assert item["pointsRequired"] == 1100.0

def test_markup_validation_in_initiation(client, db, setup_redemption_data):
    user = setup_redemption_data["employee"]
    headers = get_headers(user)
    
    # Attempt to redeem with invalid point_cost (less than markup)
    # Value 500, markup 10% -> Expected 550. Try to send 500.
    payload = {
        "item_type": "VOUCHER",
        "utid": "amz-in-500",
        "item_name": "Amazon ₹500",
        "point_cost": 500, # Missing markup
        "actual_cost": 500.0
    }
    response = client.post("/api/redemptions/initiate", json=payload, headers=headers)
    assert response.status_code == 400
    assert "Invalid point cost" in response.json()["detail"]

    # Correct points
    payload["point_cost"] = 550
    response = client.post("/api/redemptions/initiate", json=payload, headers=headers)
    assert response.status_code == 200
    assert "redemption_id" in response.json()

def test_recommend_voucher(client, db, setup_redemption_data):
    lead = setup_redemption_data["lead"]
    employee = setup_redemption_data["employee"]
    headers = get_headers(lead)
    
    # Lead recommends Starbucks (even if filtered for users, leads can recommend via utid)
    response = client.post(
        "/api/redemptions/vouchers/recommend?utid=sbux-us-10&brand_name=Starbucks",
        headers=headers
    )
    assert response.status_code == 200
    
    # Check notification for employee
    notif = db.query(Notification).filter(Notification.user_id == employee.id).first()
    assert notif is not None
    assert "Starbucks" in notif.message
    
    # Check feed
    feed = db.query(Feed).filter(Feed.actor_id == lead.id).first()
    assert feed is not None
    assert feed.event_type == "reward_recommendation"

def test_team_activity_view(client, db, setup_redemption_data):
    lead = setup_redemption_data["lead"]
    employee = setup_redemption_data["employee"]
    tenant = setup_redemption_data["tenant"]
    
    # Create a dummy redemption for employee
    redemption = Redemption(
        user_id=employee.id,
        tenant_id=tenant.id,
        item_type="VOUCHER",
        item_name="Swiggy ₹250",
        point_cost=275,
        actual_cost=250.0,
        status="COMPLETED"
    )
    db.add(redemption)
    db.commit()
    
    headers = get_headers(lead)
    response = client.get("/api/redemptions/team-activity", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    assert data[0]["user_name"] == employee.full_name
    assert "point_cost" not in data[0] # Privacy check

def test_redemption_pause(client, db, setup_redemption_data):
    user = setup_redemption_data["employee"]
    tenant = setup_redemption_data["tenant"]
    headers = get_headers(user)
    
    # Pause redemptions
    tenant.redemptions_paused = True
    db.commit()
    
    payload = {
        "item_type": "VOUCHER",
        "utid": "amz-in-500",
        "item_name": "Amazon ₹500",
        "point_cost": 550,
        "actual_cost": 500.0
    }
    response = client.post("/api/redemptions/initiate", json=payload, headers=headers)
    assert response.status_code == 400
    assert "paused" in response.json()["detail"]

def test_master_budget_threshold(client, db, setup_redemption_data):
    user = setup_redemption_data["employee"]
    tenant = setup_redemption_data["tenant"]
    headers = get_headers(user)
    
    # Set low balance
    tenant.master_budget_balance = Decimal("50.0") # Below 100.0 threshold
    db.commit()
    
    payload = {
        "item_type": "VOUCHER",
        "utid": "amz-in-500",
        "item_name": "Amazon ₹500",
        "point_cost": 550,
        "actual_cost": 500.0
    }
    response = client.post("/api/redemptions/initiate", json=payload, headers=headers)
    assert response.status_code == 400
    assert "low master account balance" in response.json()["detail"]

def test_white_labeling_filter(client, db, setup_redemption_data):
    user = setup_redemption_data["employee"]
    tenant = setup_redemption_data["tenant"]
    headers = get_headers(user)
    
    # Only enable Amazon
    tenant.enabled_rewards = ["amazon-in"]
    db.commit()
    
    response = client.get("/api/redemptions/vouchers", headers=headers)
    assert response.status_code == 200
    data = response.json()
    
    # Should only see Amazon items, Swiggy filtered out
    for item in data:
        assert "Amazon" in item["brandName"]
        assert "Swiggy" not in item["brandName"]

def test_redemption_full_flow_with_otp(client, db, setup_redemption_data):
    user = setup_redemption_data["employee"]
    wallet = setup_redemption_data["emp_wallet"]
    headers = get_headers(user)
    
    init_payload = {
        "item_type": "VOUCHER",
        "utid": "amz-in-500",
        "item_name": "Amazon ₹500",
        "point_cost": 550,
        "actual_cost": 500.0
    }
    # 1. Initiate
    resp = client.post("/api/redemptions/initiate", json=init_payload, headers=headers)
    assert resp.status_code == 200
    red_id = resp.json()["redemption_id"]
    
    # Get OTP from DB
    redemption = db.query(Redemption).filter(Redemption.id == red_id).first()
    otp = redemption.otp_code
    
    # 2. Verify OTP
    verify_payload = {"redemption_id": red_id, "otp_code": otp}
    resp = client.post("/api/redemptions/verify-otp", json=verify_payload, headers=headers)
    assert resp.status_code == 200
    
    # Points should be deducted
    db.refresh(wallet)
    assert wallet.balance == Decimal("1450.0") # 2000 - 550

    # 3. Submit Delivery Details
    delivery_payload = {"full_name": "Test User"} # VOUCHER usually only needs email, but we use full_name in schema?
    # Actually for VOUCHER it just uses current_user.email
    resp = client.post(f"/api/redemptions/delivery-details/{red_id}", json={}, headers=headers)
    assert resp.status_code == 200
    
    db.refresh(redemption)
    assert redemption.status == "PROCESSING"

def test_failed_redemption_refund_logic(db, setup_redemption_data):
    """
    Test the task logic for refunding.
    We'll call the logic directly since we can't easily trigger the celery task in isolation
    and expect it to run perfectly with our test DB session.
    """
    from redemption.tasks import issue_voucher_task
    from unittest.mock import patch, MagicMock
    
    employee = setup_redemption_data["employee"]
    tenant = setup_redemption_data["tenant"]
    wallet = setup_redemption_data["emp_wallet"]
    
    # Create a redemption that is in PROCESSING state
    # This assumes points were already deducted (wallet balance 1450)
    wallet.balance = Decimal("1450.0")
    redemption = Redemption(
        id=uuid4(),
        user_id=employee.id,
        tenant_id=tenant.id,
        item_type="VOUCHER",
        item_name="Amazon ₹500",
        point_cost=550,
        actual_cost=500.0,
        status="PROCESSING"
    )
    db.add(redemption)
    db.commit()
    
    # Mock the aggregator to fail
    with patch("redemption.tasks.get_aggregator_client") as mock_get:
        mock_client = MagicMock()
        mock_client.issue_voucher.return_value = {"status": "error", "message": "API Down"}
        mock_get.return_value = mock_client
        
        # We need to monkeypatch SessionLocal in the task to use our test DB
        with patch("redemption.tasks.SessionLocal", return_value=db):
             # Prevent closing the test db session
             original_close = db.close
             db.close = lambda: None 
             try:
                 issue_voucher_task(str(redemption.id))
             finally:
                 db.close = original_close
             
    db.refresh(redemption)
    db.refresh(wallet)
    
    assert redemption.status == "FAILED"
    # Points should be refunded
    assert wallet.balance == Decimal("2000.0")
    
    # Check ledger for reversal
    reversal = db.query(WalletLedger).filter(WalletLedger.source == "reversal").first()
    assert reversal is not None
    assert reversal.points == 550
