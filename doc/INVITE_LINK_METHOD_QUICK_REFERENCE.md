# Invite-Link Method - Quick Reference

## 🎯 The Invite-Link Concept

**What:** Tenant Managers generate secure "Join Links" that automatically assign new users to their organization.

**Why:** 
- Zero friction onboarding
- Secure (cryptographically signed)
- Controlled (time-limited, revocable)
- Trackable (audit trail)

**How:** User clicks link → signs up → automatically added to tenant

---

## 📋 Three Onboarding Methods Supported

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Onboarding Options                      │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┐  ┌──────────────────────┐  ┌────────────────────┐
│  1. Domain Match     │  │  2. Invite Link      │  │  3. Admin Entry    │
│  (Automatic)         │  │  (Secure Token)      │  │  (Manual)          │
├──────────────────────┤  ├──────────────────────┤  ├────────────────────┤
│ Email: john@acme.com │  │ Link: /signup?       │  │ HR Admin adds:     │
│ ↓                    │  │ invite_token=xyz...  │  │ - Email            │
│ System detects       │  │ ↓                    │  │ - Name             │
│ @acme.com domain     │  │ User clicks link     │  │ - Role             │
│ ↓                    │  │ ↓                    │  │ ↓                  │
│ Auto-assigns to      │  │ Sees: "Join Acme"   │  │ User receives      │
│ Acme tenant          │  │ ↓                    │  │ invite link        │
│ ✅ Fastest           │  │ Signs up with token  │  │ ↓                  │
│ ⏱️  No admin needed   │  │ ↓                    │  │ User signs up      │
│ 🔒 Domain validated  │  │ Auto-assigned to     │  │ ✅ Admin control   │
│ 📊 Pre-filter users  │  │ Acme tenant          │  │ 🔑 Role setting    │
│                      │  │ ✅ Secure (signed)   │  │ 🎯 Granular        │
│ Good for:            │  │ ⏱️  Time-limited     │  │                    │
│ - Large companies    │  │ 🔒 Cannot forge      │  │ Good for:          │
│ - Known domains      │  │ 📊 Audit trail       │  │ - Specific users   │
│ - Employee hires     │  │                      │  │ - Manager roles    │
│                      │  │ Good for:            │  │ - Sensitive access │
│                      │  │ - External partners  │  │                    │
│                      │  │ - Contractor onboard │  │                    │
│                      │  │ - Demo accounts      │  │                    │
└──────────────────────┘  └──────────────────────┘  └────────────────────┘
```

---

## 🔗 Invite-Link Flow (Detailed)

### Step 1: HR Admin Generates Link

```
❶ HR Admin clicks "Generate Invites"
   ├─ Location: /admin/invite
   ├─ Component: InviteLinkGenerator.jsx
   └─ Requires: hr_admin role

❷ System shows expiry options
   ├─ 1 day
   ├─ 7 days (default)
   ├─ 30 days
   ├─ 90 days
   ├─ 1 year
   └─ Custom (hours)

❸ HR Admin selects expiry + clicks "Generate"

❹ Backend API call
   Request:  POST /api/tenants/invite-link?hours=168
   Auth:     Bearer {admin_token}
   
❺ Backend generates JWT token
   Payload:
   {
     "tenant_id": "123e4567-e89b-12d3-a456-426614174000",
     "exp": 1707043200,  // expiry timestamp
     "iat": 1706438400   // issued at timestamp
   }
   
   Signed with: HMAC-SHA256(secret_key)
   Cannot be forged without secret key

❻ System constructs URL
   Format: https://app.sparknode.io/signup?invite_token={JWT}
   Example: https://app.sparknode.io/signup?invite_token=eyJ0eXAi...

❼ Frontend displays link
   ├─ Full URL for copying
   ├─ Token for API/mobile apps
   ├─ Copy buttons
   └─ Share options (Email, Twitter, Slack)
```

### Step 2: User Receives & Clicks Link

```
❶ HR Admin shares link via
   ├─ Email
   ├─ Slack message
   ├─ WhatsApp
   ├─ or verbal (they need to click the link)
   └─ QR code (if printed)

❷ User receives link
   Example: "Click here to join our Perksu workspace: https://app.sparknode.io/signup?invite_token=xyz..."

❸ User clicks link
   └─ Browser navigates to /signup?invite_token=xyz...

❹ Frontend intercepts URL
   ├─ Extracts: invite_token=xyz...
   ├─ Stores: setInviteToken(token)
   └─ Decodes: JWT (client-side preview)

❺ Frontend displays tenant info
   ├─ Shows: "You're joining [Tenant Name]"
   ├─ Shows: "Link expires in X days"
   ├─ Checks: Is token expired? (Yes/No)
   └─ Color coding: 🟢 Valid, 🔴 Expired, 🟡 Expiring soon

❻ If token is expired
   └─ Show: "This link has expired. Request a new invite from your HR admin."

❼ If token is valid
   └─ Show signup form with fields:
      ├─ Email (optional - pre-filled if possible)
      ├─ Password
      ├─ Confirm Password
      ├─ First Name
      ├─ Last Name
      ├─ Personal Email (optional)
      └─ Mobile Phone (optional)
```

### Step 3: User Completes Signup

```
❶ User fills form
   ├─ Email: (if not pre-filled)
   ├─ Password: secure_password_123
   ├─ Name: John Doe
   └─ Optional: phone, personal email

❷ Frontend validates form
   ├─ Email format: valid@company.com
   ├─ Password: min 8 chars, upper, lower, number
   ├─ Passwords match
   └─ Name not empty

❸ If validation fails
   └─ Show inline errors:
      ├─ "Email must be valid"
      ├─ "Password must contain uppercase"
      ├─ "Passwords don't match"
      └─ "Name required"

❹ User fixes errors and resubmits

❺ Frontend sends to backend
   POST /api/auth/signup
   {
     "email": "john@company.com",
     "password": "SecurePass123!",
     "first_name": "John",
     "last_name": "Doe",
     "personal_email": "john.doe@personal.com",
     "mobile_phone": "+911234567890",
     "invite_token": "eyJ0eXAi..."  ← Include token!
   }

❻ Show: Loading spinner
   └─ Text: "Creating your account..."
```

### Step 4: Backend Validates & Assigns Tenant

```
❶ Backend receives signup request
   ├─ Email: john@company.com
   ├─ Password: SecurePass123!
   ├─ Name: John Doe
   └─ invite_token: eyJ0eXAi...

❷ Backend validates invite token
   ├─ Decode JWT using secret key
   ├─ Check: Is signature valid? ✓
   ├─ Check: Is token expired? (No)
   ├─ Extract: tenant_id from token
   └─ Verify: Does tenant exist?

❸ If token is invalid
   └─ Return error: "Invalid or expired invite link"

❹ If token is valid
   ├─ Extract: tenant_id = "123e4567-e89b-12d3-a456-426614174000"
   └─ Continue to user creation

❺ Backend validates form data
   ├─ Check: Email not already registered
   ├─ Check: Email format valid
   ├─ Check: Password strength OK
   ├─ Check: Name not empty
   └─ Check: Phone format valid (if provided)

❻ If validation fails
   └─ Return error with details:
      ├─ "Email already registered"
      ├─ "Email format invalid"
      └─ "Phone format invalid"

❼ Hash password
   └─ bcrypt(password) → hashed_password

❽ Create user record
   INSERT INTO users (
     email = 'john@company.com',
     password_hash = '$2b$12$...',
     first_name = 'John',
     last_name = 'Doe',
     personal_email = 'john.doe@personal.com',
     mobile_phone = '+911234567890',
     tenant_id = '123e4567-e89b-12d3-a456-426614174000',  ← HARD LINK!
     role = 'employee',
     status = 'active',
     created_at = now()
   )

❾ Create initial wallet
   INSERT INTO wallets (
     user_id = '550e8400-e29b-41d4-a716-446655440000',
     tenant_id = '123e4567-e89b-12d3-a456-426614174000',
     balance = 0,
     created_at = now()
   )

❿ Generate JWT with tenant_id
   Payload:
   {
     "user_id": "550e8400-e29b-41d4-a716-446655440000",
     "tenant_id": "123e4567-e89b-12d3-a456-426614174000",  ← Embedded!
     "email": "john@company.com",
     "role": "employee",
     "exp": 1707384000  // 30 days
   }
```

### Step 5: User Redirected & Onboarded

```
❶ Backend returns response
   {
     "access_token": "eyJ0eXAi...",
     "user": {
       "id": "550e8400-e29b-41d4-a716-446655440000",
       "email": "john@company.com",
       "tenant_id": "123e4567-e89b-12d3-a456-426614174000",
       "first_name": "John",
       "last_name": "Doe",
       "role": "employee",
       "status": "active"
     }
   }

❷ Frontend receives response
   ├─ Store: access_token in localStorage
   ├─ Store: user info in Zustand auth store
   ├─ Hide: Loading spinner
   ├─ Show: Success message
   └─ Text: "Welcome to [Tenant Name]! 🎉"

❸ After 2 seconds, redirect
   └─ navigate('/dashboard')

❹ Dashboard loads
   ├─ Fetch: User's company info (from tenant_id)
   ├─ Fetch: User's feed/activities
   ├─ Display: Welcome message
   ├─ Show: "Welcome, John!"
   ├─ Show: "You're part of [Company Name]"
   └─ Show: Company dashboard/feed

❺ User fully onboarded ✓
   ├─ Email verified
   ├─ Assigned to correct tenant
   ├─ Has access to company resources
   ├─ Can earn points
   ├─ Can redeem rewards
   └─ Part of team on day 1
```

---

## 🔐 Security Layers

### Layer 1: JWT Signature Validation
```
Token: eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ0ZW5hbnRfaWQiOiIxMjNlNDU2N...

Structure: {header}.{payload}.{signature}

Backend validation:
1. Extract: payload from token
2. Create: expected_signature = HMAC_SHA256(header + payload, secret_key)
3. Compare: token_signature == expected_signature
4. Result: ✓ If match (token not tampered)
         ❌ If mismatch (someone tried to modify it)

Impact: Even if attacker gets token, they cannot:
- Change tenant_id
- Change user_id
- Extend expiry
- Modify any claim
```

### Layer 2: Expiry Validation
```
Token Payload:
{
  "tenant_id": "123e4567-e89b-12d3-a456-426614174000",
  "exp": 1707043200  // Unix timestamp for Feb 8, 2026
}

Backend validation:
1. Read: exp claim from token
2. Convert to: expiry_time = datetime.fromtimestamp(1707043200)
3. Compare: now() <= expiry_time
4. Result: ✓ If now is before expiry (token valid)
         ❌ If now is after expiry (token expired)

Impact: Links automatically become useless after set time
- Old links don't work
- Admin doesn't need to manually revoke
- Reduces attack surface
```

### Layer 3: Tenant Verification
```
Backend validation:
1. Extract: tenant_id from token
2. Query: SELECT * FROM tenants WHERE id = tenant_id
3. Result: ✓ If tenant found (tenant still exists)
         ❌ If tenant not found (deleted or invalid)

Impact: Even with valid token, if tenant is deleted:
- New signups cannot proceed
- Prevents orphaned users
```

### Layer 4: Database Constraint
```
SQL Schema:
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR NOT NULL,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  role VARCHAR NOT NULL,
  ...
)

Impact:
- tenant_id is NOT NULL (cannot be empty)
- FOREIGN KEY constraint (must exist in tenants table)
- ON DELETE CASCADE (if tenant deleted, user deleted)
- User ALWAYS bound to a tenant (no orphaned users)
```

### Layer 5: JWT in All Requests
```
After signup, user makes subsequent requests:
GET /api/users/me
Authorization: Bearer eyJ0eXAi...

Backend validation:
1. Extract: user_id and tenant_id from JWT
2. For every query: add WHERE tenant_id = '{user.tenant_id}'
3. Result: User can ONLY see data from their tenant

Impact:
- User cannot access other tenants' data
- All queries automatically scoped to tenant
- No accidental data leaks
- Three-layer isolation (DB + App + JWT)
```

---

## 📊 Comparison: Invite Link vs Domain Matching

```
Feature                 | Invite Link         | Domain Matching
──────────────────────────────────────────────────────────────
Ease of use            | Easy (share link)   | Easiest (auto)
Admin control          | High (per user)     | Medium (per domain)
Security               | Very high (JWT)     | High (domain check)
Friction for user      | Low (1 click)       | None (auto)
Scaling                | Good (multi-link)   | Excellent (auto)
External partners      | ✅ Yes              | ❌ No
Contractors            | ✅ Yes              | Depends
Employees              | ✅ Yes              | ✅ Yes
Verification level     | Cryptographic       | Domain ownership
Audit trail            | ✅ Yes (token)      | ✅ Yes (domain)
Expiry control         | ✅ Yes (per link)   | ✅ Yes (forever)
```

---

## 🎓 Real-World Examples

### Example 1: Triton Engineering Hires New Developer

```
Friday 4 PM: HR gets "New hire starting Monday"
  ↓
HR goes to Perksu → /admin/invite
  ↓
Clicks "Generate Invite"
  ↓
Selects: 7 days expiry
  ↓
System generates: https://app.sparknode.io/signup?invite_token=xyz...
  ↓
HR copies link and emails to new hire + team
  ↓
Monday 9 AM: New developer clicks link
  ↓
See: "You're joining Triton Engineering"
  ↓
Sign up with email: developer@triton.com
  ↓
Backend checks token → valid
  ↓
Backend checks domain → @triton.com matches
  ↓
User created with:
  - tenant_id = Triton's ID
  - role = employee
  - status = active
  ↓
Redirect to dashboard
  ↓
"Welcome! You're part of Triton"
```

### Example 2: External Contractor Onboarding

```
Monday: Project manager needs contractor for 3-month project
  ↓
Goes to Perksu → /admin/invite
  ↓
Generates 90-day expiry link (contractor will leave)
  ↓
Link: https://app.sparknode.io/signup?invite_token=abc...
  ↓
Sends link to contractor via email: "Join our Perksu workspace"
  ↓
Contractor clicks link
  ↓
See: "You're joining Acme Corporation"
  ↓
Sign up with external email: contractor@freelance.com
  ↓
Assigned to Acme tenant
  ↓
Can only see Acme's feeds and projects
  ↓
Cannot see other tenants' data
  ↓
After 90 days: Link expires
  ↓
If contractor account not deleted: still has access (admin can manually delete)
```

### Example 3: Demo Account for Sales

```
Prospect: "Can we see a demo?"
  ↓
Sales team generates 14-day expiry link
  ↓
Creates account with demo data pre-loaded
  ↓
Sends link: "Try Perksu free for 14 days"
  ↓
Prospect clicks and signs up
  ↓
See: "Welcome to Demo Workspace"
  ↓
Can access demo data and features
  ↓
After 14 days: Link expires
  ↓
Prospect can still log in but cannot create new links
  ↓
Sales follows up before expiry
```

---

## ✅ Implementation Checklist

- [x] Backend: TenantResolver.create_invite_token()
- [x] Backend: TenantResolver.resolve_from_invite_token()
- [x] Backend: POST /tenants/invite-link endpoint
- [x] Backend: POST /auth/signup with invite_token support
- [x] Frontend: SignUp.jsx extracts invite_token
- [x] Frontend: SignUp.jsx decodes JWT (preview)
- [x] Frontend: InviteLinkGenerator.jsx generates links
- [x] Frontend: Copy-to-clipboard functionality
- [x] Frontend: Social sharing (Email, Twitter)
- [x] Frontend: Expiry date display
- [x] Frontend: Multiple link generation
- [x] Documentation: This file!

---

## 🚀 Next Steps

1. **Test locally:**
   ```bash
   npm run build  # No errors?
   npm run dev    # Start frontend
   # In another terminal
   cd backend && python -m uvicorn main:app --reload
   ```

2. **Test invite flow:**
   - Go to /admin/invite (as HR admin)
   - Generate a link
   - Open in private window
   - Sign up with new email
   - Verify automatically assigned to tenant

3. **Test expiry:**
   - Generate link with 1 hour expiry
   - Wait 1+ hour
   - Try to sign up
   - Should see: "Link has expired"

4. **Deploy to staging:**
   - Run full QA
   - Test with real email delivery
   - Monitor error rates

5. **Deploy to production:**
   - Monitor adoption
   - Track signup success rate
   - Collect user feedback

---

**Status:** ✅ **FULLY IMPLEMENTED & DOCUMENTED**
