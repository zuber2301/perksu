import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Layout from './components/Layout'
import Login from './pages/Login'
import SignUp from './pages/SignUp'
import Dashboard from './pages/Dashboard'
import Feed from './pages/Feed'
import Recognize from './pages/Recognize'
import Redeem from './pages/Redeem'
import Wallet from './pages/Wallet'
import Budgets from './pages/Budgets'
import Users from './pages/Users'
import Audit from './pages/Audit'
import Profile from './pages/Profile'
import Tenants from './pages/Tenants'
import AdminUserManagement from './components/AdminUserManagement'
import TenantSettings from './components/TenantSettings'
import InviteLinkGenerator from './components/InviteLinkGenerator'
import TenantManagerDashboard from './components/TenantManagerDashboard'
import Departments from './pages/Departments'
import Marketplace from './pages/Marketplace'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import RewardsAdmin from './pages/RewardsAdmin'

function PrivateRoute({ children, requiredRole = null }) {
  const { isAuthenticated, activeRole } = useAuthStore()
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />
  }
  
  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
    if (!roles.includes(activeRole) && activeRole !== 'platform_admin') {
      return <Navigate to="/dashboard" />
    }
  }
  
  return children
}

function DashboardRoute() {
  const { isAuthenticated, activeRole } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" />
  
  // Platform admin persona sees Tenants view at /dashboard
  if (activeRole === 'platform_admin') return <Tenants />
  
  // HR Admin sees the management dashboard
  if (['hr_admin'].includes(activeRole)) return <TenantManagerDashboard />
  
  // Dept Lead and standard User see the individual dashboard
  const userRoles = ['dept_lead', 'user']
  if (userRoles.includes(activeRole)) return <Dashboard />
  
  // Fallback to login if role unknown
  return <Navigate to="/login" />
}

function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />

      {/* Protected Routes */}
      <Route path="/" element={
        <PrivateRoute>
          <Layout />
        </PrivateRoute>
      }>
        <Route index element={<Navigate to="/dashboard" />} />
        <Route path="dashboard" element={<DashboardRoute />} />
        <Route path="feed" element={
          <PrivateRoute requiredRole={['user', 'dept_lead']}>
            <Feed />
          </PrivateRoute>
        } />
        <Route path="recognize" element={
          <PrivateRoute requiredRole={['user', 'dept_lead']}>
            <Recognize />
          </PrivateRoute>
        } />
        <Route path="redeem" element={
          <PrivateRoute requiredRole={['user', 'dept_lead', 'hr_admin']}>
            <Redeem />
          </PrivateRoute>
        } />
        <Route path="wallet" element={
          <PrivateRoute requiredRole={['user', 'dept_lead']}>
            <Wallet />
          </PrivateRoute>
        } />
        <Route path="budgets" element={
          <PrivateRoute requiredRole={['hr_admin', 'dept_lead']}>
            <Budgets />
          </PrivateRoute>
        } />
        <Route path="users" element={
          <PrivateRoute requiredRole={['hr_admin']}>
            <Users />
          </PrivateRoute>
        } />
        <Route path="audit" element={
          <PrivateRoute requiredRole={['hr_admin', 'platform_admin']}>
            <Audit />
          </PrivateRoute>
        } />
        <Route path="tenants" element={
          <PrivateRoute requiredRole="platform_admin">
            <Tenants />
          </PrivateRoute>
        } />
        <Route path="departments" element={
          <PrivateRoute requiredRole={['hr_admin']}>
            <Departments />
          </PrivateRoute>
        } />
        <Route path="marketplace" element={
          <PrivateRoute requiredRole={['user', 'dept_lead']}>
            <Marketplace />
          </PrivateRoute>
        } />
        <Route path="analytics" element={
          <PrivateRoute requiredRole={['hr_admin']}>
            <Analytics />
          </PrivateRoute>
        } />
        <Route path="rewards-admin" element={
          <PrivateRoute requiredRole={['hr_admin', 'platform_admin']}>
            <RewardsAdmin />
          </PrivateRoute>
        } />
        <Route path="settings" element={
          <PrivateRoute requiredRole={['hr_admin']}>
            <Settings />
          </PrivateRoute>
        } />
        <Route path="profile" element={<Profile />} />
        
        {/* Backward Compatibility & Fallbacks */}
        <Route path="dashboard/manager" element={<Navigate to="/dashboard" replace />} />
        
        {/* Admin Routes */}
        <Route path="admin/users" element={
          <PrivateRoute requiredRole="platform_admin">
            <AdminUserManagement />
          </PrivateRoute>
        } />
        
        {/* HR Admin Routes */}
        <Route path="settings/organization" element={
          <PrivateRoute requiredRole={['hr_admin']}>
            <TenantSettings />
          </PrivateRoute>
        } />
        
        <Route path="admin/invite" element={
          <PrivateRoute requiredRole={['hr_admin']}>
            <InviteLinkGenerator />
          </PrivateRoute>
        } />

        {/* Catch-all 404 Redirect to Dashboard */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}

export default App
