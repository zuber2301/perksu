# Tenant_id and User Mapping - Architecture Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PERKSU MULTI-TENANT PLATFORM                │
└─────────────────────────────────────────────────────────────────┘

┌────────────────┐         ┌────────────────┐         ┌────────────────┐
│  Tenant A      │         │  Tenant B      │         │  Tenant C      │
│  (Triton)      │         │  (Acme)        │         │  (Global)      │
├────────────────┤         ├────────────────┤         ├────────────────┤
│ domain_list:   │         │ domain_list:   │         │ domain_list:   │
│ @triton.com    │         │ @acme.com      │         │ @global.com    │
│ @triton.energy │         │ @acme.org      │         │ @global.de     │
└────────────────┘         └────────────────┘         └────────────────┘
        ▲                           ▲                           ▲
        │                           │                           │
        │ Foreign Key               │ Foreign Key               │ Foreign Key
        │ References                │ References                │ References
        │                           │                           │
┌───────┴───────┬───────────────────┴────────────┬───────────────┴────────────┐
│               │                                │                            │
│               │                                │                            │
│         Users (Tenant A)                 Users (Tenant B)            Users (Tenant C)
│         ┌──────────────────┐            ┌──────────────────┐       ┌──────────────────┐
│         │ id: uuid1        │            │ id: uuid3        │       │ id: uuid5        │
│         │ tenant_id: A ✓   │            │ tenant_id: B ✓   │       │ tenant_id: C ✓   │
│         │ email: john@...  │            │ email: jane@...  │       │ email: bob@...   │
│         └──────────────────┘            └──────────────────┘       └──────────────────┘
│
│         ┌──────────────────┐
│         │ id: uuid2        │
│         │ tenant_id: A ✓   │
│         │ email: mary@...  │
│         └──────────────────┘
│
```

---

## Data Flow: User Sign-Up with Domain Matching

```
┌─────────────────────────────────────────────────────────────────────┐
│ USER SIGN-UP FLOW (Domain-Match Auto-Onboarding)                   │
└─────────────────────────────────────────────────────────────────────┘

1. SIGN-UP REQUEST
   ┌──────────────────────────────────────────┐
   │ POST /auth/signup                        │
   │ {                                        │
   │   "email": "john@triton.com"            │
   │   "password": "password123"             │
   │   "first_name": "John"                  │
   │   "last_name": "Doe"                    │
   │ }                                        │
   └──────────────────────────────────────────┘
                    ▼
2. TENANT RESOLUTION
   ┌──────────────────────────────────────────┐
   │ TenantResolver.resolve_tenant()          │
   │                                          │
   │ Extract domain: @triton.com              │
   │ Query: tenants where                     │
   │   domain_whitelist contains @triton.com │
   │                                          │
   │ Result: tenant_id = A                    │
   └──────────────────────────────────────────┘
                    ▼
3. CREATE USER (The "Magic Link")
   ┌──────────────────────────────────────────┐
   │ User(                                    │
   │   tenant_id=A,     ◄─ NOT NULL FK        │
   │   email="john@...",                      │
   │   password_hash="...",                   │
   │   first_name="John",                     │
   │   last_name="Doe",                       │
   │   status="active"                        │
   │ )                                        │
   └──────────────────────────────────────────┘
                    ▼
4. INITIALIZE WALLET
   ┌──────────────────────────────────────────┐
   │ Wallet(                                  │
   │   tenant_id=A,                           │
   │   user_id=<new_user_id>,                 │
   │   balance=0                              │
   │ )                                        │
   └──────────────────────────────────────────┘
                    ▼
5. CREATE JWT TOKEN
   ┌──────────────────────────────────────────┐
   │ Token = JWT.encode({                     │
   │   "sub": "<user_id>",                    │
   │   "tenant_id": "A",    ◄─ In JWT         │
   │   "email": "john@...",                   │
   │   "role": "employee",                    │
   │   "type": "tenant",                      │
   │   "exp": <timestamp>                     │
   │ })                                       │
   └──────────────────────────────────────────┘
                    ▼
6. RESPONSE
   ┌──────────────────────────────────────────┐
   │ {                                        │
   │   "access_token": "<JWT>",               │
   │   "token_type": "bearer",                │
   │   "user": {                              │
   │     "id": "...",                         │
   │     "tenant_id": "A",   ◄─ Confirmed    │
   │     "email": "john@...",                 │
   │     "status": "active"                   │
   │   },                                     │
   │   "message": "Account created successfully"
   │ }                                        │
   └──────────────────────────────────────────┘
```

---

## Data Flow: User Sign-Up with Invite Link

```
┌─────────────────────────────────────────────────────────────────────┐
│ USER SIGN-UP FLOW (Invite-Link Method)                             │
└─────────────────────────────────────────────────────────────────────┘

1. TENANT ADMIN GENERATES LINK
   ┌──────────────────────────────────────────┐
   │ POST /tenants/invite-link                │
   │ (As HR Admin, tenant A)                  │
   │                                          │
   │ TenantResolver.create_invite_token(      │
   │   tenant_id=A,                           │
   │   expires_in_hours=168                   │
   │ )                                        │
   │                                          │
   │ Creates JWT:                             │
   │ {                                        │
   │   "tenant_id": "A",                      │
   │   "exp": <timestamp + 7 days>,           │
   │   "type": "invite"                       │
   │ }                                        │
   └──────────────────────────────────────────┘
                    ▼
2. LINK GENERATED
   ┌──────────────────────────────────────────────────────────────┐
   │ Invite URL:                                                  │
   │ http://localhost:5173/signup                                 │
   │   ?invite_token=eyJ0eXAiOiJKV1QiLCJhbGc...                  │
   │                                          │
   │ Share with new employee                  │
   └──────────────────────────────────────────────────────────────┘
                    ▼
3. NEW EMPLOYEE CLICKS LINK & SUBMITS SIGNUP
   ┌──────────────────────────────────────────┐
   │ POST /auth/signup                        │
   │ {                                        │
   │   "email": "alice@external.com"          │
   │   "password": "...",                     │
   │   "first_name": "Alice",                 │
   │   "invite_token": "<token_from_url>"     │
   │ }                                        │
   └──────────────────────────────────────────┘
                    ▼
4. TENANT RESOLUTION FROM TOKEN
   ┌──────────────────────────────────────────┐
   │ TenantResolver.resolve_from_invite_token(│
   │   token="<invite_token>"                 │
   │ )                                        │
   │                                          │
   │ JWT.decode(token):                       │
   │   ✓ Signature valid                      │
   │   ✓ Not expired                          │
   │   ✓ Tenant still active                  │
   │                                          │
   │ Result: tenant_id = A                    │
   └──────────────────────────────────────────┘
                    ▼
5. USER CREATED WITH TENANT A
   ┌──────────────────────────────────────────┐
   │ User(                                    │
   │   tenant_id=A,     ◄─ From invite token  │
   │   email="alice@...",                     │
   │   status="active"                        │
   │ )                                        │
   │                                          │
   │ → Alice is now part of Tenant A          │
   │ → Can access Tenant A resources          │
   └──────────────────────────────────────────┘
```

---

## JWT Token Lifecycle

```
┌─────────────────────────────────────────────────────────────────────┐
│ JWT TOKEN WITH EMBEDDED TENANT_ID                                  │
└─────────────────────────────────────────────────────────────────────┘

1. TOKEN CREATION (During Login/Sign-Up)
   ┌──────────────────────────────────┐
   │ User: john@triton.com            │
   │ Tenant: A (Triton Energy)        │
   │                                  │
   │ create_access_token({            │
   │   "sub": "user-uuid",            │
   │   "tenant_id": "A",  ◄─ KEY      │
   │   "email": "...",                │
   │   "role": "employee",            │
   │   "exp": <timestamp>             │
   │ })                               │
   └──────────────────────────────────┘
              ▼
2. TOKEN ENCODING (HS256)
   ┌──────────────────────────────────┐
   │ ENCODED TOKEN:                   │
   │ eyJ0eXAiOiJKV1QiLCJhbGc...       │
   │                                  │
   │ Header:                          │
   │ { "typ": "JWT", "alg": "HS256" } │
   │                                  │
   │ Payload:                         │
   │ { "sub": "uuid", "tenant_id":... │
   │   "email": "...", "exp": ... }   │
   │                                  │
   │ Signature:                       │
   │ HMAC256(secret, header.payload)  │
   └──────────────────────────────────┘
              ▼
3. TOKEN IN REQUEST HEADER
   ┌──────────────────────────────────┐
   │ GET /api/users                   │
   │ Authorization: Bearer <TOKEN>    │
   │                                  │
   │ Server receives token            │
   └──────────────────────────────────┘
              ▼
4. TOKEN VERIFICATION
   ┌──────────────────────────────────┐
   │ JWT.decode(token, secret):       │
   │                                  │
   │ ✓ Signature valid?               │
   │   HMAC256(secret, payload) ==    │
   │   token.signature                │
   │                                  │
   │ ✓ Not expired?                   │
   │   current_time < exp             │
   │                                  │
   │ ✓ Extract tenant_id from token   │
   │   tenant_id = "A"                │
   └──────────────────────────────────┘
              ▼
5. TENANT CONTEXT SET
   ┌──────────────────────────────────┐
   │ TenantContext.set(               │
   │   tenant_id="A"                  │
   │ )                                │
   │                                  │
   │ Now available for this request   │
   └──────────────────────────────────┘
              ▼
6. QUERY EXECUTION (Automatically Scoped)
   ┌──────────────────────────────────┐
   │ db.query(User).filter(           │
   │   User.tenant_id == "A"  ◄─ Auto │
   │ ).all()                          │
   │                                  │
   │ Only returns users from Tenant A │
   └──────────────────────────────────┘

KEY BENEFIT:
✓ tenant_id is VERIFIED (cryptographic signature)
✓ tenant_id is IMMUTABLE (part of encrypted token)
✓ tenant_id is AVAILABLE (extracted without DB call)
✓ Prevents spoofing: user can't claim different tenant
```

---

## Query Filtering Pattern

```
┌─────────────────────────────────────────────────────────────────────┐
│ TENANT-AWARE GLOBAL FILTERING                                       │
└─────────────────────────────────────────────────────────────────────┘

SCENARIO: User from Tenant A tries to access data

┌─────────────────────────┐
│ Incoming Request        │
│ Authorization: Bearer..│
│ GET /api/users          │
└─────────────────────────┘
            ▼
┌─────────────────────────────────────────────┐
│ get_current_user(token, db)                 │
│                                             │
│ 1. Decode token                             │
│ 2. Extract tenant_id = "A"                  │
│ 3. Get user object                          │
│ 4. TenantContext.set(tenant_id="A")         │
│ 5. Return user                              │
└─────────────────────────────────────────────┘
            ▼
┌─────────────────────────────────────────────┐
│ Query Pattern                               │
│                                             │
│ query = db.query(User)                      │
│                                             │
│ if not is_platform_admin:                   │
│   query = query.filter(                     │
│     User.tenant_id == current_user.tenant_id
│   )  ◄─ AUTO-SCOPED TO "A"                  │
│                                             │
│ if role_filter:                             │
│   query = query.filter(                     │
│     User.role == role_filter                │
│   )                                         │
│                                             │
│ users = query.all()                         │
│                                             │
│ Result: Only users from Tenant A returned   │
└─────────────────────────────────────────────┘

DATABASE PERSPECTIVE:
┌─────────────────────────────────────────────┐
│ SELECT * FROM users WHERE                   │
│   tenant_id = 'A'          ◄─ PRIMARY FILTER │
│   AND status = 'active'    ◄─ SECONDARY     │
│ LIMIT 100                                   │
│                                             │
│ Uses INDEX on users.tenant_id for speed     │
└─────────────────────────────────────────────┘

ISOLATION GUARANTEE:
✓ User can ONLY see their tenant's data
✓ Cross-tenant access = 403 Forbidden
✓ Enforced at 3 levels: DB, App, API
```

---

## Platform Admin View

```
┌─────────────────────────────────────────────────────────────────────┐
│ PLATFORM ADMIN TENANT INSPECTION                                    │
└─────────────────────────────────────────────────────────────────────┘

PLATFORM ADMIN INTERFACE

┌────────────────────────────────────┐
│ Available Tenants                  │
├────────────────────────────────────┤
│ □ Triton Energy (A)                │
│ □ Acme Corp (B)                    │
│ □ Global Tech (C)                  │
└────────────────────────────────────┘
         ▼ [Click to View Users]
         
GET /users/admin/by-tenant/A
         ▼
┌────────────────────────────────────────────────────┐
│ Users in Tenant A (Triton Energy)                  │
├────────────────────────────────────────────────────┤
│ Filters:                                           │
│ Department: [Select All ▼]  Status: [All ▼]      │
├────────────────────────────────────────────────────┤
│ Name                  Email              Status    │
├────────────────────────────────────────────────────┤
│ John Doe             john@triton.com     Active   │
│ Mary Smith           mary@triton.com     Active   │
│ Bob Johnson          bob@triton.energy   Pending  │
│ Alice Brown          alice@triton.com    Active   │
└────────────────────────────────────────────────────┘

API CALL DETAILS:

GET /users/admin/by-tenant/550e8400-e29b-41d4-a716-446655440001
Authorization: Bearer <PLATFORM_ADMIN_TOKEN>

Query Parameters:
- department_id (optional): Filter by department
- role (optional): Filter by role
- status (optional): active, deactivated, pending_invite
- skip: Pagination offset (default: 0)
- limit: Results per page (default: 100, max: 1000)

Response:
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440010",
    "tenant_id": "550e8400-e29b-41d4-a716-446655440001",
    "email": "john@triton.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "employee",
    "org_role": "employee",
    "department_id": "dept-001",
    "status": "active",
    "created_at": "2026-01-15T10:30:00Z"
  },
  ... more users
]
```

---

## Security Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│ THREE-LAYER SECURITY ARCHITECTURE                                   │
└─────────────────────────────────────────────────────────────────────┘

LAYER 1: DATABASE CONSTRAINTS
┌──────────────────────────────────────┐
│ CREATE TABLE users (                 │
│   id UUID PRIMARY KEY,               │
│   tenant_id UUID NOT NULL,  ◄─ Layer1 │
│   FOREIGN KEY (tenant_id) REFERENCES │
│     tenants(id) ON DELETE CASCADE    │
│ )                                    │
│                                      │
│ Prevents:                            │
│ ❌ NULL tenant_id                    │
│ ❌ Invalid tenant_id                 │
│ ❌ Orphaned users                    │
└──────────────────────────────────────┘

LAYER 2: APPLICATION LOGIC
┌──────────────────────────────────────┐
│ Every Query Pattern:                 │
│                                      │
│ db.query(Model)                      │
│   .filter(                           │
│     Model.tenant_id ==               │
│       current_user.tenant_id ◄─ L2   │
│   )                                  │
│   .all()                             │
│                                      │
│ Prevents:                            │
│ ❌ Cross-tenant data access          │
│ ❌ Accidental data leaks             │
└──────────────────────────────────────┘

LAYER 3: JWT TOKEN VERIFICATION
┌──────────────────────────────────────┐
│ Every Request:                       │
│                                      │
│ Authorization: Bearer <JWT>          │
│                                      │
│ JWT.decode(token, secret):           │
│   ✓ Signature verified               │
│   ✓ Not expired                      │
│   ✓ Contains tenant_id  ◄─ Layer 3   │
│   ✓ Extract tenant_id                │
│                                      │
│ Prevents:                            │
│ ❌ Token forgery                     │
│ ❌ Tenant spoofing                   │
│ ❌ Expired access                    │
│ ❌ Token tampering                   │
└──────────────────────────────────────┘

COMBINED EFFECT:
┌─────────────────────────────────────┐
│ Impossible to breach isolation:     │
│                                     │
│ 1. User must be in database         │
│    ✓ Layer 1: FK constraint         │
│                                     │
│ 2. User must be from same tenant    │
│    ✓ Layer 2: Query filter          │
│                                     │
│ 3. User must have valid token       │
│    ✓ Layer 3: JWT verification      │
│                                     │
│ All 3 must be satisfied             │
│ for data access                     │
└─────────────────────────────────────┘
```

---

## Error Scenarios

```
┌─────────────────────────────────────────────────────────────────────┐
│ ERROR HANDLING & TENANT ISOLATION                                   │
└─────────────────────────────────────────────────────────────────────┘

SCENARIO 1: Sign-Up Without Invite, Domain Not Whitelisted

┌──────────────────────────────────────┐
│ POST /auth/signup                    │
│ { email: "john@unknown.com", ... }   │
└──────────────────────────────────────┘
           ▼
┌──────────────────────────────────────┐
│ TenantResolver.resolve_tenant()      │
│ - Try invite_token: None             │
│ - Try domain match:                  │
│   Query: tenants where               │
│   domain_whitelist contains          │
│   @unknown.com                       │
│   Result: None found                 │
└──────────────────────────────────────┘
           ▼
┌──────────────────────────────────────┐
│ 400 Bad Request                      │
│ {                                    │
│   "detail": "No associated           │
│   organization found for this        │
│   domain. Please use an invite       │
│   link or contact your               │
│   administrator."                    │
│ }                                    │
└──────────────────────────────────────┘

SCENARIO 2: Expired Invite Link

┌──────────────────────────────────────┐
│ POST /auth/signup                    │
│ { ..., invite_token: "<old_token>" } │
└──────────────────────────────────────┘
           ▼
┌──────────────────────────────────────┐
│ JWT.decode(token, secret)            │
│ Check: exp < current_time            │
│ Result: EXPIRED                      │
└──────────────────────────────────────┘
           ▼
┌──────────────────────────────────────┐
│ 400 Bad Request                      │
│ { "detail": "Invite link expired" }  │
└──────────────────────────────────────┘

SCENARIO 3: User Tries Cross-Tenant Access

┌──────────────────────────────────────┐
│ User (Tenant A)                      │
│ Token: JWT(sub=user_a, tenant_id=A)  │
│                                      │
│ GET /api/users/<user_b_id>           │
│ (user_b is in Tenant B)              │
└──────────────────────────────────────┘
           ▼
┌──────────────────────────────────────┐
│ get_current_user(token):             │
│ Extract: tenant_id = "A"             │
│ Set: TenantContext.tenant_id = "A"   │
└──────────────────────────────────────┘
           ▼
┌──────────────────────────────────────┐
│ db.query(User)                       │
│   .filter(                           │
│     User.id == user_b_id,            │
│     User.tenant_id == "A"  ◄─ KEY    │
│   ).first()                          │
│                                      │
│ Result: None                         │
│ (user_b has tenant_id = "B")         │
└──────────────────────────────────────┘
           ▼
┌──────────────────────────────────────┐
│ 404 Not Found                        │
│ (Data doesn't exist for this user)   │
└──────────────────────────────────────┘

SCENARIO 4: Invalid Token Format

┌──────────────────────────────────────┐
│ GET /api/users                       │
│ Authorization: Bearer malformed_text │
└──────────────────────────────────────┘
           ▼
┌──────────────────────────────────────┐
│ JWT.decode(token, secret)            │
│ Result: JWTError (invalid format)    │
└──────────────────────────────────────┘
           ▼
┌──────────────────────────────────────┐
│ 401 Unauthorized                     │
│ {                                    │
│   "detail": "Could not validate      │
│   credentials"                       │
│ }                                    │
└──────────────────────────────────────┘
```

---

## Data Integrity Guarantees

```
┌─────────────────────────────────────────────────────────────────────┐
│ TENANT ISOLATION GUARANTEES AT EACH LAYER                           │
└─────────────────────────────────────────────────────────────────────┘

CONSTRAINT 1: Database Level (NOT NULL + FK)
✓ Every user must have a tenant_id
✓ tenant_id must reference existing tenant
✓ If tenant deleted → all users deleted
✓ Prevents: "homeless" users, invalid references

CONSTRAINT 2: Query Level (Automatic Filter)
✓ Every SELECT includes tenant_id filter
✓ Even admins must explicitly request cross-tenant
✓ Prevents: Accidental data leaks, query mistakes

CONSTRAINT 3: Token Level (JWT Signature)
✓ tenant_id is cryptographically signed
✓ Cannot forge or modify tenant_id
✓ Token becomes invalid if tampered
✓ Prevents: Token forgery, tenant spoofing

CONSTRAINT 4: API Level (Permission Checks)
✓ Platform admin operations require explicit role check
✓ Regular users cannot generate cross-tenant tokens
✓ Prevents: Privilege escalation

RESULT: ZERO Trust Assumption
┌─────────────────────────────────────┐
│ Even if attacker can:               │
│ ❌ Modify database directly         │
│ ❌ Create fake tokens               │
│ ❌ Change query parameters          │
│ ❌ Intercept requests               │
│                                     │
│ Cannot breach isolation if:         │
│ ✓ All 4 layers enforced             │
│ ✓ Keys properly secured             │
│ ✓ SSL/TLS used for transport        │
└─────────────────────────────────────┘
```

---

**Generated:** February 1, 2026  
**Version:** 1.0  
**Status:** ✅ Complete
