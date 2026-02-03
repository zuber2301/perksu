# Tenant_id and User Mapping Implementation Guide

## Overview

The **Tenant_id and User mapping** is the critical "hard link" between Users and Tenants in the Perksu platform. This document describes the implementation and best practices for maintaining this association throughout your system.

## Table of Contents

1. [Database Architecture](#database-architecture)
2. [Onboarding Mechanisms](#onboarding-mechanisms)
3. [Implementation Details](#implementation-details)
4. [JWT & Security](#jwt--security)
5. [Global Filters](#global-filters)
6. [Admin Views](#admin-views)
7. [Testing](#testing)
8. [Best Practices](#best-practices)

---

## Database Architecture

### The "Hard Link"

Every user record **must contain a `tenant_id`** that is **NOT NULL**. This enforces referential integrity at the database level.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255),
    role VARCHAR(50),
    status VARCHAR(50),
    -- ... other fields
);
```

**Key Constraints:**
- `NOT NULL`: No "homeless" users exist in the system
- `FOREIGN KEY`: Maintains data integrity; cannot create users for non-existent tenants
- `ON DELETE CASCADE`: If a tenant is deleted, all associated users are deleted

### Current Schema Status

The Perksu database already has the correct structure:

| Field | Type | Constraint | Purpose |
|-------|------|-----------|---------|
| `users.id` | UUID | PRIMARY KEY | Unique user identifier |
| `users.tenant_id` | UUID | **NOT NULL**, FK → `tenants.id` | Hard link to tenant |
| `users.email` | VARCHAR | Unique per tenant | User login identifier |
| `users.status` | VARCHAR | CHECK | active, deactivated, pending_invite |

---

## Onboarding Mechanisms

### Method A: Domain-Match Auto-Onboarding (Recommended)

**Best For:** Large organizations with email domains (e.g., @companyname.com)

**How It Works:**

1. User signs up with email: `john@triton.com`
2. System extracts domain: `@triton.com`
3. System queries `tenants.domain_whitelist` for matching domain
4. If found, user is automatically assigned to that tenant

**Example:**

```python
# Tenant setup
tenant = {
    "name": "Triton Energy",
    "domain_whitelist": ["@triton.com", "@tritonpower.org"]
}

# User signs up
user_email = "john@triton.com"
domain = "@triton.com"  # Extracted from email

# System finds matching tenant and assigns:
user.tenant_id = tenant_id  # The "Magic Link"
```

**Implementation:**

```python
# POST /auth/signup
@router.post("/signup", response_model=SignUpResponse)
async def signup(signup_data: SignUpRequest, db: Session):
    # Resolve tenant from email domain
    tenant_id = TenantResolver.resolve_from_email_domain(
        email=signup_data.email,
        db=db
    )
    
    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="No associated organization found for this domain"
        )
    
    # Create user with resolved tenant_id
    user = User(
        tenant_id=tenant_id,  # The "Magic Link"
        email=signup_data.email,
        password_hash=hash_password(signup_data.password),
        first_name=signup_data.first_name,
        last_name=signup_data.last_name,
        status='active'
    )
    db.add(user)
    db.commit()
```

### Method B: Invite-Link Method

**Best For:** Onboarding specific users or external team members

**How It Works:**

1. Tenant Manager generates invite link
2. Link contains secure JWT token with embedded `tenant_id`
3. Link expires after specified time (default: 7 days)
4. User clicks link and signs up, tenant is pre-assigned

**Example URL:**

```
https://app.sparknode.io/signup?invite_token=eyJ0eXAiOiJKV1QiLCJhbGc...
```

**Token Payload:**

```json
{
  "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
  "exp": 1704067200,
  "type": "invite"
}
```

**Implementation:**

```python
# POST /tenants/invite-link (Tenant Manager)
@router.post("/invite-link")
async def generate_invite_link(
    hours: int = 168,  # 7 days
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    invite_token = TenantResolver.create_invite_token(
        tenant_id=current_user.tenant_id,
        expires_in_hours=hours
    )
    
    invite_url = f"{FRONTEND_URL}/signup?invite_token={invite_token}"
    
    return {
        "invite_url": invite_url,
        "expires_in_hours": hours,
        "message": "Share this link with new employees"
    }

# User clicks link and signs up
# POST /auth/signup with ?invite_token=...
tenant_id = TenantResolver.resolve_from_invite_token(token, db)
```

---

## Implementation Details

### Step 1: Tenant Resolution

The `TenantResolver` class handles all tenant resolution logic:

```python
from auth.tenant_utils import TenantResolver

# Method A: Domain matching
tenant_id = TenantResolver.resolve_from_email_domain(
    email="user@company.com",
    db=db
)

# Method B: Invite token
tenant_id = TenantResolver.resolve_from_invite_token(
    token=invite_token,
    db=db
)

# Method C: Main resolver (tries all methods)
tenant_id = TenantResolver.resolve_tenant(
    email="user@company.com",
    invite_token=None,
    explicit_tenant_id=None,
    db=db
)
```

### Step 2: User Creation with Tenant Context

```python
async def onboard_user(userData, db: Session):
    """
    Step 1: Resolve Tenant ID
    """
    tenant_id = TenantResolver.resolve_tenant(
        email=userData.email,
        invite_token=userData.invite_token,
        db=db
    )
    
    if not tenant_id:
        raise HTTPException(
            status_code=400,
            detail="No associated organization found"
        )
    
    """
    Step 2: Create User with associated Tenant ID
    """
    new_user = User(
        tenant_id=tenant_id,  # The "Magic Link"
        email=userData.email,
        password_hash=get_password_hash(userData.password),
        first_name=userData.first_name,
        last_name=userData.last_name,
        status='active'
    )
    db.add(new_user)
    db.flush()
    
    """
    Step 3: Initialize Wallet
    """
    wallet = Wallet(
        tenant_id=tenant_id,
        user_id=new_user.id,
        balance=0,
        lifetime_earned=0,
        lifetime_spent=0
    )
    db.add(wallet)
    db.commit()
    
    return new_user
```

---

## JWT & Security

### Tenant-Aware JWT

Once a user logs in, their JWT token includes the `tenant_id`:

```python
access_token = create_access_token(
    data={
        "sub": str(user.id),
        "tenant_id": str(user.tenant_id),  # Embedded tenant_id
        "email": user.email,
        "role": user.role,
        "type": "tenant"
    },
    expires_delta=timedelta(minutes=30)
)
```

**JWT Payload Example:**

```json
{
  "sub": "user-uuid",
  "tenant_id": "tenant-uuid",
  "email": "user@company.com",
  "role": "employee",
  "type": "tenant",
  "exp": 1704067200
}
```

### Why Include tenant_id in JWT?

1. **Prevents Spoofing:** Users cannot claim to belong to a different tenant
2. **Simplifies Queries:** Backend can extract tenant_id from token without DB lookup
3. **Enables Delegation:** Platform admins can impersonate users without full permission escalation
4. **Audit Trail:** All requests carry tenant context for logging

### Token Usage in Requests

Every API request automatically includes the JWT in the `Authorization` header:

```
Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGc...
```

The `get_current_user` dependency extracts tenant_id from the token:

```python
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    token_data = decode_token(token)
    user = db.query(User).filter(User.id == token_data.user_id).first()
    
    # Set Tenant Context for this request
    TenantContext.set(
        tenant_id=user.tenant_id,
        global_access=user.role == 'platform_admin'
    )
    
    return user
```

---

## Global Filters

### The Pattern: Automatic Tenant Scoping

**Every SELECT query must include a tenant filter** for non-admin users. This ensures:

- **Data Isolation:** Users only see their own tenant's data
- **Security:** Prevents accidental cross-tenant data leaks
- **Performance:** Query optimizer can use tenant_id index

### Implementation Pattern

```python
# Pattern 1: Regular User Query
query = db.query(User).filter(User.tenant_id == current_user.tenant_id)

# Pattern 2: Platform Admin Query
if current_user.role == 'platform_admin':
    query = db.query(User)  # No filter, can see all tenants
else:
    query = query.filter(User.tenant_id == current_user.tenant_id)
```

### Using TenantFilter Helper

```python
from auth.tenant_utils import TenantFilter

# Apply tenant filter automatically
query = db.query(User)
query = TenantFilter.apply_tenant_filter(
    query,
    User,
    user_tenant_id=current_user.tenant_id,
    has_global_access=current_user.role == 'platform_admin'
)

users = query.all()
```

### Example Queries

```python
# Get all users in current tenant
users = db.query(User).filter(
    User.tenant_id == current_user.tenant_id
).all()

# Get active users in department (auto-scoped to tenant)
department_users = db.query(User).filter(
    User.tenant_id == current_user.tenant_id,
    User.department_id == dept_id,
    User.status == 'active'
).all()

# Get user's recognitions (recipient scope)
recognitions = db.query(Recognition).filter(
    Recognition.tenant_id == current_user.tenant_id,
    Recognition.to_user_id == user_id
).all()

# Get feed for user's tenant
feed = db.query(Feed).filter(
    Feed.tenant_id == current_user.tenant_id
).order_by(Feed.created_at.desc()).all()
```

### Ensuring Tenant Isolation in Views

```python
# WRONG - Violates tenant isolation
@router.get("/awards/{award_id}")
async def get_award(award_id: UUID, db: Session):
    award = db.query(Award).filter(Award.id == award_id).first()
    return award  # ❌ Could return award from different tenant

# RIGHT - Enforces tenant isolation
@router.get("/awards/{award_id}")
async def get_award(
    award_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    award = db.query(Award).filter(
        Award.id == award_id,
        Award.tenant_id == current_user.tenant_id  # ✅ Tenant filter
    ).first()
    
    if not award:
        raise HTTPException(status_code=404, detail="Award not found")
    
    return award
```

---

## Admin Views

### Platform Admin Interface

The platform admin can view users for any tenant:

```python
# Platform admin views all tenants
GET /tenants/

# Platform admin views users for a specific tenant
GET /users/admin/by-tenant/{tenant_id}
GET /users/admin/by-tenant/{tenant_id}?department_id=...&role=...&status=...
```

### Sample Response

```json
GET /users/admin/by-tenant/550e8400-e29b-41d4-a716-446655440000

[
  {
    "id": "user-id-1",
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john@company.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "employee",
    "department_id": "dept-id",
    "status": "active"
  },
  {
    "id": "user-id-2",
    "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "jane@company.com",
    "first_name": "Jane",
    "last_name": "Smith",
    "role": "manager",
    "department_id": "dept-id",
    "status": "active"
  }
]
```

### Frontend Implementation

```javascript
// Tenant Manager - Click on a tenant
const viewTenantUsers = async (tenantId) => {
  const response = await fetch(
    `/api/users/admin/by-tenant/${tenantId}?limit=100`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  
  const users = await response.json();
  return users;
};
```

---

## Testing

### Unit Tests

```python
# tests/test_tenant_resolution.py

from auth.tenant_utils import TenantResolver
from models import Tenant

def test_resolve_from_email_domain():
    """Test domain matching"""
    tenant = Tenant(
        name="Triton",
        domain_whitelist=["@triton.com"]
    )
    db.add(tenant)
    db.commit()
    
    tenant_id = TenantResolver.resolve_from_email_domain(
        "john@triton.com",
        db
    )
    
    assert tenant_id == tenant.id

def test_resolve_from_invite_token():
    """Test invite token parsing"""
    tenant = Tenant(name="Triton")
    db.add(tenant)
    db.commit()
    
    token = TenantResolver.create_invite_token(tenant.id)
    resolved_id = TenantResolver.resolve_from_invite_token(token, db)
    
    assert resolved_id == tenant.id

def test_signup_creates_user_with_tenant():
    """Test user creation enforces tenant_id"""
    tenant = Tenant(name="Triton", domain_whitelist=["@triton.com"])
    db.add(tenant)
    db.commit()
    
    response = client.post("/auth/signup", json={
        "email": "john@triton.com",
        "password": "password123",
        "first_name": "John",
        "last_name": "Doe"
    })
    
    assert response.status_code == 200
    user = db.query(User).filter(User.email == "john@triton.com").first()
    assert user.tenant_id == tenant.id
```

### Integration Tests

```python
# tests/test_tenant_isolation.py

def test_user_cannot_access_different_tenant_data():
    """Test tenant isolation enforcement"""
    # Create two tenants and users
    tenant1 = Tenant(name="Company1")
    tenant2 = Tenant(name="Company2")
    db.add_all([tenant1, tenant2])
    db.commit()
    
    user1 = User(tenant_id=tenant1.id, email="user1@company1.com")
    user2 = User(tenant_id=tenant2.id, email="user2@company2.com")
    db.add_all([user1, user2])
    db.commit()
    
    # User1 tries to access User2
    token1 = create_access_token({
        "sub": str(user1.id),
        "tenant_id": str(user1.tenant_id)
    })
    
    response = client.get(
        f"/api/users/{user2.id}",
        headers={"Authorization": f"Bearer {token1}"}
    )
    
    assert response.status_code == 403  # Access denied
```

---

## Best Practices

### 1. Always Include tenant_id in Every Insert

```python
# ✅ CORRECT
user = User(
    tenant_id=current_user.tenant_id,  # Always include
    email=email,
    password_hash=hash_password(password)
)

# ❌ WRONG - Missing tenant_id
user = User(
    email=email,
    password_hash=hash_password(password)
)
```

### 2. Always Filter by tenant_id in Every Query

```python
# ✅ CORRECT
users = db.query(User).filter(
    User.tenant_id == current_user.tenant_id,
    User.status == 'active'
).all()

# ❌ WRONG - Missing tenant filter
users = db.query(User).filter(
    User.status == 'active'
).all()
```

### 3. Use TenantContext for Middleware

```python
# In dependency injection:
async def get_current_user(token, db):
    user = verify_token_and_get_user(token, db)
    
    # Set tenant context for this request
    TenantContext.set(tenant_id=user.tenant_id)
    
    return user

# Now services can access tenant_id anywhere:
current_tenant_id = TenantContext.get_tenant_id()
```

### 4. Validate Tenant Ownership Before Modifying

```python
# Before updating a resource
resource = db.query(Resource).filter(Resource.id == resource_id).first()

if resource.tenant_id != current_user.tenant_id:
    raise HTTPException(
        status_code=403,
        detail="Access denied: Tenant isolation violation"
    )

resource.name = new_name
db.commit()
```

### 5. Use Indexes on tenant_id

```sql
-- Add index for fast tenant-scoped queries
CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_recognitions_tenant_id ON recognitions(tenant_id);
CREATE INDEX idx_awards_tenant_id ON awards(tenant_id);
```

### 6. Document Tenant Scope in Endpoints

```python
@router.get("/feed")
async def get_feed(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get recognitions feed for current user's tenant.
    
    Tenant Scope: Automatically filtered to current_user.tenant_id
    Returns: Only recognitions from the same tenant
    """
    feed = db.query(Recognition).filter(
        Recognition.tenant_id == current_user.tenant_id
    ).order_by(Recognition.created_at.desc()).all()
    
    return feed
```

### 7. Handle tenant_id NOT NULL Constraint

```python
# Database enforces NOT NULL:
# - This will raise an IntegrityError at the database level
try:
    user = User(email="test@example.com")  # Missing tenant_id
    db.add(user)
    db.commit()  # ❌ Raises IntegrityError
except IntegrityError:
    print("User must have a tenant_id")
    db.rollback()
```

### 8. Tenant Manager Settings

```python
# Allow tenant managers to configure domain whitelist
@router.put("/current/domain-whitelist")
async def update_domain_whitelist(
    domains: List[str],
    current_user: User = Depends(get_hr_admin),
    db: Session = Depends(get_db)
):
    """
    HR Admin can configure which email domains auto-assign to this tenant.
    
    Example: ["@company.com", "@subsidiary.org"]
    """
    tenant = db.query(Tenant).filter(Tenant.id == current_user.tenant_id).first()
    tenant.domain_whitelist = domains
    db.commit()
    
    return {"message": f"Domain whitelist updated: {domains}"}
```

---

## Configuration

### Environment Variables

```env
# Frontend URL for constructing invite links
FRONTEND_URL=https://app.sparknode.io

# JWT Settings
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Tenant Settings
DEFAULT_INVITE_EXPIRY_HOURS=168  # 7 days
```

### Config Usage

```python
# backend/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    frontend_url: str = "http://localhost:5173"
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    default_invite_expiry_hours: int = 168
    
    class Config:
        env_file = ".env"

settings = Settings()
```

---

## Summary

The **Tenant_id and User mapping** implementation provides:

✅ **Data Isolation:** Each user is permanently linked to a tenant via NOT NULL foreign key  
✅ **Automatic Onboarding:** Domain matching and invite tokens eliminate manual provisioning  
✅ **JWT Security:** Tenant context is cryptographically verified in every request  
✅ **Query Safety:** Global filters ensure no cross-tenant data leaks  
✅ **Admin Visibility:** Platform admins can view and manage any tenant  

This "hard link" is the foundation of multi-tenancy security and is enforced at three levels:
1. **Database:** NOT NULL constraint, foreign key
2. **Application:** Automatic filtering in queries
3. **API:** JWT token includes tenant_id, preventing spoofing

---

## API Endpoints Summary

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/auth/signup` | POST | User self-registration (auto-tenanting) | None |
| `/auth/login` | POST | User login | Email/Password |
| `/auth/verify-otp` | POST | OTP verification | OTP |
| `/tenants/invite-link` | POST | Generate invite token | HR Admin |
| `/users` | GET | List users (tenant-scoped) | Any User |
| `/users/admin/by-tenant/{tenant_id}` | GET | Admin view for tenant | Platform Admin |

---

**Last Updated:** February 1, 2026  
**Implementation Status:** ✅ Complete
