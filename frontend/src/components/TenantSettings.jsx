import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { 
  HiOutlineCog, 
  HiOutlinePlus,
  HiOutlineTrash,
  HiOutlineCheckCircle,
  HiOutlineExclamationCircle
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

export default function TenantSettings() {
  const [domainWhitelist, setDomainWhitelist] = useState([])
  const [newDomain, setNewDomain] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState('')

  // Fetch current tenant
  const { data: tenant, isLoading: tenantLoading } = useQuery({
    queryKey: ['currentTenant'],
    queryFn: async () => {
      const response = await api.get('/tenants/current')
      return response.data
    },
  })

  useEffect(() => {
    if (tenant?.domain_whitelist) {
      setDomainWhitelist(tenant.domain_whitelist)
    }
  }, [tenant])

  // Update domain whitelist mutation
  const updateWhitelistMutation = useMutation({
    mutationFn: (domains) => api.put('/tenants/current/domain-whitelist', { domains }),
    onSuccess: (response) => {
      setDomainWhitelist(response.data.domain_whitelist || response.data.domains)
      setIsEditing(false)
      setNewDomain('')
      setError('')
      toast.success('Domain whitelist updated successfully')
    },
    onError: (error) => {
      const message = error.response?.data?.detail || 'Failed to update domain whitelist'
      setError(message)
      toast.error(message)
    },
  })

  const validateDomain = (domain) => {
    // Basic domain validation: should be @domain.com format
    if (!/^@[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(domain)) {
      return 'Domain must be in format: @company.com'
    }
    return ''
  }

  const handleAddDomain = () => {
    setError('')

    if (!newDomain.trim()) {
      setError('Please enter a domain')
      return
    }

    if (!newDomain.startsWith('@')) {
      setError('Domain must start with @')
      return
    }

    const validationError = validateDomain(newDomain)
    if (validationError) {
      setError(validationError)
      return
    }

    if (domainWhitelist.includes(newDomain)) {
      setError('This domain is already in the whitelist')
      return
    }

    const updatedList = [...domainWhitelist, newDomain]
    updateWhitelistMutation.mutate(updatedList)
  }

  const handleRemoveDomain = (domain) => {
    const updatedList = domainWhitelist.filter(d => d !== domain)
    updateWhitelistMutation.mutate(updatedList)
  }

  if (tenantLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin">
          <div className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-indigo-100">
            <div className="h-6 w-6 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin"></div>
          </div>
        </div>
        <span className="ml-2 text-gray-600">Loading settings...</span>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-200">
        <HiOutlineCog className="h-6 w-6 text-indigo-600" />
        <h2 className="text-2xl font-bold text-gray-800">Organization Settings</h2>
      </div>

      {/* Domain Whitelist Section */}
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Email Domain Whitelist</h3>
          <p className="text-gray-600 text-sm mb-4">
            Add email domains to automatically assign new sign-ups to your organization. 
            For example, add <code className="bg-gray-100 px-2 py-1 rounded text-sm">@company.com</code> to 
            automatically onboard anyone signing up with a @company.com email address.
          </p>

          {/* Add Domain Form */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Add New Domain
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newDomain}
                onChange={(e) => {
                  setNewDomain(e.target.value)
                  setError('')
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') handleAddDomain()
                }}
                placeholder="@company.com"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                disabled={updateWhitelistMutation.isPending}
              />
              <button
                onClick={handleAddDomain}
                disabled={updateWhitelistMutation.isPending}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 font-medium flex items-center gap-2"
              >
                <HiOutlinePlus className="h-4 w-4" />
                Add
              </button>
            </div>
            {error && (
              <div className="mt-2 flex items-center gap-2 text-red-600 text-sm">
                <HiOutlineExclamationCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>

          {/* Domains List */}
          <div className="space-y-2">
            {domainWhitelist.length === 0 ? (
              <div className="text-center py-6 bg-gray-50 rounded-lg">
                <p className="text-gray-600">No domains added yet</p>
                <p className="text-gray-500 text-sm mt-1">Add a domain to enable automatic onboarding</p>
              </div>
            ) : (
              <div className="space-y-2">
                {domainWhitelist.map((domain) => (
                  <div
                    key={domain}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <HiOutlineCheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                      <div>
                        <p className="font-mono font-semibold text-gray-800">{domain}</p>
                        <p className="text-xs text-gray-600 mt-1">
                          Users with {domain} email will auto-join this organization
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveDomain(domain)}
                      disabled={updateWhitelistMutation.isPending}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                      title="Remove domain"
                    >
                      <HiOutlineTrash className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
          <h4 className="font-semibold text-blue-900 mb-2">How it works:</h4>
          <ul className="text-blue-800 text-sm space-y-1">
            <li>✓ When someone signs up with an email matching a whitelisted domain, they're automatically assigned to your organization</li>
            <li>✓ They can also join via invite links if you prefer controlled onboarding</li>
            <li>✓ Add multiple domains to support various email formats or company subsidiaries</li>
          </ul>
        </div>
      </div>

      {/* Stats Section */}
      {tenant && (
        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Organization Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Organization Name</p>
              <p className="text-2xl font-bold text-gray-800">{tenant.name}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Subscription Tier</p>
              <p className="text-2xl font-bold text-gray-800 capitalize">{tenant.subscription_tier}</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Status</p>
              <p className="text-2xl font-bold text-gray-800 capitalize">{tenant.status}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
