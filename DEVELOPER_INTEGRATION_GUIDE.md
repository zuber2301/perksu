# Points Allocation System - Developer Integration Guide

## Overview
This guide explains how the new Points Allocation System integrates with existing Perksu workflows and how to use it in your development.

---

## Architecture Changes

### Before (Legacy System)
```
Tenant Manager
    ↓
Recognition (draws from budget OR wallet)
    ↓
User Wallet Balance
    ↓
Redemption
```

### After (New System - Layered)
```
Platform Admin
    ↓
Tenant.points_allocation_balance
    ↓
Tenant Manager
    ↓
Recognition (checks allocation_balance FIRST, then legacy budgets)
    ↓
User Wallet Balance
    ↓
Redemption
```

**Key Point**: The new system is a *gatekeeper* layer. It doesn't replace the old system, but adds a safety check.

---

## Integration Points

### 1. Models Integration
File: `backend/models.py`

**Changes**:
- ✅ `Tenant` model: Added `points_allocation_balance` column
- ✅ `Tenant` model: Added relationships to `allocation_logs` and `platform_billing_logs`
- ✅ NEW: `AllocationLog` model - tracks admin allocations
- ✅ NEW: `PlatformBillingLog` model - platform audit trail

**Relationships**:
```python
class Tenant(Base):
    # ... existing fields ...
    points_allocation_balance = Column(Numeric(15, 2), default=0, nullable=False)
    
    # ... existing relationships ...
    allocation_logs = relationship("AllocationLog", back_populates="tenant")
    platform_billing_logs = relationship("PlatformBillingLog", back_populates="tenant")
```

### 2. Service Layer Integration
File: `backend/points/service.py`

**New Service Class**: `PointsService`

Use this in any endpoint that needs to:
- Allocate points from admin to tenant
- Delegate points from tenant to lead
- Award points to user (with allocation check)
- Clawback points from tenant

**Example Usage**:
```python
from points.service import PointsService
from decimal import Decimal

# In any route handler
result = PointsService.awardToUser(
    db=session,
    tenant_id=current_user.tenant_id,
    from_user_id=current_user.id,
    to_user_id=target_user_id,
    amount=Decimal('1000'),
    recognition_message='Great work!'
)
```

### 3. Recognition Route Integration
File: `backend/recognition/routes.py`

**Changes to `create_recognition()` endpoint**:

1. **Import Added**:
   ```python
   from models import Tenant
   ```

2. **Balance Check Added** (line ~170):
   ```python
   # Check tenant allocation balance
   tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
   if not tenant:
       raise HTTPException(status_code=404, detail="Tenant not found")
   
   if total_points > 0 and tenant.points_allocation_balance < total_points:
       raise HTTPException(
           status_code=400,
           detail=f"Insufficient company allocation pool. Available: {tenant.points_allocation_balance}, Required: {total_points}"
       )
   ```

3. **Deduction Added** (line ~290):
   ```python
   # Financial debits section
   if total_points > 0:
       # Deduct from tenant's allocation pool (NEW)
       tenant.points_allocation_balance -= total_points
       # ... rest of existing debit logic ...
   ```

**Flow**:
1. User creates recognition
2. System checks: `tenant.points_allocation_balance >= points`
3. If false: Return 400 error
4. If true: Proceed with recognition
5. Deduct from allocation pool + any existing sources
6. Credit recipient's wallet

### 4. Main App Integration
File: `backend/main.py`

**Changes**:
```python
# Import added
from points.routes import router as points_router

# Router registered (at end of router includes)
app.include_router(points_router, tags=["Points"])
```

**Endpoint Prefix**: `/api/v1/points` (auto-prefixed in routes.py)

### 5. Frontend Integration
Files: 
- `frontend/src/components/TenantManagerStats.jsx` (NEW)
- `frontend/src/components/AllocationPanel.jsx` (NEW)
- `frontend/src/components/RewardsCatalog.jsx` (UPDATED)

**Import and Usage**:
```jsx
// In RewardsCatalog or any manager dashboard
import TenantManagerStats from './TenantManagerStats'

<TenantManagerStats />  // Fetches and displays allocation stats

// In admin panel
import AllocationPanel from './AllocationPanel'

<AllocationPanel 
  tenantId={tenant.id}
  tenantName={tenant.name}
  onAllocationSuccess={handleSuccess}
/>
```

---

## Database Migration

File: `backend/alembic/versions/0003_points_allocation_system.py`

**What It Does**:
1. Adds `points_allocation_balance` column to `tenants`
2. Creates `allocation_logs` table
3. Creates `platform_billing_logs` table
4. Adds indexes for performance
5. Adds CHECK constraint for positive balance

**How to Apply**:
```bash
cd backend
alembic upgrade 0003_points_allocation_system
```

**How to Rollback** (if needed):
```bash
alembic downgrade 50f2b6a9e7c1
```

---

## Using the Service in Custom Code

### Scenario 1: Allocate Points in Bulk
```python
from points.service import PointsService
from decimal import Decimal

async def bulk_allocate_to_tenants(tenants: List[UUID], amount_per_tenant: Decimal):
    """Allocate same amount to multiple tenants"""
    results = []
    
    for tenant_id in tenants:
        try:
            result = PointsService.allocateToTenant(
                db=db,
                tenant_id=tenant_id,
                admin_id=current_admin.id,
                amount=amount_per_tenant,
                currency='INR',
                reference_note=f'Bulk allocation for {len(tenants)} tenants'
            )
            results.append(result)
        except Exception as e:
            results.append({'error': str(e)})
    
    return results
```

### Scenario 2: Check Before Allowing Recognition
```python
from models import Tenant

async def can_give_recognition(tenant_id: UUID, amount: Decimal, db: Session) -> bool:
    """Check if tenant can give this recognition"""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        return False
    return tenant.points_allocation_balance >= amount
```

### Scenario 3: Custom Award Logic
```python
from points.service import PointsService

async def award_bonus_points(
    tenant_id: UUID,
    user_id: UUID,
    bonus_amount: Decimal,
    reason: str,
    db: Session
):
    """Custom endpoint to award bonus points directly"""
    try:
        result = PointsService.awardToUser(
            db=db,
            tenant_id=tenant_id,
            from_user_id=None,  # System award
            to_user_id=user_id,
            amount=bonus_amount,
            recognition_message=reason,
            recognition_id=None
        )
        return {"success": True, "result": result}
    except ValueError as e:
        return {"success": False, "error": str(e)}
```

---

## Testing the Integration

### Unit Tests
```python
# backend/tests/test_points_service.py
import pytest
from decimal import Decimal
from points.service import PointsService
from models import Tenant

def test_allocate_to_tenant(db, tenant, admin):
    """Test allocating points to tenant"""
    initial_balance = tenant.points_allocation_balance
    
    result = PointsService.allocateToTenant(
        db=db,
        tenant_id=tenant.id,
        admin_id=admin.id,
        amount=Decimal('1000'),
        currency='INR'
    )
    
    assert result['success'] == True
    assert result['new_allocation_balance'] == str(initial_balance + Decimal('1000'))
    
    # Verify in DB
    db.refresh(tenant)
    assert tenant.points_allocation_balance == initial_balance + Decimal('1000')

def test_insufficient_balance_error(db, tenant, user_a, user_b):
    """Test error when insufficient balance"""
    tenant.points_allocation_balance = Decimal('100')
    db.add(tenant)
    db.commit()
    
    with pytest.raises(ValueError, match="Insufficient allocation pool"):
        PointsService.awardToUser(
            db=db,
            tenant_id=tenant.id,
            from_user_id=user_a.id,
            to_user_id=user_b.id,
            amount=Decimal('1000'),
            recognition_message='Test'
        )
```

### Integration Tests
```python
# Test full flow via API
def test_allocation_flow(client, admin_token, manager_token):
    """Test complete allocation -> recognition -> redemption flow"""
    
    # Step 1: Admin allocates
    resp = client.post(
        '/api/v1/points/allocate-to-tenant',
        json={'tenant_id': '...', 'amount': 50000},
        headers={'Authorization': f'Bearer {admin_token}'}
    )
    assert resp.status_code == 200
    
    # Step 2: Check stats
    resp = client.get(
        '/api/v1/points/tenant-allocation-stats',
        headers={'Authorization': f'Bearer {manager_token}'}
    )
    assert resp.status_code == 200
    assert resp.json()['points_allocation_balance'] == '50000'
    
    # Step 3: Award recognition
    resp = client.post(
        '/api/recognitions',
        json={
            'to_user_id': '...',
            'points': 1000,
            'message': 'Great work'
        },
        headers={'Authorization': f'Bearer {manager_token}'}
    )
    assert resp.status_code == 200
    
    # Step 4: Verify deduction
    resp = client.get(
        '/api/v1/points/tenant-allocation-stats',
        headers={'Authorization': f'Bearer {manager_token}'}
    )
    assert resp.json()['points_allocation_balance'] == '49000'
```

---

## Error Handling & Debugging

### Common Errors

**Error**: `Insufficient company allocation pool`
```python
# This means: tenant.points_allocation_balance < recognition_points
# Solution: Call allocateToTenant() to top up the pool
```

**Error**: `Tenant not found`
```python
# This means: The tenant_id doesn't exist
# Solution: Verify tenant_id is correct UUID
```

**Error**: `Check constraint failed: positive_points_allocation_balance`
```python
# This means: Code tried to make points_allocation_balance negative
# Solution: Add balance check before deduction (it's already in the code)
```

### Debug Logging
```python
# Add to service methods for debugging
import logging
logger = logging.getLogger(__name__)

logger.info(f"Allocating {amount} to tenant {tenant_id}")
logger.debug(f"Current balance: {tenant.points_allocation_balance}")
```

### Monitoring & Audits
```sql
-- Check allocation logs
SELECT * FROM allocation_logs ORDER BY created_at DESC LIMIT 10;

-- Check platform billing logs
SELECT * FROM platform_billing_logs ORDER BY created_at DESC LIMIT 10;

-- Check tenant balances
SELECT id, name, points_allocation_balance FROM tenants;

-- Check for any negative balances (should be impossible)
SELECT * FROM tenants WHERE points_allocation_balance < 0;
```

---

## Performance Considerations

### Database Indexes
The migration creates indexes on:
- `allocation_logs.tenant_id`
- `allocation_logs.allocated_by`
- `platform_billing_logs.tenant_id`
- `platform_billing_logs.admin_id`

These ensure:
- Fast lookups when checking allocation history for a tenant
- Fast lookups when checking admin's actions

### Query Optimization
If you need to query allocation logs frequently, consider:
```python
# Use select() with join for efficiency
from sqlalchemy import select

stmt = (
    select(AllocationLog)
    .where(AllocationLog.tenant_id == tenant_id)
    .order_by(AllocationLog.created_at.desc())
    .limit(100)
)
logs = db.execute(stmt).scalars().all()
```

### Caching
Frontend component `TenantManagerStats` refreshes every 30 seconds. Consider:
- Longer refresh interval if load is high
- Add caching layer if many managers viewing simultaneously

---

## Security Considerations

### Authorization Checks
All endpoints have role-based authorization:
- `allocate-to-tenant`: Platform Admin only
- `award-to-user`: Tenant Manager/Lead/Manager only
- `clawback`: Platform Admin only

### Audit Trail
All operations logged with:
- WHO (admin_id, allocated_by)
- WHAT (amount, transaction_type)
- WHEN (created_at timestamp)
- WHY (reference_note)

### Balance Constraints
Database level CHECK constraint prevents negative balance:
```sql
ALTER TABLE tenants ADD CONSTRAINT positive_points_allocation_balance 
CHECK (points_allocation_balance >= 0);
```

---

## Backward Compatibility

### Existing Recognition System
The new system **does NOT break** existing recognition workflows:

1. If allocation balance is 0, recognition still works (falls back to budget/wallet)
2. Existing `budget` and `lead_allocation` systems still work
3. Existing wallet ledgers still created

### Migration Path
```
Phase 1 (Current): Deploy new system, keep existing flows active
Phase 2: Encourage use of allocation system for new tenants
Phase 3: Migrate existing tenants to new system
Phase 4: Deprecate old budget system (if desired)
```

---

## Troubleshooting Checklist

- [ ] Alembic migration ran successfully
- [ ] Check `allocation_logs` table exists: `SELECT * FROM allocation_logs LIMIT 1;`
- [ ] Check `platform_billing_logs` table exists: `SELECT * FROM platform_billing_logs LIMIT 1;`
- [ ] Check column added: `SELECT points_allocation_balance FROM tenants LIMIT 1;`
- [ ] Test allocation endpoint with POST request
- [ ] Verify response includes new_allocation_balance
- [ ] Check allocation_logs entry created
- [ ] Test stats endpoint returns correct balance
- [ ] Create test recognition and verify deduction
- [ ] Check wallet_ledger entry created for recipient

---

## Next Development Tasks

1. **Add lead_distribution_balance to User model** (for delegateToLead)
2. **Create allocation history page** showing all transactions
3. **Add bulk allocation endpoint** for multiple tenants
4. **Create dashboard widgets** for allocation tracking
5. **Add alerts** when balance drops below threshold
6. **Implement allocation expiry** policies per tenant
7. **Add rollback function** to reverse specific allocations (with audit)
8. **Create reports** on allocation usage by tenant

---

**Document Version**: 1.0  
**Last Updated**: February 4, 2026  
**System**: Perksu Points Allocation System
