import { NavLink, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { authAPI, tenantsAPI } from '../lib/api'
import { useState, useEffect, useRef } from 'react'
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
  HiOutlineShoppingCart,
  HiOutlineMenu
} from 'react-icons/hi'

const ROLE_DISPLAY_NAMES = {
  platform_admin: 'Perksu Admin',
  hr_admin: 'HR Admin',
  dept_lead: 'Department Lead',
  user: 'User'
}

export default function TopHeader({ onMenuClick }) {
  const { user, token, logout, updateUser, activeRole, switchRole } = useAuthStore()
  const [adminDropdownOpen, setAdminDropdownOpen] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)
  const profileDropdownRef = useRef(null)
  const adminDropdownRef = useRef(null)
  const location = useLocation()

  // Get current page title from location
  const getPageTitle = () => {
    const path = location.pathname.split('/')[1]
    if (!path) return 'Dashboard'
    return path.charAt(0).toUpperCase() + path.slice(1).replace('-', ' ')
  }

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

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false)
      }
      if (adminDropdownRef.current && !adminDropdownRef.current.contains(event.target)) {
        setAdminDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

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

  const effectiveRole = activeRole || user?.org_role || user?.role

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
      <div className="flex items-center justify-between h-16 px-4 lg:px-8">
        {/* Left side: Mobile menu toggle and Page Title */}
        <div className="flex items-center gap-4">
          <button 
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
          >
            <HiOutlineMenu className="w-6 h-6" />
          </button>
          <div className="hidden sm:block">
            <h1 className="text-lg font-semibold text-gray-900">{getPageTitle()}</h1>
          </div>
        </div>

        {/* Right side: Role Switcher, Profile */}
        <div className="flex items-center gap-4">
          {/* Role Switcher (if user has multiple roles) */}
          {user?.availableRoles?.length > 1 && (
            <div className="flex items-center">
              <div className="relative" ref={adminDropdownRef}>
                <button 
                  onClick={() => setAdminDropdownOpen(!adminDropdownOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <span className="hidden sm:inline text-gray-500 font-normal mr-1">Persona:</span>
                  <span>{ROLE_DISPLAY_NAMES[activeRole] || activeRole}</span>
                  <svg className="w-4 h-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.584l3.71-4.354a.75.75 0 111.14.976l-4.25 5a.75.75 0 01-1.14 0l-4.25-5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
                {adminDropdownOpen && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden ring-1 ring-black ring-opacity-5">
                    <div className="py-1">
                      <div className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 border-b border-gray-100 italic">
                        Switch Persona
                      </div>
                      {user.availableRoles.map(role => (
                        <button
                          key={role}
                          onClick={() => {
                            switchRole(role)
                            setAdminDropdownOpen(false)
                            window.location.reload()
                          }}
                          className={`block w-full text-left px-4 py-2.5 text-sm transition-colors ${activeRole === role ? 'bg-perksu-purple/10 text-perksu-purple font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
                        >
                          {ROLE_DISPLAY_NAMES[role] || role}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}



          {/* Profile / Tenant info */}
          <div className="flex items-center gap-3">
            <div className="relative" ref={profileDropdownRef}>
              <button 
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-3 p-1.5 rounded-full hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-perksu-purple to-perksu-blue flex items-center justify-center text-white font-medium shadow-sm">
                  {user?.first_name?.[0] || 'T'}{user?.last_name?.[0] || 'A'}
                </div>
                <div className="hidden lg:flex flex-col text-sm leading-4 text-left mr-1">
                  <span className="font-semibold text-gray-900">{user?.first_name || 'Tenant'}</span>
                  <span className="text-xs text-gray-500">{ROLE_DISPLAY_NAMES[activeRole] || activeRole} Persona</span>
                </div>
                <svg className="w-4 h-4 text-gray-400 hidden lg:block" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.584l3.71-4.354a.75.75 0 111.14.976l-4.25 5a.75.75 0 01-1.14 0l-4.25-5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                </svg>
              </button>
              {profileDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden ring-1 ring-black ring-opacity-5">
                  {/* User Profile Info Header */}
                  <div className="px-4 py-4 bg-gray-50/50 border-b border-gray-100 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-perksu-purple to-perksu-blue flex items-center justify-center text-white font-medium shadow-sm">
                      {user?.first_name?.[0]}{user?.last_name?.[0]}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-900">{user?.first_name} {user?.last_name}</span>
                      <span className="text-xs text-gray-500">{user?.email}</span>
                    </div>
                  </div>

                  {/* Tenant Info Section */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">Organization Context</div>
                    <div className="space-y-1.5">
                      <div className="flex items-center text-xs text-gray-600">
                        <span className="w-16 font-medium text-gray-400">Org:</span> {tenant?.data?.name || tenant?.name || 'Loading...'}
                      </div>
                      <div className="flex items-center text-xs text-gray-600">
                        <span className="w-16 font-medium text-gray-400">ID:</span> <code className="bg-gray-100 px-1 rounded">{tenant?.data?.id ? tenant.data.id.split('-')[0] : (tenant?.id ? tenant.id.split('-')[0] : 'N/A')}</code>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-1">
                    <NavLink 
                      to="/profile" 
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-perksu-purple/5 hover:text-perksu-purple transition-colors" 
                      onClick={() => setProfileDropdownOpen(false)}
                    >
                      <HiOutlineUser className="w-4 h-4" />
                      My Profile
                    </NavLink>
                    <button 
                      onClick={() => { handleLogout(); setProfileDropdownOpen(false); }} 
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <HiOutlineLogout className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}