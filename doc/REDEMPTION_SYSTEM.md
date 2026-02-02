# SparkNode Redemption System - Complete Documentation

## 📋 Table of Contents
1. [System Architecture](#system-architecture)
2. [Features](#features)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [User Flow](#user-flow)
6. [Admin Operations](#admin-operations)
7. [Security Implementation](#security-implementation)
8. [Integration Guide](#integration-guide)

---

## System Architecture

### Overview
The SparkNode Redemption System enables employees to convert earned points into:
- **Digital Vouchers** (instant delivery via email/SMS)
- **Physical Merchandise** (shipped to home address)

### Technology Stack
- **Backend**: FastAPI with SQLAlchemy ORM
- **Frontend**: React with Tailwind CSS
- **Database**: PostgreSQL
- **Authentication**: JWT + OTP-based verification
- **API Partners**: Xoxoday, EGifting (for voucher delivery)

### Architecture Diagram
```
User Interface (SparkNode Store)
        ↓
API Routes (Redemption System)
        ↓
Business Logic Layer
        ↓
ORM Models (SQLAlchemy)
        ↓
PostgreSQL Database
        ↓
External Services (Voucher APIs, Shipping)
```

---

## Features

### 1. **Digital Vouchers** 💳
- Instant delivery to user email
- Support for multiple vendors (Amazon, Swiggy, Zomato, BookMyShow, etc.)
- Configurable denominations
- API integration with voucher providers (Xoxoday, EGifting)
- Vendor balance tracking and auto-sync

### 2. **Physical Merchandise** 📦
- Product catalog with categories (apparel, tech, accessories, wellness, home)
- Stock management
- Address-based delivery
- Shipping partner integration
- Tracking number updates

### 3. **Security Features** 🔒
- **OTP Verification**: 6-digit code sent to registered email
- **Point Locking**: Points deducted only after OTP verification
- **Ledger Trail**: Complete audit trail of all redemption activities
- **Rate Limiting**: Prevent OTP brute force attacks
- **Multi-step Verification**: Confirmation → OTP → Delivery Details

### 4. **Admin Dashboard** 👨‍💼
- Real-time analytics and KPIs
- Pending request management
- Vendor balance monitoring
- Markup/convenience fee management
- Redemption ledger review

### 5. **Markup/Convenience Fees** 💰
- Configure % markup on each item
- Automatic calculation at redemption time
- Revenue tracking

---

## Database Schema

### Voucher Catalog
```sql
voucher_catalog
├── id (UUID, PK)
├── tenant_id (FK)
├── vendor_name (String)
├── vendor_code (String)
├── voucher_denomination (Integer) -- in INR
├── point_cost (Integer)
├── markup_percentage (Decimal)
├── api_partner (String) -- Xoxoday, EGifting
├── vendor_balance (Numeric) -- credit with vendor
├── status (String) -- active, inactive, soldout
└── timestamps
```

### Merchandise Catalog
```sql
merchandise_catalog
├── id (UUID, PK)
├── tenant_id (FK)
├── name (String)
├── description (Text)
├── category (String) -- apparel, tech, accessories, wellness, home
├── point_cost (Integer)
├── markup_percentage (Decimal)
├── stock_quantity (Integer)
├── image_url (String)
├── status (String)
└── timestamps
```

### Redemptions
```sql
redemptions
├── id (UUID, PK)
├── user_id (FK)
├── tenant_id (FK)
├── item_type (String) -- VOUCHER or MERCH
├── item_id (UUID)
├── item_name (String)
├── point_cost (Integer)
├── actual_cost (Numeric)
├── markup_amount (Numeric)
├── status (String) -- PENDING, OTP_VERIFIED, PROCESSING, COMPLETED, SHIPPED, FAILED
├── otp_code (String)
├── otp_expires_at (DateTime)
├── otp_verified_at (DateTime)
├── otp_attempts (Integer)
├── delivery_details (JSON) -- address, contact
├── voucher_code (String)
├── tracking_number (String)
├── failed_reason (Text)
└── timestamps
```

### Redemption Ledger (Audit Trail)
```sql
redemption_ledger
├── id (UUID, PK)
├── redemption_id (FK)
├── tenant_id (FK)
├── user_id (FK)
├── action (String) -- CREATED, OTP_VERIFIED, PROCESSING, COMPLETED, FAILED
├── status_before (String)
├── status_after (String)
├── metadata (JSON) -- additional context
├── created_by (UUID)
└── created_at (DateTime)
```

---

## API Endpoints

### Voucher Catalog Management

#### List Vouchers
```
GET /api/redemption/vouchers
Query Params:
  - status: "active" (default), "inactive", "soldout"
Response:
  [{
    id, vendor_name, voucher_denomination, point_cost,
    markup_percentage, status, image_url, ...
  }]
```

#### Get Single Voucher
```
GET /api/redemption/vouchers/{voucher_id}
Response: Voucher object
```

#### Create Voucher (Admin)
```
POST /api/redemption/vouchers
Body: {
  vendor_name, vendor_code, voucher_denomination,
  point_cost, markup_percentage, api_partner, image_url, status
}
Response: Created voucher object
```

#### Update Voucher (Admin)
```
PUT /api/redemption/vouchers/{voucher_id}
Body: Partial voucher fields
Response: Updated voucher object
```

---

### Merchandise Catalog Management

#### List Merchandise
```
GET /api/redemption/merchandise
Query Params:
  - category: "apparel", "tech", etc.
  - status: "active" (default), "inactive", "discontinued"
Response: [Merchandise objects]
```

#### Get Single Item
```
GET /api/redemption/merchandise/{merch_id}
Response: Merchandise object
```

#### Create Merchandise (Admin)
```
POST /api/redemption/merchandise
Body: {
  name, description, category, point_cost,
  markup_percentage, stock_quantity, image_url, status
}
Response: Created merchandise object
```

#### Update Merchandise (Admin)
```
PUT /api/redemption/merchandise/{merch_id}
Body: Partial merchandise fields
Response: Updated merchandise object
```

---

### User Redemption Flow

#### 1. Initiate Redemption
```
POST /api/redemption/initiate
Body: {
  item_type: "VOUCHER" | "MERCH",
  item_id: UUID,
  item_name: String,
  point_cost: Integer,
  actual_cost: Decimal
}
Response: {
  redemption_id: UUID,
  message: "OTP sent to...",
  otp_expires_in_minutes: 10
}
```

**Flow**:
1. User selects item to redeem
2. System checks wallet balance
3. Generates 6-digit OTP
4. Sends OTP via email
5. Holds redemption request in PENDING state
6. Points NOT deducted yet

#### 2. Verify OTP
```
POST /api/redemption/verify-otp
Body: {
  redemption_id: UUID,
  otp_code: String (6 digits)
}
Response: {
  redemption_id: UUID,
  status: "OTP_VERIFIED",
  message: "..."
}
```

**Flow**:
1. User enters OTP
2. System validates:
   - OTP matches
   - OTP not expired (10 min)
   - Attempts < 3
3. **Points are DEDUCTED from wallet**
4. Transaction logged to wallet_ledger
5. Status changes to OTP_VERIFIED

#### 3. Submit Delivery Details
```
POST /api/redemption/delivery-details/{redemption_id}
Body: {
  // For merchandise only:
  full_name, phone_number, address_line_1, address_line_2,
  city, state, pincode, country
}
Response: Redemption object with status PROCESSING
```

**Flow** (For Vouchers):
- Email delivery address used automatically
- Status moves to PROCESSING
- Admin notified

**Flow** (For Merchandise):
- User provides shipping address
- All fields validated
- Status moves to PROCESSING
- Passed to fulfillment queue

#### 4. Get Redemption History
```
GET /api/redemption/history
Query Params:
  - page: 1 (default)
  - page_size: 20 (default)
Response: {
  items: [{id, item_name, status, created_at, ...}],
  total, page, page_size, total_pages
}
```

---

### Admin Operations

#### Get Pending Requests
```
GET /api/redemption/admin/requests
Query Params:
  - status: "PENDING" | "PROCESSING" | "SHIPPED" | "COMPLETED" | "FAILED"
Response: [
  {
    id, user_email, user_name, item_name, status,
    delivery_details, created_at, processed_at
  }
]
```

#### Update Redemption Request
```
PUT /api/redemption/admin/requests/{redemption_id}
Body: {
  status: "PROCESSING" | "SHIPPED" | "COMPLETED" | "FAILED",
  tracking_number?: String,
  failed_reason?: String
}
Response: Updated redemption object
```

**Status Workflow**:
```
PROCESSING → SHIPPED (with tracking_number)
         ↓
      COMPLETED

       OR
       
    FAILED (with failed_reason)
```

#### Get Vendor Balances
```
GET /api/redemption/admin/vendor-balance
Response: [
  {
    vendor_name, api_partner, current_balance,
    last_synced_at, total_redeemed, total_spent
  }
]
```

#### Get Analytics
```
GET /api/redemption/admin/analytics
Response: {
  total_redemptions: Integer,
  total_points_redeemed: Integer,
  total_revenue: Decimal,
  pending_requests: Integer,
  fulfilled_orders: Integer,
  top_items: [[name, count], ...]
}
```

#### Update Markup
```
PUT /api/redemption/admin/markup
Body: {
  item_type: "VOUCHER" | "MERCH",
  item_id: UUID,
  markup_percentage: Decimal (0-100)
}
Response: {message: "Markup updated successfully"}
```

---

## User Flow

### Step-by-Step Redemption Process

```
1. USER BROWSES CATALOG
   ├── Views available vouchers (digital)
   ├── Filters by vendor (Amazon, Swiggy, etc.)
   ├── Views available merchandise (physical)
   └── Filters by category (apparel, tech, etc.)

2. USER SELECTS ITEM
   ├── Checks current wallet balance
   ├── Confirms point cost vs available balance
   └── Clicks "Redeem Now"

3. SYSTEM DISPLAYS CONFIRMATION
   ├── Item name and details
   ├── Points cost breakdown
   ├── Convenience fee (if applicable)
   └── Security notice about OTP

4. USER CONFIRMS REDEMPTION
   ├── System initiates redemption
   ├── Status: PENDING
   ├── Points NOT deducted yet
   └── OTP generated and sent to email

5. USER ENTERS OTP
   ├── Enters 6-digit code
   ├── System validates OTP
   ├── Status: OTP_VERIFIED
   └── **POINTS DEDUCTED** from wallet

6a. IF VOUCHER:
    ├── Delivery details (email) auto-filled
    ├── Status: PROCESSING
    ├── Admin notified
    └── Voucher code generated by API partner

6b. IF MERCHANDISE:
    ├── User enters shipping address
    ├── System validates address
    ├── Status: PROCESSING
    └── Passed to fulfillment queue

7. ADMIN MANAGES ORDER
   ├── Reviews pending orders
   ├── Marks as SHIPPED with tracking
   └── Or marks as FAILED with reason

8. USER RECEIVES CONFIRMATION
   ├── Email confirmation of redemption
   ├── For voucher: Voucher code + instructions
   ├── For merchandise: Tracking number
   └── Visible in redemption history
```

---

## Admin Operations

### Daily Tasks

**Morning Check**:
```
1. Open Redemption Center dashboard
2. Review overnight redemptions (Overview tab)
3. Check pending requests (Requests tab)
4. Verify vendor balances (Vendors tab)
```

**Fulfillment**:
```
1. Go to Requests tab → Filter "PROCESSING"
2. For each merchandise order:
   ├── Print packing slip
   ├── Pick and pack item
   ├── Generate shipping label
   ├── Click "Update" → Set Status: SHIPPED
   ├── Enter tracking number
   └── System sends user tracking notification
```

**Vendor Management**:
```
1. Go to Vendors tab
2. Monitor vendor balances
3. Click "Sync Balance" to update from API partner
4. Alert admins if balance is low
5. Reconcile monthly statements
```

**Analytics Review**:
```
1. Go to Overview tab
2. Review KPIs:
   ├── Total redemptions count
   ├── Points redeemed (vs budget)
   ├── Revenue from markups
   ├── Pending vs fulfilled ratio
   └── Top items trending
3. Export report for management
```

### Configuration Tasks

**Adding New Voucher**:
```
1. Click "+ Add Voucher"
2. Enter vendor details:
   ├── Vendor name (Amazon, Swiggy, etc.)
   ├── Denomination (₹500, ₹1000, etc.)
   ├── Point cost
   ├── Markup % (0-100)
   ├── API partner (Xoxoday/EGifting)
   ├── Image URL
   └── Status (active)
3. Click Save
4. Vendor ready for users
```

**Adding New Merchandise**:
```
1. Click "+ Add Merchandise"
2. Enter product details:
   ├── Name and description
   ├── Category (apparel, tech, etc.)
   ├── Point cost
   ├── Markup %
   ├── Stock quantity
   ├── Image URL
   └── Status (active)
3. Click Save
4. Product ready for users
```

**Updating Markup**:
```
1. Go to any item (voucher/merchandise)
2. Click "Edit Markup"
3. Set new percentage (0-100)
4. Click Save
5. Applied to future redemptions immediately
```

---

## Security Implementation

### 1. **OTP-Based Verification** 🔐
- 6-digit random code
- 10-minute expiry
- Maximum 3 attempts
- Rate limiting to prevent brute force

### 2. **Point Locking Mechanism**
```
Timeline:
PENDING (OTP pending)
  ↓
OTP_VERIFIED (Points deducted)
  ↓
PROCESSING (Item being fulfilled)
  ↓
COMPLETED (Order complete)
```

**Key**: Points deducted ONLY after OTP verification, not at initiation.

### 3. **Audit Trail**
Every redemption action logged to `redemption_ledger`:
- Who initiated the redemption
- OTP verification timestamp
- Admin who updated status
- All status transitions
- IP addresses and user agents

### 4. **Wallet Transaction Logging**
Every point deduction creates a `wallet_ledger` entry:
- Transaction type: debit
- Source: redemption
- Reference: redemption_id
- Balance after transaction

### 5. **Multi-tenant Isolation**
- All queries filtered by `tenant_id`
- Users can only see their own redemptions
- Admins see only their tenant's data
- System admins can audit across tenants

### 6. **Error Handling**
```python
# Insufficient balance
if wallet.balance < point_cost:
    raise HTTPException(400, "Insufficient points")

# OTP expired
if datetime.utcnow() > redemption.otp_expires_at:
    redemption.status = "FAILED"
    raise HTTPException(400, "OTP expired")

# Max attempts exceeded
if redemption.otp_attempts >= 3:
    redemption.status = "FAILED"
    raise HTTPException(400, "Max attempts exceeded")
```

---

## Integration Guide

### 1. **Frontend Integration**

#### Add to Navigation
```jsx
// src/pages/Navigation.jsx
import SparkNodeStore from '../components/SparkNodeStore';

<Link to="/store">🎁 SparkNode Store</Link>
```

#### Add Routes
```jsx
// src/App.jsx
<Route path="/store" element={<SparkNodeStore />} />
<Route path="/admin/redemption" element={<RedemptionAdmin />} />
```

#### API Configuration
```js
// lib/api.js
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json'
  }
});
```

---

### 2. **Backend Integration**

#### Mount Routes
```python
# main.py
from redemption import routes as redemption_routes

app.include_router(redemption_routes.router)
```

#### Initialize Database
```bash
# Run migrations
alembic upgrade head
```

#### Environment Variables
```env
# .env
DATABASE_URL=postgresql://user:pass@localhost/perksu
JWT_SECRET_KEY=your-secret-key
OTP_EXPIRY_MINUTES=10
MAX_OTP_ATTEMPTS=3
API_XOXODAY_KEY=your-xoxoday-api-key
API_EGIFTING_KEY=your-egifting-api-key
```

---

### 3. **External API Integration**

#### Xoxoday Integration
```python
# backend/redemption/external_apis.py

class XoxodayVoucherAPI:
    def __init__(self, api_key):
        self.api_key = api_key
        self.base_url = "https://api.xoxoday.com/v1"
    
    def order_voucher(self, vendor_code, amount):
        """Order voucher from Xoxoday"""
        response = requests.post(
            f"{self.base_url}/vouchers/order",
            json={
                "vendor_code": vendor_code,
                "amount": amount
            },
            headers={"Authorization": f"Bearer {self.api_key}"}
        )
        return response.json()
    
    def get_balance(self, vendor_code):
        """Get available balance for vendor"""
        response = requests.get(
            f"{self.base_url}/vendors/{vendor_code}/balance",
            headers={"Authorization": f"Bearer {self.api_key}"}
        )
        return response.json()['balance']
```

#### Email/SMS Service Integration
```python
# backend/auth/email_service.py

async def send_otp_email(email: str, otp_code: str):
    """Send OTP code via email"""
    message = f"""
    Your SparkNode Redemption OTP: {otp_code}
    Valid for 10 minutes
    Do not share this code with anyone
    """
    # Using SendGrid, AWS SES, or similar
    await email_client.send(
        to=email,
        subject="Your Redemption OTP",
        body=message
    )
```

---

### 4. **Analytics & Reporting**

#### Custom Reports
```python
# backend/redemption/reports.py

def get_monthly_redemption_report(tenant_id: UUID, year: int, month: int):
    """Generate monthly redemption analytics"""
    redemptions = db.query(Redemption).filter(
        and_(
            Redemption.tenant_id == tenant_id,
            extract('year', Redemption.created_at) == year,
            extract('month', Redemption.created_at) == month
        )
    ).all()
    
    return {
        "total_count": len(redemptions),
        "total_points": sum(r.point_cost for r in redemptions),
        "total_revenue": sum(r.markup_amount for r in redemptions),
        "by_type": {
            "vouchers": len([r for r in redemptions if r.item_type == "VOUCHER"]),
            "merchandise": len([r for r in redemptions if r.item_type == "MERCH"])
        }
    }
```

---

## Best Practices

### For Users
1. ✅ Keep point balance checked before redeeming
2. ✅ Verify email address for OTP delivery
3. ✅ Don't share OTP codes
4. ✅ Review order confirmation after redemption
5. ✅ Save tracking numbers for merchandise orders

### For Admins
1. ✅ Review pending orders daily
2. ✅ Monitor vendor balances weekly
3. ✅ Keep shelf stock updated
4. ✅ Archive old requests monthly
5. ✅ Test fulfillment process regularly
6. ✅ Reconcile ledger entries monthly

### For Developers
1. ✅ Always validate `tenant_id` context
2. ✅ Log all redemption actions
3. ✅ Handle wallet transaction atomicity
4. ✅ Implement proper error messages
5. ✅ Test OTP expiry and retry logic
6. ✅ Monitor API partner rate limits

---

## Troubleshooting

### Issue: User doesn't receive OTP
```
1. Check email configuration
2. Verify user's email address in system
3. Check spam folder
4. Resend OTP
5. Use fallback SMS service
```

### Issue: Vendor balance not syncing
```
1. Verify API credentials
2. Check API partner service status
3. Review rate limits
4. Check network connectivity
5. Review API response logs
```

### Issue: Merchandise not delivered
```
1. Verify shipping address
2. Check courier status
3. Review fulfillment queue
4. Update tracking manually
5. Contact logistics partner
```

---

## Support & Escalation

For issues or feature requests:
1. Check this documentation first
2. Review error logs: `logs/redemption.log`
3. Contact platform admin
4. Create issue ticket with details

---

**Last Updated**: 2024
**Version**: 1.0.0
**Maintainer**: Platform Team
