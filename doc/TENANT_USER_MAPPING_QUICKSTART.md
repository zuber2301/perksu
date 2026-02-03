# Tenant_id and User Mapping - Quick Start Guide

## What Was Implemented

The **Tenant_id and User mapping** system creates a permanent, cryptographically-enforced link between every User and their Tenant. This is the foundation of multi-tenant security.

## Key Components Added

### 1. **Tenant Resolution Utilities** (`backend/auth/tenant_utils.py`)

```python
from auth.tenant_utils import TenantResolver, TenantContext, TenantFilter

# Resolve tenant from email domain
tenant_id = TenantResolver.resolve_from_email_domain("john@company.com", db)

# Resolve tenant from invite token
tenant_id = TenantResolver.resolve_from_invite_token(token, db)

# Create invite token (valid for 7 days by default)
token = TenantResolver.create_invite_token(tenant_id)

# Set tenant context for current request
TenantContext.set(tenant_id=user.tenant_id)
```

### 2. **Sign-Up Endpoint** (`POST /auth/signup`)

Users can register with automatic tenant assignment:

```bash
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@triton.com",
    "password": "password123",
    "first_name": "John",
    "last_name": "Doe",
    "invite_token": null
  }'
```

**Response:**
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "token_type": "bearer",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "tenant_id": "550e8400-e29b-41d4-a716-446655440001",
    "email": "john@triton.com",
    "first_name": "John",
    "last_name": "Doe",
    "status": "active"
  },
  "message": "Account created successfully"
}
```

### 3. **Invite Link Generation** (`POST /tenants/invite-link`)

Tenant managers can generate shareable invite links:

```bash
curl -X POST http://localhost:8000/api/tenants/invite-link?hours=168 \
  -H "Authorization: Bearer <HR_ADMIN_TOKEN>"
```

**Response:**
```json
{
  "invite_url": "http://localhost:5173/signup?invite_token=eyJ0eXAiOiJKV1QiLCJhbGc...",
  "invite_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "expires_in_hours": 168,
  "tenant_id": "550e8400-e29b-41d4-a716-446655440001",
  "message": "Share this link with new employees. Valid for 168 hours."
}
```

### 4. **Admin User Management** (`GET /users/admin/by-tenant/{tenant_id}`)

Platform admins can view all users for any tenant:

```bash
curl http://localhost:8000/api/users/admin/by-tenant/550e8400-e29b-41d4-a716-446655440001 \
  -H "Authorization: Bearer <PLATFORM_ADMIN_TOKEN>"
```

## How It Works

### Method A: Domain-Match Auto-Onboarding

1. User signs up with email: `john@triton.com`
2. System extracts domain: `@triton.com`
3. System checks if tenant has this domain in `domain_whitelist`
4. If match found → user is auto-assigned to that tenant
5. If no match → user gets error message

**Setup Required:**
```python
# In Tenant Management Panel:
# Add @triton.com to "domain_whitelist"
domain_whitelist = ["@triton.com", "@triton.energy.org"]
```

### Method B: Invite-Link Method

1. Tenant Manager clicks "Generate Invite Link"
2. System creates JWT token with embedded `tenant_id`
3. Link expires after specified hours (default: 7 days)
4. Admin shares link with new employee
5. Employee clicks link and is auto-assigned to tenant during signup

**Flow:**
```
Tenant Manager → Generate Link → Share Link → Employee Clicks → Auto-Assigned → Active
```

## Database Schema

The foundation is already in place:

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    -- ... other fields
);
```

**Key Constraints:**
- `NOT NULL`: Every user MUST have a tenant_id
- `FOREIGN KEY`: Ensures referential integrity
- `CASCADE DELETE`: If tenant deleted, all users deleted

## JWT Token Flow

When a user logs in, their JWT includes the tenant_id:

```json
{
  "sub": "user-id",
  "tenant_id": "tenant-id",
  "email": "user@company.com",
  "role": "employee",
  "type": "tenant",
  "exp": 1704067200
}
```

Every API request includes this token, automatically providing tenant context without needing to pass it as a parameter.

## Query Safety Pattern

Every SELECT query must include a tenant filter:

```python
# ✅ CORRECT
users = db.query(User).filter(
    User.tenant_id == current_user.tenant_id,
    User.status == 'active'
).all()

# ❌ WRONG
users = db.query(User).filter(
    User.status == 'active'
).all()
```

## Configuration

Add to `.env`:

```env
# Frontend URL for invite links
FRONTEND_URL=http://localhost:5173

# JWT Settings
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# Tenant Settings
DEFAULT_INVITE_EXPIRY_HOURS=168
```

## Testing the Implementation

### Test 1: Sign-Up with Domain Matching

```bash
# Setup: Add @test-company.com to a tenant's domain_whitelist

curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@test-company.com",
    "password": "password123",
    "first_name": "New",
    "last_name": "User"
  }'

# Expected: User is created with correct tenant_id
```

### Test 2: Sign-Up with Invite Link

```bash
# Step 1: Get invite link (as HR Admin)
INVITE_URL=$(curl -X POST http://localhost:8000/api/tenants/invite-link \
  -H "Authorization: Bearer <HR_ADMIN_TOKEN>" \
  | jq -r '.invite_token')

# Step 2: Sign up with invite token
curl -X POST http://localhost:8000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"invited@user.com\",
    \"password\": \"password123\",
    \"first_name\": \"Invited\",
    \"last_name\": \"User\",
    \"invite_token\": \"$INVITE_URL\"
  }"

# Expected: User is created with tenant_id from token
```

### Test 3: Tenant Isolation

```bash
# As User1 from Tenant A, try to access User2 from Tenant B
curl http://localhost:8000/api/users/<USER2_ID> \
  -H "Authorization: Bearer <USER1_TENANT_A_TOKEN>"

# Expected: 403 Forbidden or 404 Not Found (data not visible)
```

## API Endpoints Summary

### Authentication
- `POST /auth/signup` - Self-registration with auto-tenanting
- `POST /auth/login` - User login
- `POST /auth/verify-otp` - OTP verification

### Tenant Management
- `POST /tenants/invite-link` - Generate invite token (HR Admin)
- `PUT /tenants/current/domain-whitelist` - Configure domain whitelist (HR Admin)

### User Management
- `GET /users` - List users in current tenant
- `GET /users?tenant_id=UUID` - List users in specific tenant (Platform Admin)
- `GET /users/admin/by-tenant/{tenant_id}` - Admin view for tenant (Platform Admin)

## Common Tasks

### 1. Add Email Domain to Tenant

```bash
curl -X PUT http://localhost:8000/api/tenants/current/domain-whitelist \
  -H "Authorization: Bearer <HR_ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "domains": ["@company.com", "@subsidiary.org"]
  }'
```

### 2. Create Invite Link for New Employee

```bash
# Generate 7-day link (default)
curl -X POST http://localhost:8000/api/tenants/invite-link \
  -H "Authorization: Bearer <HR_ADMIN_TOKEN>"

# Or custom expiry (e.g., 24 hours)
curl -X POST "http://localhost:8000/api/tenants/invite-link?hours=24" \
  -H "Authorization: Bearer <HR_ADMIN_TOKEN>"
```

### 3. View All Users in a Tenant (Platform Admin)

```bash
curl "http://localhost:8000/api/users/admin/by-tenant/550e8400-e29b-41d4-a716-446655440001" \
  -H "Authorization: Bearer <PLATFORM_ADMIN_TOKEN>"
```

### 4. Filter Users by Department

```bash
curl "http://localhost:8000/api/users?department_id=dept-uuid&status=active" \
  -H "Authorization: Bearer <USER_TOKEN>"
```

## Security Guarantees

✅ **Database Level:** NOT NULL constraint prevents "homeless" users  
✅ **Application Level:** Every query includes tenant filter  
✅ **JWT Level:** Tenant context is cryptographically verified  
✅ **API Level:** Platform admins cannot access tenant data without explicit filter  

## Troubleshooting

### Error: "No associated organization found for this domain"

**Cause:** Email domain not in tenant's `domain_whitelist`

**Solution:**
1. As HR Admin, add domain to tenant settings
2. Or provide user with invite link instead

### Error: "Tenant isolation violation"

**Cause:** User trying to access resource from different tenant

**Solution:** This is expected behavior - resource not visible to users outside its tenant

### User in JWT doesn't match database

**Cause:** Token was created before user status changed

**Solution:** User needs to log in again to get new token

## Files Modified

| File | Changes |
|------|---------|
| `backend/auth/tenant_utils.py` | ✨ NEW - Tenant resolution and context utilities |
| `backend/auth/routes.py` | + Sign-up endpoint with auto-tenanting |
| `backend/auth/schemas.py` | + SignUpRequest, SignUpResponse, InviteLinkResponse |
| `backend/tenants/routes.py` | + Invite link generation endpoint |
| `backend/users/routes.py` | + Admin user management endpoint |
| `backend/config.py` | + FRONTEND_URL and tenant settings |

## Next Steps

1. **Test in Development:**
   ```bash
   cd /root/git-all-linux/perksu
   docker-compose up -d
   # Test endpoints with curl
   ```

2. **Update Frontend:**
   - Add sign-up page that uses `/auth/signup`
   - Add invite link handling in sign-up flow
   - Add admin panel to view tenants' users

3. **Database Validation:**
   - Ensure domain_whitelist is populated for each tenant
   - Verify all existing users have tenant_id
   - Run migration if needed

4. **Monitor & Audit:**
   - Log all user creation with tenant_id
   - Alert on failed tenant resolution
   - Monitor cross-tenant query attempts

## Reference Documentation

See [TENANT_USER_MAPPING_GUIDE.md](./TENANT_USER_MAPPING_GUIDE.md) for comprehensive documentation including:
- Database architecture details
- Onboarding mechanisms (detailed flows)
- JWT and security implementation
- Global filters and best practices
- Testing strategies
- Configuration options

---

**Status:** ✅ Implementation Complete  
**Date:** February 1, 2026  
**Version:** 1.0
