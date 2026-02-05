# Points Ledger UI - Developer Integration Guide

## Installation & Setup

### 1. Frontend Components

Ensure these files are created in your project:

```
frontend/src/components/
├── PointsLedgerComponents.jsx    (Helper components)
├── PointsAllocationDashboard.jsx (Main dashboard)
├── TenantManagerStats.jsx        (Stats component)
└── AllocationPanel.jsx           (Form component)
```

### 2. Backend API Endpoints

Create the ledger endpoints in your backend:

```
backend/points/
├── __init__.py
├── service.py         (Core service methods)
├── schemas.py         (Pydantic models)
├── routes.py          (API routes)
└── ledger.py          (Ledger API endpoints) ← NEW
```

### 3. Import the Dashboard

In your main app routing:

```javascript
// frontend/src/App.jsx
import PointsAllocationDashboard from './components/PointsAllocationDashboard';

// Add route
<Route path="/admin/points-ledger" element={<PointsAllocationDashboard />} />
```

## Backend Setup

### Install Ledger Routes

In `backend/points/routes.py`:

```python
from points import ledger

router = APIRouter(prefix="/api/v1/points", tags=["points"])

# Include ledger routes
router.include_router(ledger.router, prefix="/ledger")
```

### Database Requirements

Ensure your database has these tables:

```sql
-- Allocation logs table
CREATE TABLE allocation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    allocated_by VARCHAR(255),
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) DEFAULT 'INR',
    reference_note TEXT,
    status VARCHAR(50) DEFAULT 'COMPLETED',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Platform billing logs table
CREATE TABLE platform_billing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES users(id),
    tenant_id UUID REFERENCES tenants(id),
    amount NUMERIC(15, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    reference_note TEXT,
    transaction_type VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX idx_allocation_logs_tenant_id ON allocation_logs(tenant_id);
CREATE INDEX idx_allocation_logs_created_at ON allocation_logs(created_at);
CREATE INDEX idx_allocation_logs_status ON allocation_logs(status);
CREATE INDEX idx_platform_billing_logs_created_at ON platform_billing_logs(created_at);
```

## Frontend Integration

### Basic Usage

```javascript
import PointsAllocationDashboard from './components/PointsAllocationDashboard';

export default function AdminDashboard() {
  return (
    <div>
      <h1>Admin Dashboard</h1>
      <PointsAllocationDashboard />
    </div>
  );
}
```

### With Authentication

The dashboard automatically uses the current user's authentication context:

```javascript
// In PointsAllocationDashboard.jsx
const fetchAllocationLogs = async (page = 1) => {
  const response = await fetch(
    `/api/v1/points/ledger/allocation-logs?page=${page}`,
    {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      }
    }
  );
  // ...
}
```

### Custom Styling

Override Tailwind classes in your CSS:

```css
/* Override button styling */
.ledger-button {
  @apply px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700;
}

/* Override table styling */
.ledger-table {
  @apply w-full border-collapse;
}
```

## API Integration Examples

### Fetch and Display Allocation Logs

```javascript
const HistoryPage = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          '/api/v1/points/ledger/allocation-logs?page=1&limit=50&sort_order=desc'
        );
        const data = await response.json();
        setLogs(data.data.transactions);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  return (
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Tenant</th>
          <th>Amount</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {logs.map(log => (
          <tr key={log.id}>
            <td>{new Date(log.created_at).toLocaleDateString()}</td>
            <td>{log.tenant_name}</td>
            <td>{log.amount}</td>
            <td>{log.status}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
```

### Advanced Filtering

```javascript
const useAllocationLogs = (filters) => {
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({});

  useEffect(() => {
    const params = new URLSearchParams({
      page: filters.page || 1,
      limit: filters.limit || 25,
      ...(filters.status && { status: filters.status }),
      ...(filters.tenant_id && { tenant_id: filters.tenant_id }),
      ...(filters.dateFrom && { date_from: filters.dateFrom }),
      ...(filters.dateTo && { date_to: filters.dateTo }),
      ...(filters.minAmount && { min_amount: filters.minAmount }),
      ...(filters.maxAmount && { max_amount: filters.maxAmount }),
      ...(filters.search && { search: filters.search }),
    });

    fetch(`/api/v1/points/ledger/allocation-logs?${params}`)
      .then(r => r.json())
      .then(data => {
        setLogs(data.data.transactions);
        setPagination(data.data);
      });
  }, [filters]);

  return { logs, pagination };
};
```

### Real-time Stats

```javascript
const useLedgerStats = (tenantId) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const params = tenantId ? `?tenant_id=${tenantId}` : '';
        const response = await fetch(`/api/v1/points/ledger/stats${params}`);
        const data = await response.json();
        setStats(data.data);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [tenantId]);

  return { stats, loading };
};
```

## Common Customizations

### Change Pagination Limit

In `PointsAllocationDashboard.jsx`, update the fetch function:

```javascript
const fetchAllocationLogs = async (page = 1) => {
  const limit = 50; // Changed from 25
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    // ...
  });
  // ...
};
```

### Add Custom Filters

```javascript
// Add to LedgerFilter component
const [filters, setFilters] = useState({
  dateFrom: '',
  dateTo: '',
  statusFilter: 'all',
  minAmount: '',
  maxAmount: '',
  customField: '', // NEW FILTER
});

// In handleChange
const handleChange = (field, value) => {
  const newFilters = { ...filters, [field]: value };
  setFilters(newFilters);
  onFilterChange(newFilters);
};

// In render
<input
  placeholder="Custom Filter"
  value={filters.customField}
  onChange={(e) => handleChange('customField', e.target.value)}
/>
```

### Modify Table Columns

In `PointsAllocationDashboard.jsx`, update table headers and cells:

```javascript
<thead className="bg-gray-50 border-b">
  <tr>
    <th>Date</th>
    <th>Tenant</th>
    <th>Amount</th>
    <th>Reference</th>
    <th>Custom Column</th>  {/* NEW */}
    <th>Actions</th>
  </tr>
</thead>
<tbody>
  {allocationLogs.map(log => (
    <tr key={log.id}>
      <td>{formatDate(log.created_at)}</td>
      <td>{log.tenant_name}</td>
      <td>{log.amount}</td>
      <td>{log.reference_note}</td>
      <td>{log.custom_field}</td>  {/* NEW */}
      <td>View Details</td>
    </tr>
  ))}
</tbody>
```

## Error Handling

### Handle API Errors

```javascript
const fetchWithErrorHandling = async (url) => {
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      const error = await response.json();
      switch (response.status) {
        case 400:
          throw new Error(`Invalid request: ${error.detail}`);
        case 403:
          throw new Error('You do not have permission to view this');
        case 404:
          throw new Error('Resource not found');
        default:
          throw new Error(`Server error: ${response.statusText}`);
      }
    }
    
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    setError(error.message);
    return null;
  }
};
```

### Validation

```javascript
const validateFilters = (filters) => {
  const errors = {};

  if (filters.minAmount && filters.maxAmount) {
    if (parseFloat(filters.minAmount) > parseFloat(filters.maxAmount)) {
      errors.amount = 'Min amount must be less than max amount';
    }
  }

  if (filters.dateFrom && filters.dateTo) {
    if (new Date(filters.dateFrom) > new Date(filters.dateTo)) {
      errors.date = 'From date must be before to date';
    }
  }

  return errors;
};
```

## Testing

### Unit Test Example

```javascript
import { render, screen, fireEvent } from '@testing-library/react';
import { LedgerRow } from './PointsLedgerComponents';

describe('LedgerRow', () => {
  it('expands row when clicked', () => {
    const transaction = {
      id: '1',
      created_at: '2024-01-15',
      amount: 1000,
      status: 'COMPLETED',
      tenant_name: 'Test Tenant',
      reference_note: 'Test allocation'
    };

    const { rerender } = render(
      <LedgerRow transaction={transaction} isExpanded={false} onToggle={() => {}} />
    );

    // Initially collapsed
    expect(screen.queryByText('Transaction ID')).not.toBeInTheDocument();

    // After expansion
    rerender(
      <LedgerRow transaction={transaction} isExpanded={true} onToggle={() => {}} />
    );
    expect(screen.getByText('Transaction ID')).toBeInTheDocument();
  });
});
```

### Integration Test Example

```python
# backend/tests/test_ledger_api.py
import pytest
from fastapi.testclient import TestClient

def test_get_allocation_logs(client: TestClient, admin_user, test_tenant):
    # Create sample allocation log
    response = client.get(
        "/api/v1/points/ledger/allocation-logs",
        headers={"Authorization": f"Bearer {admin_user.token}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data['success'] is True
    assert 'transactions' in data['data']
    assert isinstance(data['data']['transactions'], list)

def test_allocation_logs_authorization(client: TestClient, regular_user):
    # Regular users should see only their tenant's data
    response = client.get(
        "/api/v1/points/ledger/allocation-logs",
        headers={"Authorization": f"Bearer {regular_user.token}"}
    )
    
    # Should be able to access (filtered to their tenant)
    assert response.status_code == 200

def test_billing_logs_admin_only(client: TestClient, regular_user):
    # Regular users cannot access billing logs
    response = client.get(
        "/api/v1/points/ledger/platform-billing-logs",
        headers={"Authorization": f"Bearer {regular_user.token}"}
    )
    
    assert response.status_code == 403
```

## Performance Optimization

### Enable Caching

```javascript
const useCachedLedgerData = (url, cacheTime = 5 * 60 * 1000) => {
  const [data, setData] = useState(null);
  const cacheRef = useRef({});

  useEffect(() => {
    const fetchData = async () => {
      const now = Date.now();
      const cached = cacheRef.current[url];

      if (cached && (now - cached.timestamp) < cacheTime) {
        setData(cached.data);
        return;
      }

      const response = await fetch(url);
      const result = await response.json();
      
      cacheRef.current[url] = {
        data: result,
        timestamp: now
      };
      
      setData(result);
    };

    fetchData();
  }, [url]);

  return data;
};
```

### Implement Debouncing

```javascript
const useDebounceSearch = (searchTerm, delay = 500) => {
  const [debouncedTerm, setDebouncedTerm] = useState(searchTerm);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedTerm(searchTerm);
    }, delay);

    return () => clearTimeout(handler);
  }, [searchTerm, delay]);

  return debouncedTerm;
};

// Usage
const debouncedSearch = useDebounceSearch(searchInput);
useEffect(() => {
  fetchAllocationLogs(1); // Only called when debounced term changes
}, [debouncedSearch]);
```

## Migration Path

If migrating from an old ledger system:

1. **Phase 1**: Deploy new API endpoints alongside old ones
2. **Phase 2**: Update frontend to fetch from new endpoints
3. **Phase 3**: Run migration job to populate new tables
4. **Phase 4**: Deprecate old endpoints (after verification period)
5. **Phase 5**: Remove old code

```python
# Migration script
def migrate_old_ledger_data():
    # Read from old_allocation_logs
    old_logs = db.query(OldAllocationLog).all()
    
    # Write to new allocation_logs table
    for log in old_logs:
        new_log = AllocationLog(
            tenant_id=log.tenant_id,
            allocated_by=log.allocated_by,
            amount=log.amount,
            currency=log.currency,
            reference_note=log.reference_note,
            status=log.status,
            created_at=log.created_at
        )
        db.add(new_log)
    
    db.commit()
```
