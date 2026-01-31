# Redemption System - Setup & Configuration Guide

## Quick Start

### 1. Backend Setup

#### Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

#### Database Migration
```bash
# Create redemption tables
alembic revision --autogenerate -m "Add redemption system"
alembic upgrade head
```

#### Environment Configuration
```bash
# backend/.env
DATABASE_URL=postgresql://user:password@localhost:5432/perksu_db

# OTP Configuration
OTP_EXPIRY_MINUTES=10
MAX_OTP_ATTEMPTS=3
OTP_RESEND_COOLDOWN_SECONDS=60

# Email Service
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# Voucher APIs
XOXODAY_API_KEY=your-xoxoday-key
XOXODAY_API_SECRET=your-xoxoday-secret
EGIFTING_API_KEY=your-egifting-key

# Logistics
SHIPWAY_API_KEY=your-shipway-key
```

#### Start Backend Server
```bash
python main.py
# API available at http://localhost:8000
# Docs at http://localhost:8000/docs
```

### 2. Frontend Setup

#### Install Dependencies
```bash
cd frontend
npm install
```

#### Environment Configuration
```bash
# frontend/.env
REACT_APP_API_URL=http://localhost:8000
REACT_APP_ENV=development
```

#### Start Development Server
```bash
npm run dev
# Available at http://localhost:5173
```

#### Build for Production
```bash
npm run build
# Output in dist/
```

---

## Component Integration

### Adding SparkNodeStore to App

```jsx
// frontend/src/App.jsx
import SparkNodeStore from './components/SparkNodeStore';
import RedemptionAdmin from './pages/RedemptionAdmin';

function App() {
  return (
    <Routes>
      {/* ... existing routes ... */}
      
      {/* User Routes */}
      <Route path="/store" element={<SparkNodeStore />} />
      <Route path="/redemptions/history" element={<RedemptionHistory />} />
      
      {/* Admin Routes */}
      <Route 
        path="/admin/redemption" 
        element={<ProtectedRoute><RedemptionAdmin /></ProtectedRoute>}
      />
    </Routes>
  );
}
```

### Adding to Navigation

```jsx
// frontend/src/components/Layout.jsx
export default function Layout() {
  return (
    <nav>
      {/* ... existing nav items ... */}
      <NavLink to="/store" icon="🎁">SparkNode Store</NavLink>
      
      {/* Admin only */}
      {user?.role === 'admin' && (
        <NavLink to="/admin/redemption" icon="⚙️">Redemption Center</NavLink>
      )}
    </nav>
  );
}
```

---

## Database Initialization

### Sample Voucher Data

```sql
-- Add Amazon voucher
INSERT INTO voucher_catalog (
  id, tenant_id, vendor_name, vendor_code,
  voucher_denomination, point_cost, markup_percentage,
  api_partner, status
) VALUES (
  uuid_generate_v4(),
  'tenant-uuid',
  'Amazon',
  'AMAZON_GV',
  500,
  450,
  5.0,
  'xoxoday',
  'active'
);

-- Add Swiggy voucher
INSERT INTO voucher_catalog (
  id, tenant_id, vendor_name, vendor_code,
  voucher_denomination, point_cost, markup_percentage,
  api_partner, status
) VALUES (
  uuid_generate_v4(),
  'tenant-uuid',
  'Swiggy',
  'SWIGGY_GV',
  500,
  420,
  10.0,
  'egifting',
  'active'
);
```

### Sample Merchandise Data

```sql
-- Add T-shirt
INSERT INTO merchandise_catalog (
  id, tenant_id, name, category,
  point_cost, markup_percentage, stock_quantity, status
) VALUES (
  uuid_generate_v4(),
  'tenant-uuid',
  'Premium Cotton T-Shirt',
  'apparel',
  800,
  15.0,
  50,
  'active'
);

-- Add Headphones
INSERT INTO merchandise_catalog (
  id, tenant_id, name, category,
  point_cost, markup_percentage, stock_quantity, status
) VALUES (
  uuid_generate_v4(),
  'tenant-uuid',
  'Wireless Bluetooth Headphones',
  'tech',
  2500,
  12.0,
  20,
  'active'
);
```

---

## API Configuration

### Xoxoday Integration

```python
# backend/redemption/external_apis.py

from xoxoday_sdk import XoxodayClient

class XoxodayIntegration:
    def __init__(self, api_key: str, api_secret: str):
        self.client = XoxodayClient(
            api_key=api_key,
            api_secret=api_secret
        )
    
    def order_voucher(self, vendor_code: str, denomination: int) -> dict:
        """
        Order a voucher from Xoxoday
        """
        response = self.client.vouchers.create(
            vendor_code=vendor_code,
            denomination=denomination,
            quantity=1,
            delivery_type="EMAIL"
        )
        return {
            "voucher_code": response['voucher_code'],
            "voucher_pin": response.get('voucher_pin'),
            "delivery_status": "SUCCESS"
        }
    
    def get_vendor_balance(self, vendor_code: str) -> float:
        """Get available credit balance for vendor"""
        response = self.client.vendors.get_balance(vendor_code)
        return float(response['balance'])
    
    def sync_vendor_balance(self, vendor_code: str) -> None:
        """Update vendor balance in database"""
        balance = self.get_vendor_balance(vendor_code)
        db.query(VoucherCatalog).filter(
            VoucherCatalog.vendor_code == vendor_code
        ).update({"vendor_balance": balance, "last_synced_at": datetime.utcnow()})
        db.commit()
```

### Email Service Integration

```python
# backend/auth/email_service.py

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

class EmailService:
    def __init__(self, smtp_server: str, smtp_port: int, 
                 username: str, password: str):
        self.smtp_server = smtp_server
        self.smtp_port = smtp_port
        self.username = username
        self.password = password
    
    async def send_otp(self, to_email: str, otp_code: str):
        """Send OTP to user email"""
        subject = "Your SparkNode Redemption OTP"
        body = f"""
        <html>
            <body>
                <h2>Redemption OTP</h2>
                <p>Your one-time password is:</p>
                <h1 style="color: #2563eb; font-size: 32px; letter-spacing: 5px;">
                    {otp_code}
                </h1>
                <p>This code is valid for 10 minutes.</p>
                <p style="color: #ef4444;">
                    Do not share this code with anyone.
                </p>
            </body>
        </html>
        """
        await self._send_email(to_email, subject, body)
    
    async def send_redemption_confirmation(self, to_email: str, 
                                          redemption_details: dict):
        """Send redemption confirmation"""
        subject = "Redemption Confirmed ✓"
        
        if redemption_details['item_type'] == 'VOUCHER':
            body = f"""
            <html>
                <body>
                    <h2>Your Voucher is Ready!</h2>
                    <p>Vendor: {redemption_details['vendor_name']}</p>
                    <p>Voucher Code: <strong>{redemption_details['voucher_code']}</strong></p>
                    <p>Denomination: ₹{redemption_details['denomination']}</p>
                </body>
            </html>
            """
        else:
            body = f"""
            <html>
                <body>
                    <h2>Your Order Placed!</h2>
                    <p>Item: {redemption_details['item_name']}</p>
                    <p>Tracking: {redemption_details.get('tracking_number', 'Coming soon')}</p>
                    <p>Delivering to: {redemption_details['address']}</p>
                </body>
            </html>
            """
        
        await self._send_email(to_email, subject, body)
    
    async def _send_email(self, to_email: str, subject: str, body: str):
        """Internal method to send email"""
        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = self.username
            msg["To"] = to_email
            msg.attach(MIMEText(body, "html"))
            
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                server.starttls()
                server.login(self.username, self.password)
                server.send_message(msg)
        except Exception as e:
            print(f"Failed to send email: {e}")
```

### Shipway Logistics Integration

```python
# backend/redemption/logistics.py

import requests

class ShipwayLogistics:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://apiv2.shipway.in"
    
    def create_shipment(self, order: dict) -> dict:
        """Create shipment in Shipway"""
        payload = {
            "order_id": str(order['id']),
            "length": 20,
            "breadth": 15,
            "height": 10,
            "weight": 1.0,
            "cod_amount": 0,
            "customer_name": order['delivery_details']['full_name'],
            "customer_email": order['user_email'],
            "customer_phone": order['delivery_details']['phone_number'],
            "pickup_postcode": "110001",  # Your warehouse pincode
            "delivery_postcode": order['delivery_details']['pincode'],
            "delivery_address": (
                f"{order['delivery_details']['address_line_1']}, "
                f"{order['delivery_details']['address_line_2']}, "
                f"{order['delivery_details']['city']}"
            ),
            "delivery_city": order['delivery_details']['city'],
            "delivery_state": order['delivery_details']['state']
        }
        
        response = requests.post(
            f"{self.base_url}/orders/create/",
            json=payload,
            headers={"Authorization": f"Bearer {self.api_key}"}
        )
        
        if response.status_code == 200:
            return {
                "success": True,
                "tracking_number": response.json()['order_id'],
                "courier": response.json()['courier']
            }
        else:
            return {"success": False, "error": response.text}
    
    def track_shipment(self, tracking_number: str) -> dict:
        """Get shipment status"""
        response = requests.get(
            f"{self.base_url}/orders/{tracking_number}/",
            headers={"Authorization": f"Bearer {self.api_key}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            return {
                "status": data['order_status'],
                "current_location": data.get('current_location', 'In transit'),
                "estimated_delivery": data.get('estimated_delivery_date')
            }
        return None
```

---

## Testing

### Unit Tests

```python
# backend/tests/test_redemption.py

import pytest
from datetime import datetime, timedelta
from models import Redemption, User, Wallet
from redemption.routes import generate_otp

@pytest.fixture
def test_user(db_session, tenant):
    user = User(
        tenant_id=tenant.id,
        email="test@example.com",
        first_name="Test",
        last_name="User",
        role="user"
    )
    db_session.add(user)
    db_session.commit()
    
    wallet = Wallet(
        user_id=user.id,
        tenant_id=tenant.id,
        balance=5000
    )
    db_session.add(wallet)
    db_session.commit()
    
    return user

def test_otp_generation():
    """Test OTP code generation"""
    otp = generate_otp()
    assert len(otp) == 6
    assert otp.isdigit()

def test_initiate_redemption(client, test_user, voucher):
    """Test redemption initiation"""
    response = client.post(
        "/api/redemption/initiate",
        json={
            "item_type": "VOUCHER",
            "item_id": str(voucher.id),
            "item_name": voucher.vendor_name,
            "point_cost": voucher.point_cost,
            "actual_cost": voucher.voucher_denomination
        },
        headers={"Authorization": f"Bearer {test_user.id}"}
    )
    
    assert response.status_code == 200
    assert "redemption_id" in response.json()

def test_verify_otp_success(client, test_user, redemption):
    """Test successful OTP verification"""
    response = client.post(
        f"/api/redemption/verify-otp",
        json={
            "redemption_id": str(redemption.id),
            "otp_code": redemption.otp_code
        },
        headers={"Authorization": f"Bearer {test_user.id}"}
    )
    
    assert response.status_code == 200
    assert response.json()["status"] == "OTP_VERIFIED"

def test_verify_otp_invalid(client, test_user, redemption):
    """Test invalid OTP verification"""
    response = client.post(
        f"/api/redemption/verify-otp",
        json={
            "redemption_id": str(redemption.id),
            "otp_code": "000000"
        },
        headers={"Authorization": f"Bearer {test_user.id}"}
    )
    
    assert response.status_code == 400
    assert "Invalid OTP" in response.json()["detail"]

def test_otp_expiry(client, test_user, redemption):
    """Test expired OTP"""
    # Set expiry to past
    redemption.otp_expires_at = datetime.utcnow() - timedelta(minutes=1)
    
    response = client.post(
        f"/api/redemption/verify-otp",
        json={
            "redemption_id": str(redemption.id),
            "otp_code": redemption.otp_code
        },
        headers={"Authorization": f"Bearer {test_user.id}"}
    )
    
    assert response.status_code == 400
    assert "OTP expired" in response.json()["detail"]
```

### Integration Tests

```bash
# Run all tests
pytest backend/tests/ -v

# Run specific test
pytest backend/tests/test_redemption.py::test_initiate_redemption -v

# Run with coverage
pytest backend/tests/ --cov=redemption
```

---

## Monitoring & Logging

### Application Logging

```python
# backend/config.py

import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/redemption.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# Usage in routes
logger.info(f"Redemption initiated by user {user_id}")
logger.error(f"OTP verification failed: {error}")
```

### Monitoring Queries

```sql
-- Check pending redemptions
SELECT id, user_id, item_name, status, created_at
FROM redemptions
WHERE status = 'PENDING'
ORDER BY created_at DESC;

-- Redemptions by vendor
SELECT vendor_name, COUNT(*) as count
FROM redemptions
WHERE item_type = 'VOUCHER'
GROUP BY vendor_name
ORDER BY count DESC;

-- Points spent today
SELECT SUM(point_cost) as total_points
FROM redemptions
WHERE DATE(created_at) = CURRENT_DATE;

-- Revenue from markups
SELECT SUM(markup_amount) as revenue
FROM redemptions
WHERE status IN ('COMPLETED', 'SHIPPED');
```

---

## Troubleshooting

### Common Issues

**Issue**: OTP not being sent
```
Solution:
1. Check SMTP configuration
2. Verify email credentials
3. Check spam folder
4. Review email service logs
5. Test with sendgrid CLI
```

**Issue**: Voucher code not generating
```
Solution:
1. Verify API credentials
2. Check vendor balance
3. Review Xoxoday API logs
4. Test API manually with curl
5. Check rate limits
```

**Issue**: Database connection failed
```
Solution:
1. Verify DATABASE_URL
2. Check PostgreSQL service running
3. Verify user credentials
4. Check network connectivity
5. Review pg_log
```

---

## Performance Optimization

### Database Indexing

```sql
-- Redemption queries
CREATE INDEX idx_redemption_user_status 
  ON redemptions(user_id, status);

CREATE INDEX idx_redemption_created_at 
  ON redemptions(created_at DESC);

-- Wallet queries
CREATE INDEX idx_wallet_balance 
  ON wallets(balance);

-- Voucher queries
CREATE INDEX idx_voucher_vendor_status 
  ON voucher_catalog(vendor_name, status);
```

### Caching Strategy

```python
# Use Redis for frequently accessed data
from redis import Redis

redis_client = Redis(host='localhost', port=6379, db=0)

def get_user_wallet_cached(user_id: UUID) -> dict:
    """Get user wallet with caching"""
    cache_key = f"wallet:{user_id}"
    
    # Try cache first
    cached = redis_client.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # Fetch from DB
    wallet = db.query(Wallet).filter(Wallet.user_id == user_id).first()
    
    # Cache for 5 minutes
    redis_client.setex(
        cache_key,
        300,
        json.dumps({"balance": wallet.balance})
    )
    
    return {"balance": wallet.balance}
```

---

## Deployment

### Docker Deployment

```dockerfile
# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
# Build and run
docker build -t perksu-redemption .
docker run -p 8000:8000 perksu-redemption
```

### Environment Variables

```env
# Production
ENVIRONMENT=production
LOG_LEVEL=INFO
JWT_ALGORITHM=HS256
JWT_EXPIRATION_HOURS=24

# Database
DATABASE_URL=postgresql://prod_user:secure_pass@prod_db:5432/perksu_prod
DATABASE_POOL_SIZE=20

# Security
SECRET_KEY=your-production-secret-key
CORS_ORIGINS=https://example.com

# External APIs
XOXODAY_API_KEY=${XOXODAY_API_KEY}
SHIPWAY_API_KEY=${SHIPWAY_API_KEY}
SMTP_PASSWORD=${SMTP_PASSWORD}
```

---

**Setup Complete!** Your Redemption System is ready for use.

For additional support, see REDEMPTION_SYSTEM.md
