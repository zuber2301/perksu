# Points Allocation System - Quick Reference

## API Endpoints Quick Guide

### 1. Platform Admin - Allocate Points to Tenant
```bash
POST /api/v1/points/allocate-to-tenant

{
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "amount": 50000,
  "currency": "INR",
  "reference_note": "Monthly subscription - Invoice #8842"
}

# Response: 200 OK
{
  "success": true,
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "amount_allocated": "50000",
  "new_allocation_balance": "50000",
  "currency": "INR",
  "allocation_log_id": "...",
  "platform_log_id": "..."
}
```

### 2. Tenant Manager - View Allocation Stats
```bash
GET /api/v1/points/tenant-allocation-stats

# Response: 200 OK
{
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_name": "Triton Energy",
  "points_allocation_balance": "49000",
  "currency": "INR",
  "currency_label": "Points",
  "status": "ACTIVE",
  "message": "Ready to distribute. You have 49000 points available."
}
```

### 3. Tenant Manager - Award Points to User
```bash
POST /api/v1/points/award-to-user

{
  "to_user_id": "660e8400-e29b-41d4-a716-446655440001",
  "amount": 1000,
  "recognition_message": "Excellent project delivery and teamwork",
  "recognition_id": "optional-uuid-if-linked-to-recognition"
}

# Response: 200 OK
{
  "success": true,
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "to_user_id": "660e8400-e29b-41d4-a716-446655440001",
  "amount_awarded": "1000",
  "recipient_new_wallet_balance": "1000",
  "tenant_remaining_pool": "48000",
  "ledger_entry_id": "..."
}
```

### 4. Tenant Manager - Delegate to Lead
```bash
POST /api/v1/points/delegate-to-lead

{
  "lead_id": "770e8400-e29b-41d4-a716-446655440002",
  "amount": 10000,
  "delegation_note": "Q1 Department Budget"
}

# Response: 200 OK
{
  "success": true,
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "lead_id": "770e8400-e29b-41d4-a716-446655440002",
  "amount_delegated": "10000",
  "lead_new_balance": "10000",
  "tenant_remaining_balance": "38000"
}
```

### 5. Platform Admin - Clawback Allocation
```bash
POST /api/v1/points/clawback/550e8400-e29b-41d4-a716-446655440000

{
  "reason": "Subscription cancelled"
}

# Response: 200 OK
{
  "success": true,
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "amount_clawed_back": "38000",
  "new_balance": "0",
  "platform_log_id": "...",
  "reason": "Subscription cancelled"
}
```

## Error Responses

### 400 Bad Request - Insufficient Balance
```json
{
  "detail": "Insufficient company allocation pool. Available: 500, Required: 1000. Contact your Platform Admin."
}
```

### 403 Forbidden - Unauthorized
```json
{
  "detail": "Only Tenant Managers can delegate points to leads"
}
```

### 404 Not Found
```json
{
  "detail": "Tenant not found"
}
```

## Database Schema

### tenants table (updated)
```sql
ALTER TABLE tenants ADD COLUMN points_allocation_balance NUMERIC(15,2) NOT NULL DEFAULT 0;
ALTER TABLE tenants ADD CONSTRAINT positive_points_allocation_balance CHECK (points_allocation_balance >= 0);
```

### allocation_logs table (new)
```sql
CREATE TABLE allocation_logs (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  allocated_by UUID NOT NULL REFERENCES system_admins(id),
  amount NUMERIC(15,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  reference_note TEXT,
  status VARCHAR(50) DEFAULT 'COMPLETED',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### platform_billing_logs table (new)
```sql
CREATE TABLE platform_billing_logs (
  id UUID PRIMARY KEY,
  admin_id UUID NOT NULL REFERENCES system_admins(id),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  amount NUMERIC(15,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'INR',
  reference_note TEXT,
  transaction_type VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Frontend Components

### TenantManagerStats Component
Shows the allocation pool balance in a dashboard card
```jsx
import TenantManagerStats from './components/TenantManagerStats'

// In your dashboard
<TenantManagerStats />
```

**Features**:
- Auto-refreshes every 30 seconds
- Shows "Company Distribution Pool" balance
- Status messages (Ready, Low Balance, No Points)
- Info box explaining the system

### AllocationPanel Component
Platform Admin form to allocate points
```jsx
import AllocationPanel from './components/AllocationPanel'

// In your admin panel
<AllocationPanel 
  tenantId={tenant.id}
  tenantName={tenant.name}
  onAllocationSuccess={(data) => console.log(data)}
/>
```

### RewardsCatalog Updates
Now includes TenantManagerStats at the top
```jsx
<RewardsCatalog 
  vouchers={vouchers}
  onRedeem={onRedeem}
  showAllocationStats={true}  // Default: true
/>
```

## Python Service Usage

### In Your Backend Code
```python
from points.service import PointsService
from decimal import Decimal

# Allocate points
result = PointsService.allocateToTenant(
    db=db,
    tenant_id=tenant_uuid,
    admin_id=admin_uuid,
    amount=Decimal('50000'),
    currency='INR',
    reference_note='Invoice #8842'
)

# Award points
result = PointsService.awardToUser(
    db=db,
    tenant_id=tenant_uuid,
    from_user_id=from_uuid,
    to_user_id=to_uuid,
    amount=Decimal('1000'),
    recognition_message='Great work!',
    recognition_id=recognition_uuid
)

# Clawback
result = PointsService.clawbackAllocation(
    db=db,
    tenant_id=tenant_uuid,
    admin_id=admin_uuid,
    reason='Subscription cancelled'
)
```

## Flow Diagrams

### Simple Recognition Flow
```
User A recognizes User B with 1000 points
                ↓
Check: tenant.points_allocation_balance >= 1000
                ↓
Deduct from tenant.points_allocation_balance
                ↓
Add to User B's wallet.balance
                ↓
Create wallet_ledger entry
                ↓
User B can now redeem for rewards
```

### Complete Allocation Flow
```
Platform Admin
    ↓
POST /allocate-to-tenant
    ↓
Check: Admin permissions
    ↓
Update: tenant.points_allocation_balance += amount
Create: allocation_logs entry
Create: platform_billing_logs entry
    ↓
Tenant Manager sees "Available to Distribute: amount"
    ↓
Manager awards points to employees
    ↓
Each award: tenant.points_allocation_balance -= award_amount
           user.wallet.balance += award_amount
    ↓
Employees redeem wallet points for rewards
```

## Common Issues & Troubleshooting

### Issue: "Insufficient company allocation pool"
**Cause**: Tenant doesn't have enough points in allocation balance
**Solution**: Platform Admin needs to allocate more points using `/allocate-to-tenant`

### Issue: "Only Tenant Managers can award points"
**Cause**: User trying to award doesn't have right role
**Solution**: Check user's `org_role` - should be one of: `tenant_manager`, `hr_admin`, `tenant_lead`, `manager`

### Issue: Allocation pool is 0 but old recognition system works
**Cause**: Existing system may have fallback to wallet or budget allocation
**Solution**: This is expected - new system is layered on top. Both paths work.

### Issue: Recognition fails with allocation error
**Cause**: Tenant's allocation balance is 0 or insufficient
**Solution**: Contact Platform Admin to allocate more points to the tenant

## Testing the System

### Via cURL
```bash
# Allocate points
curl -X POST http://localhost:8000/api/v1/points/allocate-to-tenant \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "amount": 50000,
    "currency": "INR",
    "reference_note": "Test allocation"
  }'

# Get stats
curl http://localhost:8000/api/v1/points/tenant-allocation-stats \
  -H "Authorization: Bearer $USER_TOKEN"
```

### Via Python
```python
import requests

# Allocate
response = requests.post(
    'http://localhost:8000/api/v1/points/allocate-to-tenant',
    json={
        'tenant_id': 'uuid',
        'amount': 50000,
        'currency': 'INR'
    },
    headers={'Authorization': f'Bearer {token}'}
)
print(response.json())

# Get stats
response = requests.get(
    'http://localhost:8000/api/v1/points/tenant-allocation-stats',
    headers={'Authorization': f'Bearer {token}'}
)
print(response.json())
```

## Deployment Steps

1. **Run Alembic Migration**
   ```bash
   cd backend
   alembic upgrade 0003_points_allocation_system
   ```

2. **Restart Backend**
   ```bash
   # Stop current process
   # Restart with: python -m uvicorn main:app --reload
   ```

3. **Test Endpoints**
   - Use cURL or Postman to test allocate endpoint
   - Check allocation_logs table populated
   - Check platform_billing_logs table populated

4. **Verify Frontend**
   - Check TenantManagerStats displays correctly
   - Check AllocationPanel in admin panel
   - Check RewardsCatalog shows stats

---

**Last Updated**: February 4, 2026  
**System**: Perksu Employee Recognition Platform
