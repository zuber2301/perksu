# Invite-Link URL Structure & Examples

## 📍 URL Format Variations

### Primary: Secure JWT Token (Recommended)

```
https://app.sparknode.io/signup?invite_token={JWT_TOKEN}

Example (short):
https://app.sparknode.io/signup?invite_token=eyJ0eXAi

Example (full):
https://app.sparknode.io/signup?invite_token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJ0ZW5hbnRfaWQiOiIxMjNlNDU2Ny1lODliLTEyZDMtYTQ1Ni00MjY2MTQxNzQwMDAiLCJleHAiOjE3MDcwNDMyMDAsImlhdCI6MTcwNjQzODQwMH0.aBcDeFgHiJkLmNoPqRsTuVwXyZ...
```

### Secondary: Simple Tenant ID Parameter (Optional)

```
https://app.sparknode.io/signup?tid={TENANT_UUID}

Example:
https://app.sparknode.io/signup?tid=123e4567-e89b-12d3-a456-426614174000
```

### Fallback: Domain-Based Auto-Tenanting

```
https://app.sparknode.io/signup
(User enters email with whitelisted domain, auto-assigns)

Example flow:
1. User enters: john@triton.com
2. System detects: @triton.com
3. Finds tenant: Triton Inc
4. Auto-assigns on signup
```

---

## 🔗 URL Parameter Breakdown

### invite_token Parameter

**Structure:** JWT Token with 3 parts separated by dots

```
eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9
├─ Header: Algorithm and type

.eyJ0ZW5hbnRfaWQiOiIxMjNlNDU2Ny1lODliLTEyZDMtYTQ1Ni00MjY2MTQxNzQwMDAiLCJleHAiOjE3MDcwNDMyMDAsImlhdCI6MTcwNjQzODQwMH0
├─ Payload: tenant_id, exp, iat (base64 encoded JSON)

.aBcDeFgHiJkLmNoPqRsTuVwXyZ
└─ Signature: HMAC-SHA256 of header+payload (prevents tampering)
```

**Payload Contents (decoded):**

```json
{
  "tenant_id": "123e4567-e89b-12d3-a456-426614174000",
  "exp": 1707043200,  // Unix timestamp: Feb 8, 2026
  "iat": 1706438400   // Unix timestamp: Feb 1, 2026 (issued)
}
```

### tid Parameter (Simple)

```
?tid=123e4567-e89b-12d3-a456-426614174000

Plain UUID:
- Not encrypted
- Readable in URL
- Can be shared verbally (easier but less secure)
- No expiry control
```

---

## 🎨 URL Styling & Display

### Short Display (for messaging)

```
"Click here to join us on Perksu: https://bit.ly/perksu-invite-triton"
(shortened URL hiding long token)
```

### QR Code

```
QR codes commonly used in:
- Printed materials
- Presentations
- Posters

QR decodes to:
https://app.sparknode.io/signup?invite_token=eyJ0eXA...
```

### Email Link

```html
<a href="https://app.sparknode.io/signup?invite_token=eyJ0eXAi...">
  Click here to join Triton on Perksu
</a>

Or with UTM tracking:
<a href="https://app.sparknode.io/signup?invite_token=eyJ0eXAi...&utm_source=email&utm_campaign=invite">
  Join Team Triton
</a>
```

### Mobile Deep Link

```
perksu://signup?invite_token=eyJ0eXAi...

(If mobile app implements deep linking)
```

---

## 📊 Real URL Examples

### Example 1: Triton Inc - 7 Day Link

```
Generated: 2026-02-01 10:00 UTC
Expires:   2026-02-08 10:00 UTC (7 days)

URL: https://app.sparknode.io/signup?invite_token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c

Query Parameter Breakdown:
- Parameter: invite_token
- Value: JWT token (long string)
- Function: Authenticates and identifies tenant
```

### Example 2: Acme Corp - 1 Day Link

```
Generated: 2026-02-01 14:30 UTC
Expires:   2026-02-02 14:30 UTC (1 day)

URL: https://app.sparknode.io/signup?invite_token=eyJ0eXAi...{short_token}...w5c
```

### Example 3: Demo Account - 14 Day Link

```
Generated: 2026-02-01 09:00 UTC
Expires:   2026-02-15 09:00 UTC (14 days)

URL: https://demo.sparknode.io/signup?invite_token=eyJ0eXAi...

With UTM for tracking:
https://demo.sparknode.io/signup?invite_token=eyJ0eXAi...&utm_source=marketing&utm_medium=email&utm_campaign=sales_demo
```

---

## 🔄 URL Parameter Handling

### Frontend Parameter Extraction

```javascript
// React Router - useSearchParams hook
import { useSearchParams } from 'react-router-dom'

export default function SignUp() {
  const [searchParams] = useSearchParams()
  
  // Extract parameters
  const inviteToken = searchParams.get('invite_token')
  const tid = searchParams.get('tid')
  const utm_source = searchParams.get('utm_source')
  
  // Check which method was used
  if (inviteToken) {
    // Secure JWT method
    console.log('Using invite token:', inviteToken)
  } else if (tid) {
    // Simple tenant ID method
    console.log('Using tenant ID:', tid)
  } else {
    // No method - try domain matching on signup
    console.log('No parameters - will use domain matching')
  }
}
```

### Backend Parameter Extraction

```python
# FastAPI
from fastapi import Query, HTTPException

@router.post("/signup")
def signup(
    request: SignUpRequest,
    db: Session = Depends(get_db)
):
    """
    Process signup with optional invite_token parameter
    """
    tenant_id = None
    
    # Method 1: Invite token (most secure)
    if request.invite_token:
        tenant_id = TenantResolver.resolve_from_invite_token(
            request.invite_token, 
            db
        )
    
    # Method 2: Tenant ID parameter (simple)
    if not tenant_id and request.tid:
        tenant_id = TenantResolver.resolve_from_url_parameter(
            request.tid, 
            db
        )
    
    # Method 3: Domain matching (automatic)
    if not tenant_id and request.email:
        tenant_id = TenantResolver.resolve_from_email_domain(
            request.email, 
            db
        )
    
    if not tenant_id:
        raise HTTPException(
            status_code=400, 
            detail="Cannot determine tenant for signup"
        )
    
    # Create user...
```

---

## 🛡️ URL Security Considerations

### ✅ Safe Practices

```
1. HTTPS Only
   ✓ Always use https:// (not http://)
   ✓ Prevents token interception in transit
   ✓ Browser address bar shows 🔒 lock

2. Token in Query Parameter
   ✓ Standard practice for signup flows
   ✓ Not stored in browser history by default (varies)
   ✓ Backend receives token and validates immediately

3. Short URL Services
   ✓ bitly.com → https://bit.ly/perksu-triton
   ✓ Hides long token in URL
   ✓ Easier to share verbally
   ✓ Still passes original URL to server

4. Expiry Validation
   ✓ Token expires after set time (default 7 days)
   ✓ Old links don't work
   ✓ Admin doesn't need to revoke manually
```

### ⚠️ Risky Practices (AVOID)

```
1. HTTP Instead of HTTPS
   ✗ Token transmitted in plain text
   ✗ Can be intercepted by network sniffer
   ✗ Credentials compromised
   → Use HTTPS always

2. Token in URL Fragment (#)
   ✗ Fragment not sent to server
   ✗ Token stays in browser only
   ✗ Cannot be validated
   → Use query parameter (?) instead

3. Storing Token in URL History
   ✗ Token visible in browser history
   ✗ Shared computers = security risk
   → Use short-lived tokens (hours, not years)

4. Reusing Tokens
   ✗ Token used = should be invalidated
   ✗ Currently: no token invalidation (by design)
   ✗ Once user signs up: token is "used"
   → One signup per token (in practice)

5. Long Token Lifetime
   ✗ Old token can be exploited longer
   ✗ Example: year-long links very risky
   → Use short defaults (days, not months)
```

---

## 📈 URL Analytics

### Tracking Signup Source

```javascript
// Frontend
const utm_source = searchParams.get('utm_source')
const utm_medium = searchParams.get('utm_medium')
const utm_campaign = searchParams.get('utm_campaign')

// Send with signup request to track source
signupMutation.mutate({
  ...formData,
  invite_token: inviteToken,
  utm_source,
  utm_medium,
  utm_campaign
})
```

### Analytics URL Examples

```
Email invite:
https://app.sparknode.io/signup?invite_token=xyz&utm_source=email&utm_medium=email&utm_campaign=employee_invite

Slack message:
https://app.sparknode.io/signup?invite_token=xyz&utm_source=slack&utm_medium=social&utm_campaign=employee_invite

Manager to direct report:
https://app.sparknode.io/signup?invite_token=xyz&utm_source=manager&utm_medium=direct&utm_campaign=team_onboarding
```

---

## 🔗 URL Length Considerations

### JWT Token Length

```
Typical JWT token: 300-500 characters
Total URL with token: 350-600 characters

URL limits:
- Browser: ~2000 characters ✅ (safe)
- HTTP GET: ~2000 characters ✅ (safe)
- Email clients: some limit to 100+ lines ✅ (usually OK)
- Text message: 160 characters ❌ (use short URL)
- Twitter/X: 280 characters ❌ (use short URL)

Solution: Use URL shortener services
- bitly.com
- bit.do
- your-domain.io/j/{short_code}
```

### URL Shortening Service Example

```
Long: https://app.sparknode.io/signup?invite_token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c

Short: https://bit.ly/perksu-triton-2026-02

Shared via:
- Email: Click here to join Triton
- SMS: Your Triton invite: bit.ly/perksu-triton-2026-02
- Slack: Triton team just joined Perksu! bit.ly/perksu-triton-2026-02
```

---

## 📋 URL Generation Algorithm

```python
def generate_invite_url(tenant_id: UUID, expiry_hours: int = 168) -> str:
    """
    Generate complete invite URL from scratch
    """
    import os
    from datetime import datetime, timedelta
    from jose import jwt
    
    # Create JWT payload
    now = datetime.utcnow()
    expiry = now + timedelta(hours=expiry_hours)
    
    payload = {
        'tenant_id': str(tenant_id),
        'exp': int(expiry.timestamp()),
        'iat': int(now.timestamp()),
    }
    
    # Encode JWT
    secret_key = os.getenv('JWT_SECRET')
    token = jwt.encode(payload, secret_key, algorithm='HS256')
    
    # Build URL
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')
    invite_url = f"{frontend_url}/signup?invite_token={token}"
    
    return {
        'token': token,
        'url': invite_url,
        'expires_at': expiry.isoformat(),
        'hours_valid': expiry_hours
    }

# Usage
result = generate_invite_url(
    tenant_id=UUID('123e4567-e89b-12d3-a456-426614174000'),
    expiry_hours=168  # 7 days
)

print(result['url'])
# Output: https://app.sparknode.io/signup?invite_token=eyJ0eXA...
```

---

## ✅ URL Testing Checklist

- [ ] URL is HTTPS (not HTTP)
- [ ] Token is in query parameter (not fragment)
- [ ] Token decodes to valid JWT
- [ ] Token includes tenant_id in payload
- [ ] Token includes exp timestamp
- [ ] Token signature can be verified
- [ ] Expiry calculation is correct
- [ ] URL length under 2000 characters
- [ ] Special characters are URL encoded
- [ ] Link works on mobile browsers
- [ ] Deep links work on mobile apps
- [ ] URL shorteners maintain functionality
- [ ] Analytics parameters pass through
- [ ] Clicking link opens signup form
- [ ] Token is extracted on frontend
- [ ] Tenant info displays correctly
- [ ] Expired token shows error message
- [ ] Valid token allows signup completion

---

## 📝 Examples by Use Case

### Internal Employee Hire
```
CEO: "We need to onboard John by Monday"
↓
HR generates: 30-day link
↓
URL: https://app.sparknode.io/signup?invite_token=xyz
↓
Shared: Email + internal Slack
↓
Result: John can sign up anytime this month
```

### External Contractor
```
PM: "Need contractor for 3-month project"
↓
HR generates: 90-day link
↓
URL: https://app.sparknode.io/signup?invite_token=abc
↓
Shared: Email to contractor
↓
Result: Contractor invited for exact duration
```

### Sales Demo
```
Sales: "Prospect demo on Thursday"
↓
Marketing generates: 14-day demo link
↓
URL: https://demo.sparknode.io/signup?invite_token=demo&utm_source=sales&utm_campaign=demo_2026_02
↓
Shared: Sales email + customer meeting
↓
Result: Prospect can explore for 2 weeks
```

### Bulk Onboarding
```
HR: "New cohort of 20 interns"
↓
HR generates: 20 different 6-month links (one per intern)
↓
URL: https://app.sparknode.io/signup?invite_token={unique_per_intern}
↓
Shared: Individual emails
↓
Result: Each intern has personalized link
```

---

**Status:** ✅ **FULLY DOCUMENTED**

All URL variations, parameters, security considerations, and examples are covered.
