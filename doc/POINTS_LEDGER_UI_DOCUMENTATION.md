# Points Ledger UI Documentation

## Overview

The Points Ledger UI provides a comprehensive transaction history and audit interface for the Points Allocation System. It enables Platform Admins, Tenant Managers, and Users to view, filter, sort, and export transaction data.

## Components

### 1. PointsLedgerComponents.jsx

Helper components for the ledger system:

#### LedgerRow Component
- **Purpose**: Display individual transaction rows with expand/collapse details
- **Props**:
  - `transaction` (object): Transaction data
  - `isExpanded` (boolean): Whether row is expanded
  - `onToggle` (function): Toggle expansion callback
  - `type` (string): 'allocation' or 'wallet'
- **Features**:
  - Status badges (visual indicators)
  - Date formatting
  - Expandable detail rows showing full transaction information
  - Type-specific display formatting

#### LedgerSummary Component
- **Purpose**: Display aggregated statistics
- **Props**:
  - `transactions` (array): Transaction data
  - `type` (string): 'allocation', 'billing', or 'wallet'
- **Displays**:
  - Total transactions count
  - Total amount (sum of all transactions)
  - Total credits (incoming)
  - Total debits (outgoing)

#### LedgerExportMenu Component
- **Purpose**: Export transaction data
- **Props**:
  - `transactions` (array): Data to export
  - `filename` (string): Base filename for export
- **Formats**:
  - CSV (comma-separated values)
  - JSON (structured data)
- **Features**:
  - Click-to-download functionality
  - Proper MIME type handling
  - Escape special characters in CSV

#### LedgerFilter Component
- **Purpose**: Advanced filtering options
- **Props**:
  - `onFilterChange` (function): Filter change callback
  - `type` (string): 'allocation' or 'wallet'
- **Filters**:
  - Date range (from/to)
  - Status (All, Completed, Pending, Revoked)
  - Amount range (min/max)

### 2. PointsAllocationDashboard.jsx

Main admin dashboard component:

#### Features
- **Tabbed Interface**: Four main sections
  - Overview (allocation stats + form)
  - Allocation Logs (tenant allocation history)
  - Billing Logs (platform-level allocations)
  - Wallet Ledger (user wallet balances)

- **Allocation Logs Tab**
  - View allocation transactions
  - Status badges (green=completed, yellow=pending, red=revoked)
  - Filter by status, date, search
  - Expand rows to see full details
  - Export as CSV/JSON
  - Paginated (25 items per page)
  - Refresh button

- **Billing Logs Tab**
  - Platform Admin allocations
  - Admin email and tenant mapping
  - Transaction type filtering
  - Date range filtering
  - Export capabilities

- **Wallet Ledger Tab**
  - User wallet balances
  - Status indicators (ACTIVE/ZERO)
  - Pagination and sorting
  - User email mapping
  - Current balance display

#### State Management
```javascript
{
  activeTab: string,                    // Current tab
  allocationLogs: array,               // Allocation log data
  billingLogs: array,                  // Billing log data
  walletLedger: array,                 // Wallet data
  expandedRows: Set,                   // Expanded row IDs
  loading: boolean,                    // Loading state
  error: string | null,                // Error message
  pagination: {                        // Pagination per tab
    allocation: { page, total, pages },
    billing: { page, total, pages },
    wallet: { page, total, pages }
  },
  filters: {                           // Filters per tab
    allocation: { statusFilter, search, dateFrom, dateTo },
    billing: { statusFilter, search, dateFrom, dateTo },
    wallet: { statusFilter, search }
  }
}
```

## API Endpoints

### 1. GET /api/v1/points/ledger/allocation-logs

Retrieve tenant allocation logs.

**Query Parameters**:
```
- tenant_id (string): Filter by tenant
- status (string): COMPLETED, PENDING, or REVOKED
- search (string): Search in reference_note or ID
- min_amount (float): Minimum amount
- max_amount (float): Maximum amount
- date_from (string): YYYY-MM-DD
- date_to (string): YYYY-MM-DD
- sort_by (string): created_at or amount
- sort_order (string): asc or desc
- page (integer): Page number (default: 1)
- limit (integer): Items per page (default: 25, max: 100)
```

**Response**:
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "uuid",
        "tenant_id": "uuid",
        "tenant_name": "string",
        "allocated_by": "email",
        "amount": 1000.00,
        "currency": "INR",
        "reference_note": "string",
        "status": "COMPLETED",
        "created_at": "2024-01-15T10:30:00",
        "updated_at": "2024-01-15T10:30:00"
      }
    ],
    "total": 150,
    "page": 1,
    "limit": 25,
    "pages": 6
  }
}
```

### 2. GET /api/v1/points/ledger/platform-billing-logs

Retrieve platform-level billing logs (Platform Admin only).

**Query Parameters**:
```
- admin_id (string): Filter by admin
- tenant_id (string): Filter by tenant
- transaction_type (string): Filter by type
- search (string): Search in reference_note
- min_amount (float): Minimum amount
- max_amount (float): Maximum amount
- date_from (string): YYYY-MM-DD
- date_to (string): YYYY-MM-DD
- sort_by (string): created_at or amount
- sort_order (string): asc or desc
- page (integer): Page number
- limit (integer): Items per page
```

**Response**:
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "uuid",
        "admin_id": "uuid",
        "admin_email": "admin@example.com",
        "tenant_id": "uuid",
        "tenant_name": "Tenant Name",
        "amount": 5000.00,
        "currency": "INR",
        "reference_note": "string",
        "transaction_type": "string",
        "created_at": "2024-01-15T10:30:00"
      }
    ],
    "total": 50,
    "page": 1,
    "limit": 25,
    "pages": 2
  }
}
```

### 3. GET /api/v1/points/ledger/wallet-ledger

Retrieve user wallet balances.

**Query Parameters**:
```
- user_id (string): Filter by user
- transaction_type (string): credit or debit
- search (string): Search in notes
- min_amount (float): Minimum balance
- max_amount (float): Maximum balance
- date_from (string): YYYY-MM-DD
- date_to (string): YYYY-MM-DD
- sort_by (string): created_at or points
- sort_order (string): asc or desc
- page (integer): Page number
- limit (integer): Items per page
```

**Response**:
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "uuid",
        "user_id": "uuid",
        "user_name": "John Doe",
        "user_email": "john@example.com",
        "current_balance": 2500.00,
        "currency": "INR",
        "points": 2500,
        "status": "ACTIVE"
      }
    ],
    "total": 100,
    "page": 1,
    "limit": 25,
    "pages": 4
  }
}
```

### 4. GET /api/v1/points/ledger/stats

Get aggregated statistics.

**Query Parameters**:
```
- tenant_id (string): Filter by tenant (Platform Admin only)
```

**Response**:
```json
{
  "success": true,
  "data": {
    "total_allocated": 50000.00,
    "total_clawed_back": 5000.00,
    "total_in_wallets": 35000.00,
    "allocation_count": 150,
    "wallet_count": 100,
    "net_distributed": 45000.00
  }
}
```

## Usage Examples

### View Allocation Logs
```javascript
const response = await fetch(
  '/api/v1/points/ledger/allocation-logs?page=1&limit=25&sort_order=desc'
);
const result = await response.json();
```

### Filter by Status and Date Range
```javascript
const params = new URLSearchParams({
  page: '1',
  limit: '25',
  status: 'COMPLETED',
  date_from: '2024-01-01',
  date_to: '2024-01-31',
  sort_by: 'amount',
  sort_order: 'desc'
});
const response = await fetch(`/api/v1/points/ledger/allocation-logs?${params}`);
```

### Search Transactions
```javascript
const params = new URLSearchParams({
  search: 'quarterly adjustment',
  page: '1'
});
const response = await fetch(`/api/v1/points/ledger/allocation-logs?${params}`);
```

### Export Data
```javascript
// In PointsAllocationDashboard component
const handleExport = (format) => {
  const csv = generateCSV(allocationLogs);
  downloadFile(csv, 'allocation-logs.csv', 'text/csv');
};
```

## Authorization

- **Platform Admin**: Full access to all logs and stats
- **Tenant Manager**: Can view allocation logs and wallet ledger for their tenant
- **User**: Can only view their own wallet balance

## Data Display

### Status Indicators
- 🟢 **COMPLETED**: Transaction successfully processed
- 🟡 **PENDING**: Transaction awaiting processing
- 🔴 **REVOKED**: Transaction was clawed back

### Amount Formatting
- Allocation logs: `+1000` (credit shown in green)
- Billing logs: `+5000` or `-1000` (signed)
- Wallet ledger: `2500` (current balance)

### Date Formatting
- List view: `Jan 15, 2024` (short format)
- Detail view: `January 15, 2024, 10:30 AM` (full format)

## Performance Considerations

1. **Pagination**: Default 25 items per page, max 100
2. **Indexing**: Database indexes on `tenant_id`, `created_at`, `status`
3. **Caching**: Ledger stats could be cached for 5 minutes
4. **Lazy Loading**: Expand details on demand (not pre-loaded)

## Error Handling

**Invalid Date Format**:
```json
{
  "status": 400,
  "detail": "Invalid date_from format. Use YYYY-MM-DD"
}
```

**Unauthorized Access**:
```json
{
  "status": 403,
  "detail": "Only Platform Admins can view billing logs"
}
```

**Not Found**:
```json
{
  "status": 404,
  "detail": "Tenant not found"
}
```

## Testing

### Unit Tests (Components)
```javascript
// Test LedgerRow expansion
fireEvent.click(toggleButton);
expect(detailsRow).toBeVisible();

// Test export functionality
fireEvent.click(exportButton);
await waitFor(() => expect(downloadFunction).toHaveBeenCalled());
```

### Integration Tests (API)
```python
# Test allocation logs retrieval
response = client.get(
    "/api/v1/points/ledger/allocation-logs?status=COMPLETED"
)
assert response.status_code == 200
assert len(response.json()['data']['transactions']) > 0

# Test authorization
response = client.get(
    "/api/v1/points/ledger/platform-billing-logs",
    headers={"Authorization": "Bearer user_token"}
)
assert response.status_code == 403
```

## Future Enhancements

1. **Real-time Updates**: WebSocket support for live updates
2. **Advanced Analytics**: Charts and graphs for trends
3. **Custom Date Ranges**: Preset ranges (Last 7 days, etc.)
4. **Batch Operations**: Bulk export/archive
5. **Audit Trail**: Track who viewed what data when
6. **Scheduled Reports**: Email reports to admins
7. **Data Retention Policy**: Archive old logs
