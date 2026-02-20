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

function PrivateRoute({ children, requiredRole = null }) {
  const { isAuthenticated, user } = useAuthStore()
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />
  }
  
  if (requiredRole) {
    const roles = Array.isArray(requiredRole) ? requiredRole : [requiredRole]
    if (!roles.includes(user?.role) && user?.role !== 'platform_admin') {
      return <Navigate to="/dashboard" />
    }
  }
  
  return children
}

function DashboardRoute() {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" />
  
  // Platform admin sees Tenants view at /dashboard
  if (user?.role === 'platform_admin') return <Tenants />
  
  // Tenant managers and other organizational roles see Dashboard
  const dashboardRoles = ['hr_admin', 'dept_lead', 'user', 'platform_admin']
  if (dashboardRoles.includes(user?.role)) return <Dashboard />
  
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
        <Route path="feed" element={<Feed />} />
        <Route path="recognize" element={<Recognize />} />
        <Route path="redeem" element={<Redeem />} />
        <Route path="wallet" element={<Wallet />} />
        <Route path="budgets" element={<Budgets />} />
        <Route path="users" element={<Users />} />
        <Route path="audit" element={<Audit />} />
        <Route path="tenants" element={
          <PrivateRoute requiredRole="platform_admin">
            <Tenants />
          </PrivateRoute>
        } />
        <Route path="dashboard/manager" element={
          <PrivateRoute>
            <TenantManagerDashboard />
          </PrivateRoute>
        } />
        <Route path="departments" element={
          <PrivateRoute>
            <Departments />
          </PrivateRoute>
        } />
        <Route path="marketplace" element={
          <PrivateRoute>
            <Marketplace />
          </PrivateRoute>
        } />
        <Route path="analytics" element={
          <PrivateRoute>
            <Analytics />
          </PrivateRoute>
        } />
        <Route path="settings" element={
          <PrivateRoute requiredRole={['hr_admin']}>
            <Settings />
          </PrivateRoute>
        } />
        <Route path="profile" element={<Profile />} />
        
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
      </Route>
    </Routes>
  )
}

export default App
