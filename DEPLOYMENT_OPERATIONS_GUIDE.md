# Points Allocation System - Deployment & Operations Guide

## Pre-Deployment Checklist

- [ ] Code review completed on all files
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Database backup taken (before migration)
- [ ] Staging environment tested
- [ ] Rollback plan documented
- [ ] Team notified of changes
- [ ] Documentation reviewed

---

## Deployment Steps

### Step 1: Database Migration

**Time Required**: ~5 minutes  
**Downtime**: None (migrations are non-blocking)

```bash
# Navigate to backend directory
cd /root/git-all-linux/perksu/backend

# Run migration
alembic upgrade 0003_points_allocation_system

# Verify migration successful
alembic current
# Output should show: 0003_points_allocation_system

# Verify tables created (in PostgreSQL)
psql -U perksu_user -d perksu_db -c "\dt allocation_logs platform_billing_logs"
psql -U perksu_user -d perksu_db -c "\d tenants" | grep points_allocation_balance
```

### Step 2: Backend Deployment

**Files to Deploy**:
```
backend/
├── models.py (UPDATED)
├── main.py (UPDATED)
├── recognition/routes.py (UPDATED)
└── points/ (NEW DIRECTORY)
    ├── __init__.py
    ├── service.py
    ├── schemas.py
    └── routes.py
```

**Steps**:
```bash
# 1. Pull code changes
git pull origin main

# 2. Install any new dependencies (if needed)
pip install -r backend/requirements.txt

# 3. Run tests
pytest backend/tests/

# 4. Restart backend service
# If using systemd:
sudo systemctl restart perksu-backend

# If using docker:
docker-compose -f docker-compose.yml up -d backend

# If manual:
# Kill existing process and restart
pkill -f "uvicorn main:app"
python -m uvicorn backend.main:app --reload --port 8000
```

### Step 3: Frontend Deployment

**Files to Deploy**:
```
frontend/src/components/
├── RewardsCatalog.jsx (UPDATED)
├── TenantManagerStats.jsx (NEW)
└── AllocationPanel.jsx (NEW)
```

**Steps**:
```bash
# 1. Navigate to frontend
cd frontend

# 2. Install dependencies
npm install

# 3. Build
npm run build

# 4. Deploy (depends on your hosting)
# If using Vercel: automatic
# If using Docker: docker-compose up -d frontend
# If using static hosting: copy dist/ to CDN/web server
```

### Step 4: Verification

```bash
# 1. Check backend health
curl http://localhost:8000/health

# 2. Test allocation endpoint
curl -X POST http://localhost:8000/api/v1/points/allocate-to-tenant \
  -H "Content-Type: application/json" \
  -d '{"tenant_id": "test-uuid", "amount": 1000}' \
  # Should return 401 (auth required) or 400 (invalid tenant)

# 3. Check database
psql -U perksu_user -d perksu_db -c "SELECT COUNT(*) FROM allocation_logs;"

# 4. Test frontend loads
curl http://localhost:3000/ | grep "TenantManagerStats"
```

---

## Rollback Plan

### If Something Goes Wrong

**Immediate Actions**:
1. **Do NOT allocate more points**
2. **Disable allocation endpoint** (see "Emergency Disable" below)
3. **Check error logs** (see "Troubleshooting" section)
4. **Contact on-call DBA**

### Rollback Database

```bash
cd backend
alembic downgrade 50f2b6a9e7c1

# Verify
alembic current
# Should NOT show 0003_points_allocation_system
```

### Rollback Code

```bash
# Revert to previous version
git revert HEAD~1 --no-edit
# OR
git checkout <previous-commit-hash> backend/ frontend/

# Restart services
docker-compose restart backend frontend
```

### Emergency Disable (Temporary)

If you need to quickly disable the new system without rolling back:

```python
# In backend/main.py, comment out the points router registration
# app.include_router(points_router, tags=["Points"])

# Then restart backend
docker-compose restart backend
```

This disables allocation endpoints but doesn't affect recognition (which has fallback logic).

---

## Post-Deployment Operations

### First 24 Hours

**Monitor**:
- Error logs for any exceptions
- Database connections and query performance
- API response times
- User complaints

**Test Allocations**:
```python
# Quick test
curl -X POST http://localhost:8000/api/v1/points/allocate-to-tenant \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "tenant_id": "'$TEST_TENANT_ID'",
    "amount": 10000,
    "reference_note": "Post-deployment test"
  }'
```

**Check Logs**:
```bash
# Docker logs
docker logs -f perksu-backend 2>&1 | grep -i "points\|allocation\|error"

# System logs
tail -f /var/log/perksu/backend.log
```

### Daily Operations

#### Check System Health
```sql
-- Run daily sanity checks
SELECT 
  COUNT(*) as total_tenants,
  SUM(budget_allocation_balance) as total_allocated_budget,
  MIN(budget_allocation_balance) as min_balance,
  MAX(budget_allocation_balance) as max_balance
FROM tenants;

-- Check for any anomalies
SELECT * FROM tenants WHERE budget_allocation_balance < 0; -- Should be empty

-- Check recent allocations
SELECT * FROM allocation_logs ORDER BY created_at DESC LIMIT 5;
```

#### Monitor Key Metrics
```sql
-- Allocation activity
SELECT 
  DATE(created_at) as date,
  COUNT(*) as allocation_count,
  SUM(amount) as total_allocated
FROM allocation_logs
GROUP BY DATE(created_at)
ORDER BY date DESC
LIMIT 30;

-- Tenant activity
SELECT 
  t.name,
  COUNT(al.id) as allocation_count,
  SUM(al.amount) as total_received,
  t.points_allocation_balance as current_balance
FROM tenants t
LEFT JOIN allocation_logs al ON t.id = al.tenant_id
GROUP BY t.id, t.name
ORDER BY t.points_allocation_balance DESC;
```

### Weekly Reporting

Generate reports for stakeholders:

```sql
-- Weekly allocation summary
SELECT 
  DATE_TRUNC('week', created_at) as week,
  COUNT(*) as allocations,
  SUM(amount) as total_points_allocated,
  COUNT(DISTINCT tenant_id) as tenants_allocated_to
FROM allocation_logs
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('week', created_at)
ORDER BY week DESC;

-- Top tenants by allocation
SELECT 
  t.name,
  t.points_allocation_balance,
  COUNT(al.id) as allocation_count,
  SUM(al.amount) as total_received
FROM tenants t
LEFT JOIN allocation_logs al ON t.id = al.tenant_id
GROUP BY t.id, t.name
ORDER BY SUM(al.amount) DESC
LIMIT 20;
```

---

## Troubleshooting

### Issue: Migration fails with "Column already exists"

**Cause**: Migration was partially run before

**Solution**:
```bash
# Check migration status
alembic current
alembic heads

# If stuck, check directly in DB
psql -c "\d tenants" | grep points_allocation_balance

# If column exists, mark migration as applied
# (consult Alembic docs for your version)
```

### Issue: Allocation endpoint returns 500 error

**Diagnosis**:
```bash
# Check logs
docker logs perksu-backend | tail -50

# Check database connectivity
psql -U perksu_user -d perksu_db -c "SELECT 1"

# Test service import
python -c "from points.service import PointsService; print('Import OK')"
```

### Issue: Balance not updating after allocation

**Check**:
```sql
-- Verify allocation_log was created
SELECT * FROM allocation_logs ORDER BY created_at DESC LIMIT 1;

-- Check if tenant exists
SELECT id, name, points_allocation_balance FROM tenants 
WHERE id = 'the-tenant-id';

-- Manually update (emergency only)
UPDATE tenants SET points_allocation_balance = 50000 WHERE id = 'the-tenant-id';
COMMIT;
```

### Issue: Recognition fails with "Insufficient allocation"

**Expected Behavior**: This is working as designed!

**To Fix**:
```bash
# Allocate more points to the tenant
curl -X POST http://localhost:8000/api/v1/points/allocate-to-tenant \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"tenant_id": "...", "amount": 100000}'
```

### Issue: Frontend component not showing

**Check**:
```bash
# Verify component files exist
ls -la frontend/src/components/TenantManagerStats.jsx
ls -la frontend/src/components/AllocationPanel.jsx

# Check browser console for errors
# Browser DevTools → Console tab

# Verify API endpoint
curl http://localhost:8000/api/v1/points/tenant-allocation-stats \
  -H "Authorization: Bearer $USER_TOKEN"
```

---

## Scaling & Performance

### Database Optimization

```sql
-- Add additional indexes if you have high volume
CREATE INDEX idx_allocation_logs_created_at 
  ON allocation_logs(created_at DESC);

CREATE INDEX idx_allocation_logs_status 
  ON allocation_logs(status) WHERE status = 'COMPLETED';

-- Analyze query performance
EXPLAIN ANALYZE
SELECT * FROM allocation_logs 
WHERE tenant_id = 'uuid' 
ORDER BY created_at DESC LIMIT 100;
```

### Caching Strategy

Frontend component refreshes every 30 seconds. For large deployments:

```python
# Add caching to allocation stats endpoint
from functools import lru_cache
from datetime import datetime, timedelta

@lru_cache(maxsize=100)
async def get_cached_stats(tenant_id: UUID, cache_key: str = None):
    # cache_key includes timestamp for 30-second invalidation
    return get_tenant_allocation_stats(tenant_id)
```

### Rate Limiting

```python
# Consider rate limiting allocation endpoint
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/allocate-to-tenant")
@limiter.limit("100/hour")  # 100 allocations per hour per IP
async def allocate_points_to_tenant(...):
    ...
```

---

## Maintenance Tasks

### Monthly

- [ ] Review allocation_logs for anomalies
- [ ] Check for any tenants with negative balance (should be 0)
- [ ] Review clawback logs
- [ ] Archive old allocation logs (>1 year) if needed

### Quarterly

- [ ] Review allocation patterns
- [ ] Identify high/low usage tenants
- [ ] Plan capacity for next quarter
- [ ] Review and update allocation policies

### Annually

- [ ] Full audit of all transactions
- [ ] Security review of authorization checks
- [ ] Performance optimization review
- [ ] Disaster recovery drill

---

## Emergency Procedures

### Runbook: Tenant Over-Allocated

**Symptom**: Tenant has 100,000 points but only should have 50,000

**Steps**:
1. Verify in database: `SELECT * FROM allocation_logs WHERE tenant_id = 'xxx' ORDER BY created_at;`
2. Identify erroneous allocation
3. Create adjustment: `UPDATE tenants SET points_allocation_balance = 50000 WHERE id = 'xxx';`
4. Create corrective entry in platform_billing_logs
5. Document in ticket
6. Notify finance team

### Runbook: System Refusing All Allocations

**Symptom**: All allocation requests return 500 error

**Steps**:
1. Check backend logs: `docker logs -f perksu-backend`
2. Verify database: `psql -c "SELECT 1"`
3. Check permissions: `SELECT * FROM system_admins WHERE id = 'admin-id';`
4. Restart backend: `docker-compose restart backend`
5. If persists, rollback to previous version

### Runbook: Points Lost or Negative Balance

**Symptom**: Tenant's balance is negative or points disappeared

**Steps**:
1. **STOP**: Don't allow more transactions until root cause found
2. Check transaction logs: `SELECT * FROM allocation_logs WHERE tenant_id = 'xxx' ORDER BY created_at;`
3. Check wallet ledger: `SELECT * FROM wallet_ledger WHERE tenant_id = 'xxx' ORDER BY created_at DESC;`
4. Identify the erroneous transaction
5. Decision:
   - If data corruption: Restore from backup
   - If code bug: Fix code and replay transactions
   - If user error: Document and adjust balance
6. Add corrective entry: `INSERT INTO platform_billing_logs ... ADJUSTMENT`

---

## Documentation & Knowledge Base

### Internal Wiki/Confluence

Create pages for:
- System architecture diagram
- API documentation
- Frequently asked questions
- Troubleshooting decision tree
- On-call runbooks
- Escalation procedures

### Example FAQs

**Q: How do I allocate points to a new tenant?**
A: Platform Admin uses `/allocate-to-tenant` endpoint or admin panel

**Q: What happens if a tenant's balance goes to zero?**
A: They cannot give new recognitions until balance is replenished

**Q: Can points be clawed back from individual users?**
A: No, only from the tenant's allocation pool. Individual wallets are permanent.

**Q: How long are allocation logs kept?**
A: Indefinitely (or per your data retention policy)

---

## Monitoring & Alerting

### Recommended Alerts

1. **Allocation Endpoint Errors**
   - Alert if >5 errors in 5 minutes
   - Severity: High

2. **Database Connection Issues**
   - Alert if cannot connect to allocation tables
   - Severity: Critical

3. **Unusual Allocation Amounts**
   - Alert if single allocation > $1,000,000 (adjust threshold)
   - Severity: Medium

4. **Balance Anomalies**
   - Alert if any tenant balance < 0 (should never happen)
   - Severity: Critical

### Example Prometheus Metrics

```yaml
# Track allocations
perksu_allocation_total{tenant_id=""} - counter
perksu_allocation_amount_sum{tenant_id=""} - gauge
perksu_allocation_errors_total - counter

# Track balances
perksu_tenant_allocation_balance{tenant_id=""} - gauge
perksu_wallet_balance{user_id=""} - gauge
```

---

## Support & Escalation

### Tier 1 (Frontend Dev)
- Verify component loads
- Check browser console
- Test API connectivity

### Tier 2 (Backend Dev)
- Check service logs
- Verify database state
- Debug business logic

### Tier 3 (Database Admin)
- Analyze query performance
- Check for locks/deadlocks
- Perform migrations

### Tier 4 (CTO/Director)
- Architectural decisions
- Data loss situations
- Major rollbacks

---

**Last Updated**: February 4, 2026  
**Maintained By**: Platform Team  
**Support Contact**: platform-team@perksu.com
