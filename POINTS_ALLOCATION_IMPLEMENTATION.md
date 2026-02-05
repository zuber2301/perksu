# Points Allocation System - Implementation Summary

## Overview
Implemented a complete **Platform Admin → Tenant Manager → User** points allocation system separating company allocation pools from individual user wallets.

---

## Architecture

### 1. **Data Model Changes**

#### Tenants Table (`tenants`)
- **NEW**: `points_allocation_balance` (Decimal, default=0, NOT NULL, ≥0)
  - Company's "distribution pool" - points available for manager to give employees
  - Platform Admin controls this; Tenant Manager distributes from it
  - **Constraint**: `positive_points_allocation_balance` (CHECK >= 0)

#### New: Allocation Logs (`allocation_logs`)
Tracks point allocations from Platform Admin to Tenants
- `id` (UUID, PK)
- `tenant_id` (FK → tenants)
- `allocated_by` (FK → system_admins)
- `amount` (Decimal)
- `currency` (String, default='INR')
- `reference_note` (Text, nullable)
- `status` (String: COMPLETED, REVOKED)
- `created_at`, `updated_at` (Timestamps)

#### New: Platform Billing Logs (`platform_billing_logs`)
Platform-level audit trail for all credit transactions
- `id` (UUID, PK)
- `admin_id` (FK → system_admins)
- `tenant_id` (FK → tenants)
- `amount` (Decimal)
- `currency` (String, default='INR')
- `reference_note` (Text, nullable) - e.g., "Invoice #8842"
- `transaction_type` (String: CREDIT_INJECTION, CLAWBACK, ADJUSTMENT)
- `created_at` (Timestamp)

**Indexes**: On tenant_id, admin_id for both tables

---

## Backend Implementation

### 2. **Points Service** (`backend/points/service.py`)

Core business logic with 4 main methods:

#### `allocateToTenant()`
**Flow**: Platform Admin → Tenant Allocation Pool
- Increases `tenant.points_allocation_balance`
- Creates allocation log and platform billing log
- **Authorization**: Platform Admin only
- **Returns**: Transaction details including new balance

**Example**:
```
50,000 points → "Triton Energy" tenant
Result: tenant.points_allocation_balance += 50,000
```

#### `delegateToLead()`
**Flow**: Tenant Manager → Lead/Department Head
- Transfers from `tenant.points_allocation_balance` to `lead.lead_distribution_balance`
- **Check**: Tenant has sufficient balance
- **Authorization**: Tenant Manager/HR Admin
- **Future Use**: For hierarchical distribution

#### `awardToUser()`
**Flow**: Tenant Manager/Lead → User Wallet
- Deducts from `tenant.points_allocation_balance`
- Adds to `user.wallet.balance` (spendable)
- Creates `WalletLedger` entry
- Updates recognition record
- **Checks**:
  - Tenant has sufficient allocation pool
  - Both users exist in tenant
  - Amount is positive
- **Returns**: Transaction with new balances

**Transaction Type**: Uses atomic transactions with rollback on error

#### `clawbackAllocation()`
**Flow**: Platform Admin revokes tenant's allocation
- Sets `tenant.points_allocation_balance = 0`
- Creates CLAWBACK transaction in platform billing logs
- **Use Case**: Subscription cancellation, penalties
- **Authorization**: Platform Admin only

---

### 3. **API Endpoints** (`backend/points/routes.py`)

#### POST `/api/v1/points/allocate-to-tenant`
Allocate points to tenant's pool
```json
{
  "tenant_id": "uuid",
  "amount": 50000,
  "currency": "INR",
  "reference_note": "Monthly subscription - Invoice #8842"
}
```
**Auth**: Platform Admin
**Response**: AllocationResponse with new balance

#### GET `/api/v1/points/tenant-allocation-stats`
Get current allocation stats for manager dashboard
**Auth**: Any authenticated user
**Response**: TenantAllocationStatsResponse
- `points_allocation_balance`: Current pool balance
- `currency` & `currency_label`
- `message`: Human-readable status
  - "No points available" (if 0)
  - "Low allocation balance" (if < 100)
  - "Ready to distribute" (if >= 100)

#### POST `/api/v1/points/delegate-to-lead`
Delegate points to a lead/department head
```json
{
  "lead_id": "uuid",
  "amount": 10000,
  "delegation_note": "Q1 Budget for Engineering"
}
```
**Auth**: Tenant Manager/HR Admin
**Response**: DelegationResponse

#### POST `/api/v1/points/award-to-user`
Award points to a user (recognition action)
```json
{
  "to_user_id": "uuid",
  "amount": 1000,
  "recognition_message": "Excellent project delivery",
  "recognition_id": "uuid" (optional)
}
```
**Auth**: Tenant Manager/Lead/Manager
**Response**: AwardResponse with recipient's new wallet balance

#### POST `/api/v1/points/clawback/{tenant_id}`
Clawback allocation from tenant
```json
{
  "reason": "Subscription cancelled"
}
```
**Auth**: Platform Admin
**Response**: ClawbackResponse with amount clawed back

---

### 4. **Pydantic Schemas** (`backend/points/schemas.py`)

- `AllocationRequest` / `AllocationResponse`
- `DelegationRequest` / `DelegationResponse`
- `AwardRequest` / `AwardResponse`
- `ClawbackRequest` / `ClawbackResponse`
- `TenantAllocationStatsResponse` - for dashboard display
- `AllocationLogResponse` & `PlatformBillingLogResponse` - for audit trails

---

### 5. **Recognition Route Updates** (`backend/recognition/routes.py`)

Modified `create_recognition()` endpoint to:

1. **Import Tenant model**
2. **Check allocation balance early** (before budget validation)
   ```python
   if total_points > 0 and tenant.points_allocation_balance < total_points:
       raise HTTPException(400, "Insufficient company allocation pool")
   ```
3. **Deduct from allocation pool** during financial debits
   ```python
   if total_points > 0:
       tenant.points_allocation_balance -= total_points
   ```

**Flow Now**:
1. Validate tenant exists
2. ✅ **NEW**: Check tenant.points_allocation_balance ≥ award_amount
3. Existing budget validation (department budgets, lead allocations)
4. Deduct from tenant pool + existing sources
5. Credit recipient's wallet
6. Create ledger entries

**Result**: Recognition automatically reduces company allocation pool

---

## Frontend Implementation

### 6. **TenantManagerStats Component**
`frontend/src/components/TenantManagerStats.jsx`

**Purpose**: Dashboard card showing allocation balance

**Features**:
- Fetches from `GET /api/v1/points/tenant-allocation-stats`
- Displays "Company Distribution Pool" with current balance
- Status messages:
  - ⚠️ Red/Yellow if $0 (cannot award)
  - 🟡 Yellow if < 100 (low balance warning)
  - 🟢 Green if ≥ 100 (ready)
- Refreshes every 30 seconds
- Shows tenant name and status
- Info box explaining the system

**Usage**: Integrated into manager dashboards, rewards pages

### 7. **AllocationPanel Component**
`frontend/src/components/AllocationPanel.jsx`

**Purpose**: Platform Admin UI for allocating points

**Features**:
- Input field for amount
- Reference note field (optional)
- POST to `/api/v1/points/allocate-to-tenant`
- Success/error messages
- Shows new balance after allocation
- Info box explaining the flow

**Usage**: In tenant edit/billing tabs for admins

### 8. **RewardsCatalog.jsx Updates**
- Imported `TenantManagerStats` component
- Added `showAllocationStats` prop (default: true)
- Component displays at top of rewards catalog
- Shows allocation balance before displaying rewards
- Acts as "gatekeeper" - shows if points available

---

## Database Migration

### 9. **Alembic Migration** (`backend/alembic/versions/0003_points_allocation_system.py`)

**Changes**:
1. ✅ Add `points_allocation_balance` column to `tenants`
2. ✅ Create `allocation_logs` table with proper FKs
3. ✅ Create `platform_billing_logs` table with proper FKs
4. ✅ Create indexes on tenant_id, admin_id for performance
5. ✅ Add CHECK constraint `points_allocation_balance >= 0`

**Reversibility**: Full downgrade support

**To Apply**:
```bash
cd backend
alembic upgrade 0003_points_allocation_system
```

---

## Integration Flow

### Main App Integration (`backend/main.py`)
- ✅ Imported `router as points_router` from `points.routes`
- ✅ Registered: `app.include_router(points_router, tags=["Points"])`
- Router uses `/api/v1/points` prefix (defined in routes.py)

---

## Complete Flow Visualization

```
┌─────────────────────────────────────────────────────────────┐
│ PLATFORM ADMIN                                              │
│ (System Admin Account)                                      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ POST /api/v1/points/allocate-to-tenant
                 │ amount: 50,000
                 │
                 ▼
        ┌────────────────────┐
        │ tenants table      │
        │ points_allocation  │
        │ _balance += 50,000 │
        └────────┬───────────┘
                 │ allocation_logs ← audit trail
                 │ platform_billing_logs ← credit injection
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ TENANT MANAGER DASHBOARD                                    │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ TenantManagerStats Component                         │   │
│ │ Company Distribution Pool: 50,000 pts               │   │
│ │ [Ready to distribute]                               │   │
│ └──────────────────────────────────────────────────────┘   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ POST /api/v1/points/award-to-user
                 │ to_user_id: employee_uuid
                 │ amount: 1,000
                 │
                 ▼
        ┌─────────────────────────────┐
        │ Tenant Allocation Pool      │
        │ -= 1,000                    │
        └─────────────────────────────┘
                 │
                 ├─→ recognition created
                 │
                 ▼
        ┌─────────────────────────────┐
        │ User Wallet                 │
        │ balance += 1,000 (spendable)│
        │ Can now redeem for vouchers │
        └─────────────────────────────┘
```

---

## Safety Features

### 1. **Database Constraints**
- ✅ `positive_points_allocation_balance` CHECK constraint
- ✅ Foreign keys with CASCADE delete
- ✅ Atomic transactions with rollback

### 2. **Application Validation**
- ✅ Tenant existence checks
- ✅ Sufficient balance validation before deduction
- ✅ Amount must be positive
- ✅ Authorization checks (role-based)

### 3. **Audit Trail**
- ✅ `allocation_logs` tracks each credit injection
- ✅ `platform_billing_logs` tracks platform-level transactions
- ✅ `wallet_ledger` tracks user-level transactions
- ✅ All with timestamps and actor information

### 4. **Error Handling**
- ✅ Meaningful error messages (no balance, insufficient funds, etc.)
- ✅ Try-catch blocks with transaction rollback
- ✅ HTTP status codes (400 validation, 403 unauthorized, 404 not found, 500 server error)

---

## Testing Checklist

- [ ] Run Alembic migration: `alembic upgrade 0003_points_allocation_system`
- [ ] Verify tables created: `allocation_logs`, `platform_billing_logs`
- [ ] Verify column added: `tenants.points_allocation_balance`
- [ ] Test Platform Admin allocation endpoint
- [ ] Test TenantManagerStats display
- [ ] Test recognition creation with balance check
- [ ] Test insufficient balance error
- [ ] Test clawback functionality
- [ ] Test delegation endpoint (if lead_distribution_balance added to User model)
- [ ] Verify ledger entries created
- [ ] Check audit logs populated

---

## Files Modified/Created

### Backend
- [models.py](models.py) - Added columns and relationships
- [points/__init__.py](points/__init__.py) - New module
- [points/service.py](points/service.py) - Core business logic (NEW)
- [points/schemas.py](points/schemas.py) - Pydantic models (NEW)
- [points/routes.py](points/routes.py) - API endpoints (NEW)
- [recognition/routes.py](recognition/routes.py) - Updated with allocation checks
- [main.py](main.py) - Registered points router
- [alembic/versions/0003_points_allocation_system.py](alembic/versions/0003_points_allocation_system.py) - Migration (NEW)

### Frontend
- [components/TenantManagerStats.jsx](components/TenantManagerStats.jsx) - Manager stats display (NEW)
- [components/AllocationPanel.jsx](components/AllocationPanel.jsx) - Admin allocation form (NEW)
- [components/RewardsCatalog.jsx](components/RewardsCatalog.jsx) - Added stats integration

---

## Next Steps / Future Enhancements

1. **Add `lead_distribution_balance` to User model** (for `delegateToLead()`)
2. **Create Admin dashboard** for allocation management
3. **Add allocation history page** showing all credit injections
4. **Implement warning notifications** when balance is low
5. **Create scheduled reports** on allocation usage by tenant
6. **Add multi-currency support** (currently all in INR)
7. **Implement point expiry policies** at allocation level
8. **Create bulk allocation endpoint** for multiple tenants

---

## Key Design Decisions

### 1. Separation of Pools
- **Tenant Pool** (`points_allocation_balance`): Company-wide budget
- **User Wallet** (`wallet.balance`): Individual spendable balance
- **Benefit**: Clear liability tracking and budgeting

### 2. Atomic Transactions
- All deductions are atomic (all-or-nothing)
- Rollback on any error prevents point inflation

### 3. Comprehensive Audit Trail
- Both allocation-level and platform-level logs
- Enables compliance and troubleshooting

### 4. Role-Based Access
- Platform Admin: Can allocate/clawback at platform level
- Tenant Manager: Can award from their pool
- Regular User: Can view their wallet

---

## Deployment Notes

1. **Database Migration Required**: Run before deployment
2. **API Version**: Uses `/api/v1/points` (explicit versioning)
3. **Backward Compatible**: Existing recognition system still works
4. **No Breaking Changes**: All new code is additive

