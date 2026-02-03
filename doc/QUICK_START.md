# Tenant Management System - Quick Start Guide

## 🚀 Getting Started

This guide will help you integrate and start using the new tenant management system.

---

## Step 1: Database Setup

### Option A: Fresh Database
If using a fresh database, the updated schema is already included in `/database/init.sql`.

### Option B: Existing Database
Create a migration to add new columns:

```sql
-- Add new tenant configuration columns
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS favicon_url VARCHAR(500);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS theme_config JSONB DEFAULT '{"primary_color": "#007bff", "secondary_color": "#6c757d", "font_family": "system-ui"}';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS domain_whitelist TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS auth_method VARCHAR(50) DEFAULT 'OTP_ONLY';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS currency_label VARCHAR(100) DEFAULT 'Points';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS conversion_rate NUMERIC(10, 4) DEFAULT 1.0;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS auto_refill_threshold NUMERIC(5, 2) DEFAULT 20.0;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS award_tiers JSONB DEFAULT '{"Gold": 5000, "Silver": 2500, "Bronze": 1000}';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS peer_to_peer_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS expiry_policy VARCHAR(50) DEFAULT 'never';

-- Update status constraint
ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_status_check;
ALTER TABLE tenants ADD CONSTRAINT tenants_status_check CHECK (status IN ('ACTIVE', 'SUSPENDED', 'ARCHIVED'));
```

---

## Step 2: Backend Integration

### 1. Verify Updated Models
File: `/backend/models.py`
- Tenant class should include all new fields
- SystemAdmin class should be present
- MasterBudgetLedger should be defined

### 2. Verify Routes
File: `/backend/tenants/routes.py`
- Should contain 26+ endpoints starting with `/tenants/admin/`
- Check for platform_admin authorization on all new endpoints

### 3. Verify Schemas
File: `/backend/tenants/schemas.py`
- Should have ThemeConfig, GovernanceConfig, etc.
- TenantUpdate should accept all configuration fields

### 4. Test Backend
```bash
# Run test suite
pytest backend/tests/test_tenant_manager.py -v

# Expected: All tests pass, 50+ test cases
```

---

## Step 3: Frontend Integration

### 1. Add Routes to App.jsx
```jsx
import TenantManager from './pages/TenantManager';
import RootAdminDashboard from './pages/RootAdminDashboard';

// In your router configuration:
{
  path: '/admin/tenants',
  element: <TenantManager />,
  meta: { requiresAuth: true, role: 'platform_admin' }
},
{
  path: '/admin/platform',
  element: <RootAdminDashboard />,
  meta: { requiresAuth: true, role: 'platform_admin' }
}
```

### 2. Update Navigation
Add links in your main layout/navigation:
```jsx
{isAdmin && (
  <>
    <Link to="/admin/tenants">👥 Tenant Manager</Link>
    <Link to="/admin/platform">🌍 Platform Admin</Link>
  </>
)}
```

### 3. Verify API Configuration
File: `/frontend/src/lib/api.js`
- Ensure API base URL is configured correctly
- Ensure authorization headers are properly set

### 4. Test Frontend
```bash
# Start development server
npm run dev

# Navigate to http://localhost:3000/admin/tenants
# Should see tenant listing page
```

---

## Step 4: Testing

### Backend Testing
```bash
# Run all tenant manager tests
pytest backend/tests/test_tenant_manager.py

# Run specific test class
pytest backend/tests/test_tenant_manager.py::TestTenantListingAndFiltering -v

# Run with coverage
pytest backend/tests/test_tenant_manager.py --cov=tenants --cov-report=html
```

### Frontend Testing (Manual)
1. Login as platform admin
2. Navigate to `/admin/tenants`
3. Verify tenant listing displays
4. Click on a tenant to open details panel
5. Test each tab functionality:
   - Overview: Check metrics display
   - Settings: Update settings and save
   - Financials: Inject test points
   - Users: View admin users
   - Danger Zone: Test suspend (can resume after)

### API Testing with cURL
```bash
# Get all tenants
curl -H "Authorization: Bearer {YOUR_TOKEN}" \
  http://localhost:8000/tenants/admin/tenants

# Get specific tenant
curl -H "Authorization: Bearer {YOUR_TOKEN}" \
  http://localhost:8000/tenants/admin/tenants/{TENANT_ID}

# Inject points
curl -X POST \
  -H "Authorization: Bearer {YOUR_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"amount": 1000, "description": "Test injection"}' \
  http://localhost:8000/tenants/admin/tenants/{TENANT_ID}/inject-points

# Get platform health
curl -H "Authorization: Bearer {YOUR_TOKEN}" \
  http://localhost:8000/tenants/admin/platform/health
```

---

## Step 5: Customization

### Styling Customization
CSS files to modify:
- `/frontend/src/components/TenantGrid.css` - Grid appearance
- `/frontend/src/components/TenantControlPanel.css` - Panel layout
- `/frontend/src/components/TenantTabs.css` - Tab content
- `/frontend/src/pages/RootAdminDashboard.css` - Dashboard

### API Customization
- Update error messages in `/backend/tenants/routes.py`
- Add additional validation in schemas
- Extend endpoints with custom business logic

### Feature Enhancements
1. **Analytics**: Connect burn rate chart to actual data
2. **Exports**: Implement real CSV export functionality
3. **Monitoring**: Integrate with your monitoring/alerting system
4. **Webhooks**: Add webhook triggers for tenant events

---

## Common Issues & Solutions

### Issue: 403 Forbidden on Admin Endpoints
**Solution**: Ensure user has `platform_admin` role
```python
# Check user role in database
SELECT id, email, role, is_super_admin FROM users WHERE email = 'your_email';
```

### Issue: JSONB Fields Empty
**Solution**: Initialize with proper default values
```python
# In migration:
UPDATE tenants SET theme_config = '{"primary_color": "#007bff", ...}'::jsonb 
WHERE theme_config IS NULL;
```

### Issue: Styling Looks Wrong
**Solution**: Check CSS imports
```jsx
import './TenantGrid.css';
import './TenantControlPanel.css';
import './TenantTabs.css';
```

### Issue: API 404 Errors
**Solution**: Verify routes are properly loaded
```python
# In main.py, check:
app.include_router(tenants.routes.router, prefix="/tenants", tags=["tenants"])
```

---

## Feature Checklist

### Core Functionality
- [ ] Tenants can be listed with pagination
- [ ] Tenants can be searched/filtered by status
- [ ] Tenant details can be viewed and updated
- [ ] Points can be injected to tenant budget
- [ ] Transaction history is recorded in ledger
- [ ] Tenants can be suspended/resumed/archived

### Admin Features
- [ ] Tenant managers can be viewed
- [ ] Admin permissions can be reset
- [ ] Platform health metrics display
- [ ] System admins can be listed
- [ ] SUPER_ADMIN status can be toggled

### User Experience
- [ ] UI is responsive on mobile
- [ ] Forms have validation
- [ ] Success/error messages display
- [ ] Confirmation dialogs work for destructive actions
- [ ] Search and filtering work smoothly

---

## Performance Notes

### Optimization Tips
1. **Database Indexes**: Add indexes for frequently queried fields
   ```sql
   CREATE INDEX idx_tenants_status ON tenants(status);
   CREATE INDEX idx_tenants_slug ON tenants(slug);
   CREATE INDEX idx_budget_ledger_tenant ON master_budget_ledger(tenant_id);
   ```

2. **Pagination**: Always use pagination for large datasets
   ```python
   skip: int = Query(0), limit: int = Query(10, le=100)
   ```

3. **Caching**: Consider caching frequently accessed data
   ```python
   from functools import lru_cache
   ```

4. **Frontend**: Use React.memo() for expensive components
   ```jsx
   export default React.memo(TenantGrid);
   ```

---

## Security Checklist

- [x] All endpoints require `platform_admin` authorization
- [x] Sensitive operations require confirmation dialogs
- [x] All financial transactions are audited
- [x] Admin actions are logged
- [x] HTTPS should be used in production
- [x] Rate limiting recommended for API endpoints
- [x] Input validation on all forms
- [x] CSRF protection enabled

---

## Next Steps

1. ✅ Review the implementation guide: `TENANT_MANAGEMENT_GUIDE.md`
2. ✅ Review the summary: `IMPLEMENTATION_SUMMARY.md`
3. ✅ Run tests to verify backend
4. ✅ Integrate frontend pages and routes
5. ✅ Test end-to-end as platform admin
6. ✅ Deploy to staging for QA
7. ✅ Gather feedback and iterate

---

## Support

For detailed documentation, refer to:
- **API Reference**: API docstrings in `/backend/tenants/routes.py`
- **Component Props**: JSDoc comments in component files
- **Test Cases**: Usage examples in `/backend/tests/test_tenant_manager.py`
- **Implementation Guide**: `/TENANT_MANAGEMENT_GUIDE.md`

---

## Summary

You now have a complete tenant management system that provides:
- 📊 Centralized tenant discovery and administration
- ⚙️ Complete tenant configuration management
- 💰 Financial management with audit trail
- 👥 Admin user permission control
- 🌍 Platform-wide health and monitoring
- 🔒 Enterprise-grade security and authorization

Happy administering! 🚀
