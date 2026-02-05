# Points Ledger UI - Quick Reference

## Dashboard Navigation

### Tabs Overview

| Tab | Purpose | Audience | Key Data |
|-----|---------|----------|----------|
| **Overview** | Allocation stats & forms | Platform Admin, Tenant Manager | Current pool balance, allocation form |
| **Allocation Logs** | Tenant allocation history | Platform Admin, Tenant Manager | All tenant allocations, status, reference |
| **Billing Logs** | Platform-level allocations | Platform Admin | Admin allocations, transaction type |
| **Wallet Ledger** | User wallet balances | All Users, Managers | User balances, status, totals |

## Quick API Reference

### Fetch Allocation Logs
```bash
GET /api/v1/points/ledger/allocation-logs?page=1&limit=25
GET /api/v1/points/ledger/allocation-logs?status=COMPLETED&date_from=2024-01-01
GET /api/v1/points/ledger/allocation-logs?search=quarterly
```

### Fetch Billing Logs
```bash
GET /api/v1/points/ledger/platform-billing-logs?page=1&limit=25
GET /api/v1/points/ledger/platform-billing-logs?admin_id=<uuid>
```

### Fetch Wallet Ledger
```bash
GET /api/v1/points/ledger/wallet-ledger?page=1&limit=25
GET /api/v1/points/ledger/wallet-ledger?user_id=<uuid>
```

### Get Statistics
```bash
GET /api/v1/points/ledger/stats
GET /api/v1/points/ledger/stats?tenant_id=<uuid>
```

## Filter Reference

### Status Filter
- `COMPLETED` - Successfully processed
- `PENDING` - Awaiting processing
- `REVOKED` - Clawed back (canceled)
- `all` - All statuses

### Sorting Options
- `created_at` - Transaction date (default)
- `amount` - Transaction amount
- `asc` / `desc` - Sort direction

### Date Format
Use `YYYY-MM-DD` format:
```
?date_from=2024-01-01&date_to=2024-01-31
```

## Component Structure

```
PointsAllocationDashboard (Main Dashboard)
├── Overview Tab
│   ├── TenantManagerStats (Display current balance)
│   └── AllocationPanel (Allocate points form)
├── Allocation Logs Tab
│   ├── LedgerSummary (Statistics cards)
│   ├── LedgerFilter (Advanced filters)
│   ├── LedgerRow × N (Transaction rows)
│   └── LedgerExportMenu (Export options)
├── Billing Logs Tab
│   └── Same structure as Allocation Logs
└── Wallet Ledger Tab
    └── Wallet table with user balances
```

## Common Tasks

### Task: View all allocations for a tenant
```javascript
const tenantId = "abc-123";
const response = await fetch(
  `/api/v1/points/ledger/allocation-logs?tenant_id=${tenantId}`
);
```

### Task: Find allocations from past 30 days
```javascript
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
const dateFrom = thirtyDaysAgo.toISOString().split('T')[0];

const response = await fetch(
  `/api/v1/points/ledger/allocation-logs?date_from=${dateFrom}`
);
```

### Task: Export allocations as CSV
1. Click "Allocation Logs" tab
2. Click "⬇ Export" button
3. Select "📊 Export as CSV"
4. File downloads automatically

### Task: Find high-value transactions
```javascript
const response = await fetch(
  `/api/v1/points/ledger/allocation-logs?min_amount=10000&sort_by=amount&sort_order=desc`
);
```

### Task: Find pending transactions
```javascript
const response = await fetch(
  `/api/v1/points/ledger/allocation-logs?status=PENDING`
);
```

## Response Format

### Transaction Object (Allocation/Billing)
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "tenant_name": "Company Name",
  "allocated_by": "admin@email.com",
  "amount": 1000.00,
  "currency": "INR",
  "reference_note": "Q1 2024 Allocation",
  "status": "COMPLETED",
  "created_at": "2024-01-15T10:30:00",
  "updated_at": "2024-01-15T10:30:00"
}
```

### Wallet Object
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "user_name": "John Doe",
  "user_email": "john@company.com",
  "current_balance": 2500.00,
  "points": 2500,
  "status": "ACTIVE"
}
```

### Stats Object
```json
{
  "total_allocated": 50000.00,
  "total_clawed_back": 5000.00,
  "total_in_wallets": 35000.00,
  "allocation_count": 150,
  "wallet_count": 100,
  "net_distributed": 45000.00
}
```

## Pagination Examples

### Page 1 (Default)
```
GET /api/v1/points/ledger/allocation-logs?page=1&limit=25
Returns items 1-25
```

### Page 2
```
GET /api/v1/points/ledger/allocation-logs?page=2&limit=25
Returns items 26-50
```

### Calculate Total Pages
```javascript
const pages = Math.ceil(total / limit);
```

### Navigate to Last Page
```javascript
const lastPage = Math.ceil(response.data.total / 25);
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No results showing | Check filters, try removing date range |
| Export button not working | Ensure you have data loaded first |
| Date filter not working | Verify format is YYYY-MM-DD |
| Slow pagination | Try limiting search with status filter |
| 403 Unauthorized | Check user role (Platform Admin only for billing logs) |

## Response Wrapper Format

All API responses follow this structure:
```json
{
  "success": true,
  "data": {
    "transactions": [],
    "total": 150,
    "page": 1,
    "limit": 25,
    "pages": 6
  }
}
```

## Status Code Reference

| Code | Meaning |
|------|---------|
| 200 | ✅ Success |
| 400 | ❌ Bad request (invalid params) |
| 403 | ❌ Forbidden (not authorized) |
| 404 | ❌ Not found |
| 500 | ❌ Server error |

## Performance Tips

1. **Use pagination**: Always specify `limit` parameter
2. **Filter early**: Use `status`, `date_from`, `date_to` to reduce results
3. **Sort on server**: Use `sort_by` instead of client-side sorting
4. **Search wisely**: Use `search` only after other filters narrow results
5. **Cache stats**: Ledger stats can be cached for 5 minutes

## Browser Compatibility

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Tab` | Navigate between fields |
| `Enter` | Submit form / Filter |
| `Escape` | Close modals |
| `Arrow keys` | Navigate pagination |
