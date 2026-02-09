import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { authAPI, tenantsAPI } from '../lib/api'
import { useState, useEffect } from 'react'
import {
  HiOutlineHome,
  HiOutlineUser,
  HiOutlineLogout,
  HiOutlineSearch,
  HiOutlineCurrencyRupee,
  HiOutlineOfficeBuilding,
  HiOutlineUsers,
  HiOutlineGift,
  HiOutlineChartBar,
  HiOutlineCog,
  HiOutlineSparkles,
  HiOutlineCash,
  HiOutlineShoppingCart
} from 'react-icons/hi'

const ROLE_DISPLAY_NAMES = {
  platform_admin: 'Perksu Admin',
  hr_admin: 'HR Admin',
  tenant_manager: 'Tenant Manager',
  manager: 'Manager',
  employee: 'Employee'
}

export default function TopHeader() {
  const { user, token, logout, updateUser } = useAuthStore()
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)

  // Fetch current tenant info
  const { data: tenant } = useQuery({
    queryKey: ['tenant', 'current'],
    queryFn: () => tenantsAPI.getCurrent(),
    enabled: !!token,
  })

  // Refresh current user to ensure we have the latest org_role
  useQuery({
    queryKey: ['me'],
    queryFn: () => authAPI.me().then((r) => r.data),
    enabled: !!token,
    onSuccess: (data) => {
      if (data) updateUser(data)
    },
  })

  // Also force a fresh fetch on mount when token exists to avoid stale cache issues
  useEffect(() => {
    if (!token) return
    let cancelled = false
    authAPI
      .me()
      .then((r) => {
        if (!cancelled && r?.data) updateUser(r.data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [token, updateUser])

  const handleLogout = () => {
    logout()
  }

  const effectiveRole = user?.org_role || user?.role

  let navigation = []
  if (effectiveRole === 'tenant_manager') {
    navigation = [
      { name: 'Dashboard', href: '/dashboard', icon: HiOutlineHome },
      { name: 'Departments', href: '/departments', icon: HiOutlineOfficeBuilding },
      { name: 'User Management', href: '/users', icon: HiOutlineUsers },
      { name: 'Marketplace & Rewards', href: '/marketplace', icon: HiOutlineShoppingCart },
      { name: 'Analytics & Reports', href: '/analytics', icon: HiOutlineChartBar },
      { name: 'Settings', href: '/settings', icon: HiOutlineCog },
    ]
  } else if (user?.role === 'hr_admin') {
    navigation = [
      { name: 'Recognize', href: '/recognize', icon: HiOutlineSparkles },
      { name: 'Feed 📱', href: '/feed' },
      { name: 'Wallet', href: '/wallet', icon: HiOutlineCash },
      { name: 'Redeem', href: '/redeem', icon: HiOutlineGift },
    ]
  } else {
    navigation = [
      { name: 'Recognize', href: '/recognize', icon: HiOutlineSparkles },
      { name: 'Feed 📱', href: '/feed' },
      { name: 'Wallet', href: '/wallet', icon: HiOutlineCash },
      { name: 'Redeem', href: '/redeem', icon: HiOutlineGift },
    ]
  }

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
      {/* Primary navigation tabs */}
      {navigation && (
        <div className="flex items-center justify-between h-16 px-4 lg:px-8">
          {/* Left side: Navigation tabs (pill style) */}
          <div className="flex items-center gap-3">
            {navigation.map((tab) => (
              <NavLink
                key={tab.href}
                to={tab.href}
                className={({ isActive }) => 
                  `inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${isActive ? 'bg-perksu-purple/10 text-perksu-purple' : 'text-gray-700 hover:bg-gray-50'}`
                }
              >
                {tab.icon && (
                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md ${""}`}>
                    <tab.icon className="w-4 h-4" />
                  </span>
                )}
                <span className="hidden sm:inline">{tab.name}</span>
              </NavLink>
            ))}
          </div>

          {/* Right side: Admin dropdown, Notifications, Profile */}
          <div className="flex items-center gap-4">
            {/* Admin dropdown (for tenant_manager) */}
            {effectiveRole === 'tenant_manager' && (
              <div className="hidden lg:flex items-center">
                <div className="relative">
                  <button 
                    onClick={() => setAdminDropdownOpen(!adminDropdownOpen)}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-50"
                  >
                    <span className="hidden lg:inline">Admin</span>
                    <svg className="w-4 h-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.584l3.71-4.354a.75.75 0 111.14.976l-4.25 5a.75.75 0 01-1.14 0l-4.25-5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                  </button>
                  {adminDropdownOpen && (
                    <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                      <NavLink to="/budgets" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setAdminDropdownOpen(false)}>Budgets</NavLink>
                      <NavLink to="/users" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setAdminDropdownOpen(false)}>Users</NavLink>
                      <NavLink to="/audit" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setAdminDropdownOpen(false)}>Audit</NavLink>
                    </div>
                  )}
                </div>
              </div>
            )}



            {/* Profile / Tenant info */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <button 
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-r from-perksu-purple to-perksu-blue flex items-center justify-center text-white font-medium">
                    {user?.first_name?.[0] || 'T'}{user?.last_name?.[0] || 'A'}
                  </div>
                  <div className="hidden md:flex flex-col text-sm leading-4 text-left">
                    <span className="font-medium text-gray-900">{user?.first_name || 'Tenant'}</span>
                    <span className="text-xs text-gray-500">{ROLE_DISPLAY_NAMES[user?.org_role] || ROLE_DISPLAY_NAMES[user?.role] || user?.org_role}</span>
                  </div>
                  <svg className="w-4 h-4 text-gray-500" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.584l3.71-4.354a.75.75 0 111.14.976l-4.25 5a.75.75 0 01-1.14 0l-4.25-5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
                {profileDropdownOpen && (
                  <div className="absolute top-full right-0 mt-1 w-56 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                    {/* Tenant Info Section */}
                    <div className="px-4 py-3 border-b border-gray-100">
                      <div className="text-xs text-gray-500 font-medium uppercase">Account Info</div>
                      <div className="mt-2 space-y-1">
                        <div className="text-xs text-gray-600">
                          <span className="font-medium">Tenant Name:</span> {tenant?.data?.organization_name || tenant?.organization_name || 'N/A'}
                        </div>
                        <div className="text-xs text-gray-600">
                          <span className="font-medium">Tenant ID:</span> {tenant?.data?.id ? tenant.data.id.split('-')[0] : (tenant?.id ? tenant.id.split('-')[0] : 'N/A')}
                        </div>
                      </div>
                    </div>
                    {/* Menu Items */}
                    <NavLink to="/profile" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setProfileDropdownOpen(false)}>Profile</NavLink>
                    <button onClick={() => { handleLogout(); setProfileDropdownOpen(false); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Logout</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}