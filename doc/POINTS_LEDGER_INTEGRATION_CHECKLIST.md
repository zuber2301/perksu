# Points Ledger UI - Integration Checklist

## Pre-Deployment Setup

### Database Setup
- [ ] Verify `allocation_logs` table exists
  ```sql
  SELECT * FROM allocation_logs LIMIT 1;
  ```
- [ ] Verify `platform_billing_logs` table exists
  ```sql
  SELECT * FROM platform_billing_logs LIMIT 1;
  ```
- [ ] Create recommended indexes:
  ```sql
  CREATE INDEX idx_allocation_logs_tenant_id ON allocation_logs(tenant_id);
  CREATE INDEX idx_allocation_logs_created_at ON allocation_logs(created_at);
  CREATE INDEX idx_allocation_logs_status ON allocation_logs(status);
  CREATE INDEX idx_platform_billing_logs_created_at ON platform_billing_logs(created_at);
  ```
- [ ] Verify `wallets` table has data
- [ ] Verify `tenants` table has data
- [ ] Verify `users` table has data

### Backend Setup
- [ ] Copy `backend/points/ledger.py` to project
- [ ] Update `backend/points/routes.py`:
  ```python
  from points import ledger
  router.include_router(ledger.router, prefix="/ledger")
  ```
- [ ] Verify imports in `ledger.py` are correct
- [ ] Test API endpoints are accessible:
  ```bash
  curl http://localhost:8000/api/v1/points/ledger/allocation-logs?page=1
  ```

### Frontend Setup
- [ ] Copy `PointsLedgerComponents.jsx` to `frontend/src/components/`
- [ ] Copy `PointsAllocationDashboard.jsx` to `frontend/src/components/`
- [ ] Copy `PointsLedger.jsx` to `frontend/src/components/` (optional standalone)
- [ ] Verify component imports are correct
- [ ] Add route to main App.jsx:
  ```javascript
  import PointsAllocationDashboard from './components/PointsAllocationDashboard';
  <Route path="/admin/points-ledger" element={<PointsAllocationDashboard />} />
  ```
- [ ] Verify Tailwind CSS is available
- [ ] Verify react-icons is installed:
  ```bash
  npm list react-icons
  ```

## API Testing

### Test Allocation Logs Endpoint
```bash
# Basic request
curl -X GET "http://localhost:8000/api/v1/points/ledger/allocation-logs?page=1" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected response code: 200
# Expected response format:
{
  "success": true,
  "data": {
    "transactions": [...],
    "total": number,
    "page": 1,
    "limit": 25,
    "pages": number
  }
}
```

- [ ] Response is valid JSON
- [ ] Status code is 200
- [ ] `success` is true
- [ ] `data.transactions` is an array
- [ ] Each transaction has required fields

### Test with Filters
```bash
# With status filter
curl -X GET "http://localhost:8000/api/v1/points/ledger/allocation-logs?status=COMPLETED" \
  -H "Authorization: Bearer YOUR_TOKEN"

# With date range
curl -X GET "http://localhost:8000/api/v1/points/ledger/allocation-logs?date_from=2024-01-01&date_to=2024-01-31" \
  -H "Authorization: Bearer YOUR_TOKEN"

# With search
curl -X GET "http://localhost:8000/api/v1/points/ledger/allocation-logs?search=quarterly" \
  -H "Authorization: Bearer YOUR_TOKEN"

# With amount range
curl -X GET "http://localhost:8000/api/v1/points/ledger/allocation-logs?min_amount=1000&max_amount=5000" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

- [ ] Status filter works (COMPLETED, PENDING, REVOKED)
- [ ] Date filter works (returns data in range)
- [ ] Search filter works (returns matching results)
- [ ] Amount filter works (min/max applied)

### Test Sorting
```bash
# Sort by created_at descending (default)
curl -X GET "http://localhost:8000/api/v1/points/ledger/allocation-logs?sort_by=created_at&sort_order=desc" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Sort by amount ascending
curl -X GET "http://localhost:8000/api/v1/points/ledger/allocation-logs?sort_by=amount&sort_order=asc" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

- [ ] Sort by created_at works
- [ ] Sort by amount works
- [ ] Ascending order works
- [ ] Descending order works

### Test Pagination
```bash
# Page 1
curl -X GET "http://localhost:8000/api/v1/points/ledger/allocation-logs?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Page 2
curl -X GET "http://localhost:8000/api/v1/points/ledger/allocation-logs?page=2&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

- [ ] Page 1 returns correct items
- [ ] Page 2 returns different items
- [ ] Limit parameter works
- [ ] Total count is correct
- [ ] Pages count is calculated correctly

### Test Other Endpoints
- [ ] `/api/v1/points/ledger/platform-billing-logs` returns data
- [ ] `/api/v1/points/ledger/wallet-ledger` returns data
- [ ] `/api/v1/points/ledger/stats` returns aggregated data

### Test Authorization
```bash
# As Platform Admin - should work
curl -X GET "http://localhost:8000/api/v1/points/ledger/platform-billing-logs" \
  -H "Authorization: Bearer ADMIN_TOKEN"

# As Regular User - should fail with 403
curl -X GET "http://localhost:8000/api/v1/points/ledger/platform-billing-logs" \
  -H "Authorization: Bearer USER_TOKEN"
```

- [ ] Platform Admin can view all logs
- [ ] Regular User gets 403 for platform-billing-logs
- [ ] Tenant Manager sees only tenant's data
- [ ] Users see only their own wallet

### Test Error Cases
```bash
# Invalid date format
curl -X GET "http://localhost:8000/api/v1/points/ledger/allocation-logs?date_from=01/01/2024" \
  -H "Authorization: Bearer YOUR_TOKEN"
# Expected: 400 Bad Request

# Invalid page number
curl -X GET "http://localhost:8000/api/v1/points/ledger/allocation-logs?page=0" \
  -H "Authorization: Bearer YOUR_TOKEN"
# Expected: 400 Bad Request

# Missing authentication
curl -X GET "http://localhost:8000/api/v1/points/ledger/allocation-logs"
# Expected: 401 Unauthorized
```

- [ ] Invalid date format returns 400
- [ ] Invalid page number returns 400
- [ ] Missing auth returns 401
- [ ] Error messages are descriptive

## Frontend Testing

### Component Rendering
- [ ] PointsAllocationDashboard renders without errors
- [ ] All 4 tabs are visible
- [ ] TenantManagerStats displays current balance
- [ ] AllocationPanel form is visible
- [ ] LedgerSummary shows statistics

### Allocation Logs Tab
- [ ] Table renders with data
- [ ] Rows have correct columns (Date, Tenant, Amount, Reference, Actions)
- [ ] Status badges display correctly (COMPLETED=green, PENDING=yellow, REVOKED=red)
- [ ] Rows are clickable/expandable
- [ ] Expanded rows show full transaction details
- [ ] Refresh button works
- [ ] Export button is visible and functional

### Billing Logs Tab
- [ ] Table renders with billing data
- [ ] Admin email and tenant name display correctly
- [ ] Rows are expandable
- [ ] Refresh button works

### Wallet Ledger Tab
- [ ] Table renders with wallet data
- [ ] User name and email display
- [ ] Current balance displays
- [ ] Status badge shows (ACTIVE/ZERO)
- [ ] Pagination works

### Filtering
- [ ] Status dropdown populates correctly
- [ ] Date pickers work
- [ ] Search input filters data
- [ ] Amount range inputs work
- [ ] Filters apply immediately
- [ ] Clear filters resets data

### Export Functionality
- [ ] CSV export button works
- [ ] JSON export button works
- [ ] File downloads correctly
- [ ] CSV has proper headers
- [ ] CSV escapes special characters
- [ ] JSON is valid and formatted

### Responsive Design
- [ ] Works on desktop (1920px)
- [ ] Works on tablet (768px)
- [ ] Works on mobile (375px)
- [ ] Table scrolls horizontally on small screens
- [ ] Buttons are touch-friendly

### Error Handling
- [ ] Network error shows friendly message
- [ ] 403 error shows "Not Authorized"
- [ ] 404 error shows "Not Found"
- [ ] Server error shows "Try again later"
- [ ] Loading state displays spinner

## Integration Testing

### Dashboard Flow
1. [ ] User navigates to `/admin/points-ledger`
2. [ ] Dashboard loads with Overview tab active
3. [ ] TenantManagerStats shows balance
4. [ ] AllocationPanel form is ready
5. [ ] User switches to Allocation Logs tab
6. [ ] Data loads and displays
7. [ ] User can expand rows
8. [ ] User can filter data
9. [ ] User can export data
10. [ ] User switches between tabs

### Complete Allocation Workflow
1. [ ] Admin enters allocation details in AllocationPanel
2. [ ] Admin clicks "Allocate"
3. [ ] Success toast displays
4. [ ] Dashboard auto-switches to Allocation Logs
5. [ ] New allocation appears in the table
6. [ ] Stats update to reflect new allocation

### Data Consistency
- [ ] Allocation logs match database records
- [ ] Billing logs match database records
- [ ] Wallet ledger shows current balances
- [ ] Stats calculations are correct
- [ ] Totals match sum of items

## Performance Testing

### Load Testing
```bash
# Test with 100 concurrent requests
ab -n 100 -c 10 "http://localhost:8000/api/v1/points/ledger/allocation-logs"
```

- [ ] Response time < 2 seconds
- [ ] No 500 errors
- [ ] Database connections are stable

### Pagination Performance
- [ ] Page 1 loads in < 500ms
- [ ] Page 100 loads in < 500ms
- [ ] Limit=100 still performs well
- [ ] Search doesn't cause timeouts

### Memory Usage
- [ ] Page doesn't grow memory usage over time
- [ ] Expanding/collapsing rows doesn't leak memory
- [ ] Multiple tab switches don't increase memory

## Documentation Review

- [ ] README references the ledger UI
- [ ] Quick reference guide is accurate
- [ ] Developer guide is complete
- [ ] Code has adequate comments
- [ ] API documentation is clear
- [ ] Examples are correct
- [ ] Authorization rules are documented

## Deployment

### Staging Deployment
- [ ] Code is reviewed and approved
- [ ] All tests pass
- [ ] Database migrations applied
- [ ] Environment variables set
- [ ] API endpoints accessible
- [ ] Frontend components load
- [ ] No console errors

### Production Deployment
- [ ] Staging tests completed successfully
- [ ] Database backup taken
- [ ] Rollback plan is ready
- [ ] Monitoring/alerts configured
- [ ] Team is notified
- [ ] Documentation is updated
- [ ] Users can access the feature

## Post-Deployment

- [ ] Monitor error logs for issues
- [ ] Monitor performance metrics
- [ ] Gather user feedback
- [ ] Check for any data inconsistencies
- [ ] Verify all endpoints are responsive
- [ ] Test with production data volume

## Rollback Plan (If Needed)

If issues occur:
1. [ ] Revert code to previous version
2. [ ] Drop new API endpoints
3. [ ] Remove frontend components
4. [ ] Notify stakeholders
5. [ ] Investigate issue
6. [ ] Fix and redeploy

## Sign-Off

- [ ] Development Complete: __________ (Date: __)
- [ ] Testing Complete: __________ (Date: __)
- [ ] Staging Approved: __________ (Date: __)
- [ ] Production Ready: __________ (Date: __)

## Notes

Use this space for any additional notes or issues discovered:

```
[Notes here]
```

---

**Document Version**: 1.0
**Last Updated**: 2024-01-15
**Next Review**: After first week of production deployment
