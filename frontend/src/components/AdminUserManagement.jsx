import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { 
  HiOutlineUsers, 
  HiOutlineSearch, 
  HiOutlineFilter,
  HiOutlineChevronDown,
  HiOutlineEye,
  HiOutlineMail,
  HiOutlinePhone,
  HiOutlineCalendar,
  HiOutlineCheck,
  HiOutlineX,
  HiOutlineDocumentDuplicate
} from 'react-icons/hi'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: `${API_URL}/api`,
})

// Add auth token interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default function AdminUserManagement({ tenantId }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState({
    department_id: null,
    role: null,
    status: null,
  })
  const [showFilters, setShowFilters] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [pagination, setPagination] = useState({
    skip: 0,
    limit: 20,
  })

  // Fetch users
  const { data: usersData, isLoading, refetch } = useQuery({
    queryKey: ['tenantUsers', tenantId, filters, pagination],
    queryFn: async () => {
      const params = {
        ...pagination,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== null))
      }
      const response = await api.get(`/users/admin/by-tenant/${tenantId}`, { params })
      return response.data
    },
    enabled: !!tenantId,
  })

  // Fetch departments (for filter options)
  const { data: departmentsData } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const response = await api.get('/tenants/departments')
      return response.data
    },
  })

  const users = Array.isArray(usersData) ? usersData : []

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value || null
    }))
    setPagination(prev => ({ ...prev, skip: 0 }))
  }

  const clearFilters = () => {
    setFilters({ department_id: null, role: null, status: null })
    setSearchTerm('')
  }

  const filteredUsers = users.filter(user => {
    if (!searchTerm) return true
    const searchLower = searchTerm.toLowerCase()
    return (
      user.first_name?.toLowerCase().includes(searchLower) ||
      user.last_name?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower)
    )
  })

  const handleExport = () => {
    const headers = ['Name', 'Email', 'Role', 'Department', 'Status', 'Joined Date']
    const rows = users.map(user => [
      `${user.first_name} ${user.last_name}`,
      user.email,
      user.role,
      user.department_id,
      user.status,
      new Date(user.created_at).toLocaleDateString()
    ])

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `users-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const StatusBadge = ({ status }) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      deactivated: 'bg-red-100 text-red-800',
      pending_invite: 'bg-yellow-100 text-yellow-800',
    }
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status === 'pending_invite' ? 'Pending Invite' : status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="border-b border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HiOutlineUsers className="h-6 w-6 text-indigo-600" />
            <h2 className="text-2xl font-bold text-gray-800">
              Team Members
            </h2>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <HiOutlineDocumentDuplicate className="h-4 w-4" />
            Export CSV
          </button>
        </div>

        {/* Search and Filter Bar */}
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <HiOutlineSearch className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 font-medium"
          >
            <HiOutlineFilter className="h-4 w-4" />
            {showFilters ? 'Hide' : 'Show'} Filters
          </button>

          {/* Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-gray-200">
              {/* Department Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <select
                  value={filters.department_id || ''}
                  onChange={(e) => handleFilterChange('department_id', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Departments</option>
                  {departmentsData?.map(dept => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>

              {/* Role Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Role
                </label>
                <select
                  value={filters.role || ''}
                  onChange={(e) => handleFilterChange('role', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Roles</option>
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                  <option value="hr_admin">HR Admin</option>
                  <option value="tenant_lead">Tenant Lead</option>
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={filters.status || ''}
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="deactivated">Deactivated</option>
                  <option value="pending_invite">Pending Invite</option>
                </select>
              </div>

              {/* Clear Button */}
              <button
                onClick={clearFilters}
                className="col-span-full text-sm text-gray-600 hover:text-gray-700 underline"
              >
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin">
              <div className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-indigo-100">
                <div className="h-6 w-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"></div>
              </div>
            </div>
            <span className="ml-2 text-gray-600">Loading users...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-8">
            <HiOutlineUsers className="h-12 w-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-600">No users found</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold text-sm">
                        {user.first_name?.[0]}{user.last_name?.[0]}
                      </div>
                      <div className="ml-3">
                        <p className="font-medium text-gray-800">
                          {user.first_name} {user.last_name}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <HiOutlineMail className="h-4 w-4 flex-shrink-0" />
                      {user.email}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded">
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge status={user.status} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <HiOutlineCalendar className="h-4 w-4" />
                      {new Date(user.created_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedUser(user)}
                      className="text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                    >
                      <HiOutlineEye className="h-4 w-4" />
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {filteredUsers.length > 0 && (
        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            Showing {filteredUsers.length} of {users.length} users
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, skip: Math.max(0, prev.skip - prev.limit) }))}
              disabled={pagination.skip === 0}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPagination(prev => ({ ...prev, skip: prev.skip + prev.limit }))}
              disabled={filteredUsers.length < pagination.limit}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* User Detail Modal */}
      {selectedUser && (
        <UserDetailModal 
          user={selectedUser} 
          onClose={() => setSelectedUser(null)}
        />
      )}
    </div>
  )
}

// User Detail Modal Component
function UserDetailModal({ user, onClose }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="h-16 w-16 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold text-lg">
            {user.first_name?.[0]}{user.last_name?.[0]}
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-800">
              {user.first_name} {user.last_name}
            </h2>
            <p className="text-sm text-gray-600">{user.role}</p>
          </div>
        </div>

        <div className="space-y-4 mb-6 pb-6 border-b border-gray-200">
          <div>
            <label className="text-xs text-gray-600 uppercase font-semibold">Email</label>
            <p className="text-gray-800">{user.email}</p>
          </div>

          {user.personal_email && (
            <div>
              <label className="text-xs text-gray-600 uppercase font-semibold">Personal Email</label>
              <p className="text-gray-800">{user.personal_email}</p>
            </div>
          )}

          {user.mobile_phone && (
            <div>
              <label className="text-xs text-gray-600 uppercase font-semibold">Phone</label>
              <p className="text-gray-800">{user.mobile_phone}</p>
            </div>
          )}

          <div>
            <label className="text-xs text-gray-600 uppercase font-semibold">Status</label>
            <p className="text-gray-800 capitalize">{user.status.replace('_', ' ')}</p>
          </div>

          <div>
            <label className="text-xs text-gray-600 uppercase font-semibold">Joined</label>
            <p className="text-gray-800">{new Date(user.created_at).toLocaleDateString()} at {new Date(user.created_at).toLocaleTimeString()}</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
        >
          Close
        </button>
      </div>
    </div>
  )
}
