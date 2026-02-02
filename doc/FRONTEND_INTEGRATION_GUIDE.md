# Frontend Integration Guide

This guide walks you through integrating the three new frontend components into your Perksu application.

## Components Created

### 1. **SignUp.jsx** - User Self-Registration
**Location:** `frontend/src/pages/SignUp.jsx`

**Purpose:** Handles user registration with automatic tenant assignment via:
- Email domain matching (if domain is whitelisted)
- Invite token validation (from URL query parameter)

**Key Features:**
- Multi-step UI (form → loading → success/error)
- Automatic invite token extraction from `?invite_token=...` URL parameter
- JWT token decoding to display tenant information
- Form validation (email format, phone format, password matching)
- Optional personal email and mobile phone fields
- Password visibility toggles
- Toast notifications for user feedback
- Auto-redirect to dashboard on success

**Integration Point:**
```jsx
// In your App.jsx router
import SignUp from './pages/SignUp'

// Add this route
<Route path="/signup" element={<SignUp />} />
```

---

### 2. **AdminUserManagement.jsx** - Admin User Panel
**Location:** `frontend/src/components/AdminUserManagement.jsx`

**Purpose:** Platform admin interface to view and filter users across any tenant

**Key Features:**
- View all users for a specific tenant
- Real-time search across name and email
- Multi-field filtering:
  - Department ID
  - Role (Admin, Manager, Employee, etc.)
  - Status (Active, Deactivated, Pending Invite)
- CSV export functionality
- Pagination controls
- User detail modal showing:
  - Full name and contact info
  - Email and phone number
  - Department and role
  - Account status and creation date
- Status badges with color coding:
  - 🟢 Active (green)
  - 🔴 Deactivated (red)
  - 🟡 Pending Invite (yellow)

**API Endpoints Used:**
- `GET /api/users/admin/by-tenant/{tenant_id}` - Fetch tenant users

**Integration Point:**
```jsx
// Create a new page for admin panel
// frontend/src/pages/AdminPanel.jsx

import AdminUserManagement from '../components/AdminUserManagement'
import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'

export default function AdminPanel() {
  const { user, isAdmin } = useAuthStore()
  const navigate = useNavigate()

  if (!isAdmin) {
    navigate('/dashboard')
    return null
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Admin Panel</h1>
      <AdminUserManagement />
    </div>
  )
}

// Then add to App.jsx
import AdminPanel from './pages/AdminPanel'

<Route path="/admin/panel" element={<AdminPanel />} />
```

---

### 3. **TenantSettings.jsx** - Domain Whitelist Management
**Location:** `frontend/src/components/TenantSettings.jsx`

**Purpose:** HR Admin interface to configure email domain auto-onboarding

**Key Features:**
- Display current tenant information
- Add new email domains for auto-onboarding
- Remove domains from whitelist
- Domain validation (requires @domain.com format)
- Duplicate prevention
- Educational info box explaining auto-onboarding
- Organization overview stats:
  - Domain count
  - Total users
  - Active users

**API Endpoints Used:**
- `GET /api/tenants/current` - Fetch current tenant info
- `PUT /api/tenants/current/domain-whitelist` - Update whitelist

**Integration Point:**
```jsx
// Create a new page for tenant settings
// frontend/src/pages/TenantSettings.jsx

import TenantSettings from '../components/TenantSettings'
import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'

export default function TenantSettingsPage() {
  const { user, isHRAdmin } = useAuthStore()
  const navigate = useNavigate()

  if (!isHRAdmin && !user?.is_admin) {
    navigate('/dashboard')
    return null
  }

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Organization Settings</h1>
      <TenantSettings />
    </div>
  )
}

// Then add to App.jsx
import TenantSettingsPage from './pages/TenantSettings'

<Route path="/settings/organization" element={<TenantSettingsPage />} />
```

---

### 4. **InviteLinkGenerator.jsx** - Invite Link Generation
**Location:** `frontend/src/components/InviteLinkGenerator.jsx`

**Purpose:** HR Admin interface to generate secure invite tokens for new team members

**Key Features:**
- One-click invite link generation
- Configurable link expiry (1 hour to 1 year)
- Quick expiry presets: 1 day, 7 days, 30 days, 90 days, 1 year
- Custom expiry time input
- Link display with copy-to-clipboard functionality
- Token display for API/mobile integration
- Social sharing options (Email, Twitter/X)
- Expiry date and time display
- Multiple link generation in one session

**API Endpoints Used:**
- `POST /api/tenants/invite-link?hours={hours}` - Generate invite token

**Integration Point:**
```jsx
// Add to TenantSettingsPage or create new HRAdminPanel
import InviteLinkGenerator from '../components/InviteLinkGenerator'

<Route path="/admin/invite" element={<InviteLinkGenerator />} />

// Or embed in an existing HR admin page
export default function HRAdminPanel() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Team Management</h2>
        <InviteLinkGenerator />
      </div>
    </div>
  )
}
```

---

## Complete Router Setup

Add these routes to your `frontend/src/App.jsx`:

```jsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import SignUp from './pages/SignUp'
import Login from './pages/Login'
import AdminPanel from './pages/AdminPanel'
import TenantSettingsPage from './pages/TenantSettings'
import HRAdminPanel from './pages/HRAdminPanel'
import { useAuthStore } from './store/authStore'

function ProtectedRoute({ children, requiredRole = null }) {
  const { user, isLoading } = useAuthStore()

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" />
  }

  if (requiredRole) {
    const hasRequiredRole = user.roles?.includes(requiredRole) || user.is_admin
    if (!hasRequiredRole) {
      return <Navigate to="/dashboard" />
    }
  }

  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />

        {/* Protected Routes */}
        <Route element={<Layout />}>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />

          {/* Admin Routes */}
          <Route
            path="/admin/panel"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminPanel />
              </ProtectedRoute>
            }
          />

          {/* HR Admin Routes */}
          <Route
            path="/settings/organization"
            element={
              <ProtectedRoute requiredRole="hr_admin">
                <TenantSettingsPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin/invite"
            element={
              <ProtectedRoute requiredRole="hr_admin">
                <HRAdminPanel />
              </ProtectedRoute>
            }
          />
        </Route>

        {/* Default Route */}
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
    </BrowserRouter>
  )
}
```

---

## Navigation Setup

Update your `Layout.jsx` or navigation component to include links to these new features:

```jsx
// Add to your navigation/sidebar
const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: HiHome },
  // ... other items ...
  {
    label: 'Administration',
    icon: HiShieldCheck,
    submenu: [
      { label: 'User Management', path: '/admin/panel', requiredRole: 'admin' },
      { label: 'Organization Settings', path: '/settings/organization', requiredRole: 'hr_admin' },
      { label: 'Generate Invites', path: '/admin/invite', requiredRole: 'hr_admin' },
    ],
  },
]
```

---

## API Configuration

Ensure your `frontend/src/lib/api.js` is properly configured:

```javascript
import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: `${API_URL}/api`,
})

// Request interceptor - Add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Response interceptor - Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
```

---

## Environment Configuration

Create or update `frontend/.env`:

```env
VITE_API_URL=http://localhost:8000
VITE_APP_NAME=Perksu
VITE_JWT_SECRET=your-jwt-secret-here
```

And update `frontend/.env.production`:

```env
VITE_API_URL=https://api.your-domain.com
VITE_APP_NAME=Perksu
```

---

## Dependencies Check

Ensure these npm packages are installed:

```bash
npm install @tanstack/react-query axios react-hot-toast react-icons react-router-dom
```

Already included in your `frontend/package.json`:
- ✅ React 18+
- ✅ React Router v6
- ✅ TanStack React Query
- ✅ Axios
- ✅ Tailwind CSS
- ✅ React Icons

---

## Testing the Integration

### 1. Test Signup with Domain Matching

```bash
# Terminal 1: Start backend
cd backend
python -m uvicorn main:app --reload

# Terminal 2: Start frontend
cd frontend
npm run dev
```

**Steps:**
1. Navigate to `http://localhost:5173/signup`
2. Use an email with a whitelisted domain (e.g., if @acme.com is whitelisted, use your-name@acme.com)
3. Fill in password and other fields
4. Submit form
5. Should redirect to dashboard without requiring invite token

### 2. Test Signup with Invite Token

**Generate token via backend:**
```bash
curl -X POST "http://localhost:8000/api/tenants/invite-link" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

**Then visit:**
```
http://localhost:5173/signup?invite_token=YOUR_TOKEN
```

**Steps:**
1. Form should display tenant info from token
2. Fill in registration form
3. Token should be used for tenant assignment
4. Should work even if email domain isn't whitelisted

### 3. Test Admin Panel

1. Login as platform admin
2. Navigate to `/admin/panel`
3. Select a tenant to view users
4. Test filtering, search, pagination, and CSV export

### 4. Test Organization Settings

1. Login as HR admin
2. Navigate to `/settings/organization`
3. Add a new domain to whitelist
4. Test signup with that domain (new user should auto-assign)

### 5. Test Invite Link Generator

1. Login as HR admin
2. Navigate to `/admin/invite`
3. Generate an invite link
4. Copy and share it
5. New user should be able to sign up using that link

---

## Troubleshooting

### Issue: "Cannot GET /api/tenants/current"
- Ensure HR admin has tenant ID in JWT
- Check TenantContext is set correctly in backend

### Issue: Signup form shows wrong tenant info
- Verify invite token is valid (not expired)
- Check JWT decoding in SignUp.jsx
- Inspect token in browser console

### Issue: Admin panel shows no users
- Verify logged-in user is platform admin
- Check tenant_id parameter is correct
- Ensure backend query filters are working

### Issue: Domain whitelist not working
- Verify domain format includes @ (e.g., @acme.com)
- Check domain is actually saved in database
- Test with new signup form

---

## Next Steps

1. **Route Integration** - Add routes to App.jsx
2. **Navigation Links** - Update Layout/Navigation component
3. **Styling Tweaks** - Customize colors/branding as needed
4. **Testing** - Run integration tests (see above)
5. **Analytics** - Track signup success rates
6. **Documentation** - Update user docs with invite process
7. **Email Templates** - Customize invite email (backend)
8. **Mobile App** - If applicable, use token approach for mobile signup

---

## Support Resources

- Backend tenant setup: `/backend/auth/tenant_utils.py`
- Database schema: `/database/init.sql`
- API documentation: `/TENANT_MANAGEMENT_GUIDE.md`
- Architecture: `/TENANT_USER_MAPPING_ARCHITECTURE.md`
