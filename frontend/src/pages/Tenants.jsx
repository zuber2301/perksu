import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tenantsAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import TenantControlPanel from '../components/TenantControlPanel'
import { 
  HiOutlineOfficeBuilding, 
  HiOutlinePlus, 
  HiOutlineDotsVertical,
  HiOutlineCheckCircle,
  HiOutlineXCircle,
  HiOutlineSearch,
  HiOutlineMail,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineLockClosed,
  HiOutlineEye,
  HiOutlineCurrencyDollar
} from 'react-icons/hi'
import { formatCurrency } from '../lib/currency'
    queryKey: ['tenants'],
    queryFn: async () => {
      const response = await tenantsAPI.getAll()
      return response.data
    },
  })

  // Calculate platform stats for the dashboard
  const stats = tenants ? {
    total: tenants.length,
    active: tenants.filter(t => t.status === 'ACTIVE').length,
    totalBalance: tenants.reduce((acc, t) => acc + parseFloat(t.master_budget_balance), 0),
    enterpriseTier: tenants.filter(t => t.subscription_tier === 'enterprise').length
  } : null

  const provisionMutation = useMutation({
    mutationFn: (data) => tenantsAPI.provision(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['tenants'])
      toast.success('Tenant provisioned successfully')
      setIsModalOpen(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to provision tenant')
    }
  })

  const toggleStatusMutation = useMutation({
    mutationFn: (id) => tenantsAPI.toggleStatus(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['tenants'])
      toast.success('Status updated')
      setActiveDropdown(null)
    },
    onError: () => toast.error('Failed to update status')
  })

  const loadBudgetMutation = useMutation({
    mutationFn: ({ id, data }) => tenantsAPI.loadBudget(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['tenants'])
      toast.success('Budget loaded successfully')
      setIsBudgetModalOpen(false)
      setSelectedTenant(null)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to load budget')
    }
  })

  const filteredTenants = tenants?.filter(tenant => 
    tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.slug.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleProvisionSubmit = (e) => {
    e.preventDefault()
    const payload = {
      name: provName,
      slug: provSlug,
      subscription_tier: e.target.subscription_tier.value,
      initial_balance: parseFloat(e.target.initial_balance.value),
      admin_first_name: e.target.admin_first_name.value,
      admin_last_name: e.target.admin_last_name.value,
      admin_email: e.target.admin_email.value,
      admin_password: e.target.admin_password.value
    }
    provisionMutation.mutate(payload)
  }

  const slugify = (s) => {
    return s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  const handleTenantOpen = (tenant) => {
    const panelTenant = {
      tenant_name: tenant.name || tenant.tenant_name,
      slug: tenant.slug,
      tenant_id: tenant.id || tenant.tenant_id,
      id: tenant.id || tenant.tenant_id,
      name: tenant.name
    }
    setSelectedTenant(panelTenant)
  }

  const handlePanelUpdate = () => {
    queryClient.invalidateQueries(['tenants'])
    setSelectedTenant(null)
  }

  if (selectedTenant && !isBudgetModalOpen) {
    return (
      <TenantControlPanel
        tenant={selectedTenant}
        onClose={() => setSelectedTenant(null)}
        onUpdate={handlePanelUpdate}
      />
    )
  }

  return (
    <div className="space-y-6" onClick={() => setActiveDropdown(null)}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenant Dashboard</h1>
          <p className="text-gray-500">Global oversight of all platform organizations</p>
        </div>
        {(user?.role === 'platform_admin' || user?.org_role === 'platform_admin') && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn-primary flex items-center justify-center gap-2"
          >
            <HiOutlinePlus className="w-5 h-5" />
            Provision New Tenant
          </button>
        )}
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold text-xl">
              <HiOutlineOfficeBuilding className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Tenants</p>
              <h3 className="text-2xl font-bold text-gray-900">{stats?.total || 0}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-50 text-green-600 rounded-xl flex items-center justify-center font-bold text-xl">
              <HiOutlineCheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Active Orgs</p>
              <h3 className="text-2xl font-bold text-gray-900">{stats?.active || 0}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-50 text-perksu-purple rounded-xl flex items-center justify-center font-bold text-xl">
              <HiOutlinePlus className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Enterprise Tier</p>
              <h3 className="text-2xl font-bold text-gray-900">{stats?.enterpriseTier || 0}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center font-bold text-xl">
              <span className="text-xl">₹</span>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-medium">Total Balance</p>
              <h3 className="text-2xl font-bold text-gray-900">
                {formatCurrency(stats?.totalBalance) || '₹0'}
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search tenants by name or slug..."
            className="input pl-10 h-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Tenants Table */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organization</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slug</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Budget Balance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {isLoading ? (
                <tr><td colSpan="6" className="px-6 py-10 text-center text-gray-500ital">Loading tenants...</td></tr>
              ) : filteredTenants?.length === 0 ? (
                <tr><td colSpan="6" className="px-6 py-10 text-center text-gray-500">No tenants found</td></tr>
              ) : filteredTenants?.map((tenant) => (
                <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-perksu-purple/10 flex items-center justify-center text-perksu-purple font-bold">
                        {tenant.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-gray-900">
                          <button className="text-left p-0 m-0 font-bold text-inherit" onClick={() => handleTenantOpen(tenant)}>{tenant.name}</button>
                        </div>
                        <div className="text-xs text-gray-500">ID: {tenant.id.substring(0, 8)}...</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    <span className="bg-gray-100 px-2 py-1 rounded font-mono text-xs">{tenant.slug}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    <span className={`capitalize px-2 py-1 rounded-full text-xs font-medium ${
                      tenant.subscription_tier === 'enterprise' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {tenant.subscription_tier}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                    {formatCurrency(tenant.master_budget_balance)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {tenant.status === 'ACTIVE' ? (
                      <span className="flex items-center gap-1 text-green-600 font-medium text-xs">
                        <HiOutlineCheckCircle className="w-4 h-4" /> Active
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-red-600 font-medium text-xs">
                        <HiOutlineXCircle className="w-4 h-4" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm relative">
                    <button 
                      className="text-gray-400 hover:text-indigo-600 p-2 rounded-full hover:bg-gray-100 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveDropdown(activeDropdown === tenant.id ? null : tenant.id)
                      }}
                    >
                      <HiOutlineDotsVertical className="w-5 h-5" />
                    </button>

                    {activeDropdown === tenant.id && (
                      <div className="absolute right-6 top-12 w-48 bg-white rounded-lg shadow-xl border border-gray-100 py-1 z-50">
                        <button className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                          <HiOutlinePencil className="w-4 h-4 text-gray-400" />
                          Edit Settings
                        </button>
                        <button                             className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            onClick={() => {
                              setSelectedTenant(tenant)
                              setIsBudgetModalOpen(true)
                              setActiveDropdown(null)
                            }}
                          >
                            <HiOutlineCurrencyDollar className="w-4 h-4 text-gray-400" />
                            Load Budget
                          </button>
                          <button                           className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${
                            tenant.status === 'ACTIVE' ? 'text-red-600 hover:bg-red-50' : 'text-green-600 hover:bg-green-50'
                          }`}
                          onClick={() => {
                            if (confirm(`Are you sure you want to ${tenant.status === 'ACTIVE' ? 'suspend' : 'activate'} ${tenant.name}?`)) {
                              toggleStatusMutation.mutate(tenant.id)
                            }
                          }}
                        >
                          <HiOutlineLockClosed className="w-4 h-4" />
                          {tenant.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Provision Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Provision New Organization</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <HiOutlineXCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleProvisionSubmit} className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="label">Organization Name</label>
                  <input
                    name="name"
                    type="text"
                    className="input"
                    placeholder="Acme Corp"
                    required
                    value={provName}
                    onChange={(e) => {
                      setProvName(e.target.value)
                      if (!slugTouched) setProvSlug(slugify(e.target.value))
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <label className="label">Organization Slug</label>
                  <input
                    name="slug"
                    type="text"
                    className="input"
                    placeholder="acme"
                    required
                    value={provSlug}
                    onChange={(e) => { setProvSlug(slugify(e.target.value)); setSlugTouched(true) }}
                    onFocus={() => setSlugTouched(true)}
                  />
                  <p className="text-xs text-gray-500">Canonical slug: <span className="font-mono">{provSlug || slugify(provName)}</span></p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="label">Subscription Tier</label>
                  <select name="subscription_tier" className="input">
                    <option value="basic">Basic</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="label">Initial Budget Balance (₹)</label>
                  <input name="initial_balance" type="number" className="input" defaultValue="1000" required />
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-xl space-y-4">
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <HiOutlineMail className="w-5 h-5 text-perksu-purple" />
                  Primary Administrator Details
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="label text-xs">Admin First Name</label>
                    <input name="admin_first_name" type="text" className="input bg-white" placeholder="John" required />
                  </div>
                  <div className="space-y-2">
                    <label className="label text-xs">Admin Last Name</label>
                    <input name="admin_last_name" type="text" className="input bg-white" placeholder="Doe" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="label text-xs">Admin Work Email</label>
                    <input name="admin_email" type="email" className="input bg-white" placeholder="admin@acme.com" required />
                  </div>
                  <div className="space-y-2">
                    <label className="label text-xs">Initial Admin Password</label>
                    <input name="admin_password" type="password" className="input bg-white" required />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary"
                  disabled={provisionMutation.isPending}
                >
                  {provisionMutation.isPending ? 'Provisioning...' : 'Complete Provisioning'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Load Budget Modal */}
      {isBudgetModalOpen && selectedTenant && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Load Budget</h2>
                <p className="text-sm text-gray-500">{selectedTenant.name}</p>
              </div>
              <button 
                onClick={() => {
                  setIsBudgetModalOpen(false)
                  setSelectedTenant(null)
                }} 
                className="text-gray-400 hover:text-gray-600"
              >
                <HiOutlineXCircle className="w-6 h-6" />
              </button>
            </div>
            <form 
              onSubmit={(e) => {
                e.preventDefault()
                const formData = new FormData(e.target)
                const data = {
                  amount: parseFloat(formData.get('amount')),
                  description: formData.get('description')
                }
                loadBudgetMutation.mutate({ id: selectedTenant.id, data })
              }} 
              className="p-6 space-y-4"
            >
              <div className="space-y-2">
                <label className="label">Amount (INR)</label>
                <input 
                  name="amount" 
                  type="number" 
                  step="1" 
                  className="input h-12 text-lg font-bold" 
                  placeholder="0" 
                  required 
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="label">Description</label>
                <input 
                  name="description" 
                  type="text" 
                  className="input" 
                  placeholder="e.g. Quarterly allocation" 
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsBudgetModalOpen(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn-primary flex-1"
                  disabled={loadBudgetMutation.isLoading}
                >
                  {loadBudgetMutation.isLoading ? 'Processing...' : 'Confirm Load'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
