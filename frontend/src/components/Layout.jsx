import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { notificationsAPI } from '../lib/api'
import TopHeader from './TopHeader'
import {
  HiOutlineSparkles,
  HiOutlineGift,
  HiOutlineNewspaper,
  HiOutlineCash,
  HiOutlineChartBar,
  HiOutlineUsers,
  HiOutlineClipboardList,
  HiOutlineOfficeBuilding,
  HiOutlineLink,
  HiOutlineCog,
  HiOutlineShieldCheck,
  HiOutlineMenu,
  HiOutlineX,
  HiOutlineHome,
  HiOutlineCurrencyRupee
} from 'react-icons/hi'

const ROLE_DISPLAY_NAMES = {
  platform_admin: 'Perksu Admin',
  hr_admin: 'HR Admin',
  dept_lead: 'Dept Lead',
  user: 'User'
}

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, logout, activeRole } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()

  // Use activeRole for visibility if available, fallback to user.org_role or user.role
  const effectiveRole = activeRole || user?.org_role || user?.role

  const { data: notificationCount } = useQuery({
    queryKey: ['notificationCount'],
    queryFn: () => notificationsAPI.getCount(),
    refetchInterval: 30000,
    enabled: effectiveRole !== 'platform_admin',
  })

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  // Navigation schema based on role
  const getNavigation = () => {
    const base = [
      { name: 'Dashboard', href: '/dashboard', icon: HiOutlineHome },
    ]

    if (effectiveRole === 'platform_admin') {
      return [
        ...base,
        { section: 'Platform' },
        { name: 'Tenants', href: '/tenants', icon: HiOutlineOfficeBuilding },
        { name: 'Platform Users', href: '/admin/users', icon: HiOutlineShieldCheck },
        { name: 'Settings', href: '/settings', icon: HiOutlineCog },
      ]
    }

    if (['hr_admin', 'tenant_manager'].includes(effectiveRole)) {
      return [
        ...base,
        { section: 'Organization' },
        { name: 'Users', href: '/users', icon: HiOutlineUsers },
        { name: 'Departments', href: '/departments', icon: HiOutlineOfficeBuilding },
        { name: 'Budgets', href: '/budgets', icon: HiOutlineCurrencyRupee },
        { name: 'Invites', href: '/admin/invite', icon: HiOutlineLink },
        { name: 'Audit Log', href: '/audit', icon: HiOutlineClipboardList },
      ]
    }

    if (effectiveRole === 'dept_lead') {
      return [
        ...base,
        { section: 'Team' },
        { name: 'Team Budgets', href: '/budgets', icon: HiOutlineCurrencyRupee },
        // Removed Feed/Recognize - Lead must switch to 'User' persona to see personal activity
      ]
    }

    // Default 'user' role
    return [
      ...base,
      { name: 'Feed', href: '/feed', icon: HiOutlineNewspaper },
      { name: 'Recognize', href: '/recognize', icon: HiOutlineSparkles },
      { name: 'Wallet', href: '/wallet', icon: HiOutlineCash },
      { name: 'Redeem', href: '/redeem', icon: HiOutlineGift },
    ]
  }

  const navItems = getNavigation()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out
        lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full uppercase-titles">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 bg-white">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-gradient-to-br from-perksu-purple to-perksu-blue rounded-xl flex items-center justify-center shadow-lg shadow-perksu-purple/20">
                <span className="text-white font-bold text-lg">P</span>
              </div>
              <span className="text-xl font-bold tracking-tight text-gray-900">
                Perksu
              </span>
            </div>
            <button className="lg:hidden p-2 -mr-2 text-gray-400 hover:text-gray-500" onClick={() => setSidebarOpen(false)}>
              <HiOutlineX className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {navItems.map((item, idx) => {
              if (item.section) {
                return (
                  <div key={`section-${idx}`} className="pt-6 pb-2">
                    <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                      {item.section}
                    </p>
                  </div>
                )
              }
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  className={({ isActive }) => 
                    `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                      isActive 
                        ? 'bg-perksu-purple/10 text-perksu-purple' 
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`
                  }
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className={`w-5 h-5 transition-colors ${location.pathname === item.href ? 'text-perksu-purple' : 'text-gray-400 group-hover:text-gray-600'}`} />
                  {item.name}
                </NavLink>
              )
            })}
          </nav>

          {/* User section (Bottom) */}
          <div className="p-4 bg-gray-50/50 border-t border-gray-100">
            <div className="flex items-center gap-3 p-2 rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 flex items-center justify-center text-perksu-purple font-bold shadow-sm">
                {user?.first_name?.[0]}{user?.last_name?.[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">
                  {user?.first_name}
                </p>
                <p className="text-[10px] font-bold text-perksu-purple/60 uppercase tracking-wider truncate">
                  {ROLE_DISPLAY_NAMES[effectiveRole] || effectiveRole}
                </p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <TopHeader onMenuClick={() => setSidebarOpen(true)} />

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
