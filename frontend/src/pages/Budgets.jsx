import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { budgetsAPI, tenantsAPI, usersAPI, walletsAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { HiOutlinePlus, HiOutlinePencil, HiOutlineChartBar, HiOutlineCheck, HiOutlineUsers, HiOutlineCash, HiOutlineSparkles } from 'react-icons/hi'

export default function Budgets() {
  const [activeTab, setActiveTab] = useState('budgets') // budgets, allocations
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAllocateModal, setShowAllocateModal] = useState(false)
  const [showPointAllocationModal, setShowPointAllocationModal] = useState(false)
  const [selectedBudget, setSelectedBudget] = useState(null)
  const [selectedLead, setSelectedLead] = useState(null)
  
  const queryClient = useQueryClient()
  const { isHRAdmin } = useAuthStore()

  const { data: budgets, isLoading } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => budgetsAPI.getAll(),
  })

  const { data: leads } = useQuery({
    queryKey: ['users', { role: 'manager' }],
    queryFn: () => usersAPI.getAll({ role: 'manager' }),
    enabled: activeTab === 'allocations',
  })

  const { data: departments } = useQuery({
    queryKey: ['departments'],
    queryFn: () => tenantsAPI.getDepartments(),
  })

  const { data: departmentBudgets } = useQuery({
    queryKey: ['departmentBudgets', selectedBudget?.id],
    queryFn: () => budgetsAPI.getDepartmentBudgets(selectedBudget.id),
    enabled: !!selectedBudget,
  })

  const createMutation = useMutation({
    mutationFn: (data) => budgetsAPI.create(data),
    onSuccess: () => {
      toast.success('Budget created successfully')
      queryClient.invalidateQueries(['budgets'])
      setShowCreateModal(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to create budget')
    },
  })

  const allocateMutation = useMutation({
    mutationFn: ({ id, data }) => budgetsAPI.allocate(id, data),
    onSuccess: () => {
      toast.success('Budget allocated successfully')
      queryClient.invalidateQueries(['budgets'])
      queryClient.invalidateQueries(['departmentBudgets'])
      setShowAllocateModal(false)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to allocate budget')
    },
  })

  const activateMutation = useMutation({
    mutationFn: (id) => budgetsAPI.activate(id),
    onSuccess: () => {
      toast.success('Budget activated successfully')
      queryClient.invalidateQueries(['budgets'])
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to activate budget')
    },
  })

  const pointAllocationMutation = useMutation({
    mutationFn: (data) => walletsAPI.allocatePoints(data),
    onSuccess: () => {
      toast.success('Points allocated successfully')
      queryClient.invalidateQueries(['users'])
      setShowPointAllocationModal(false)
      setSelectedLead(null)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to allocate points')
    },
  })

  const handleCreateBudget = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    createMutation.mutate({
      name: formData.get('name'),
      fiscal_year: parseInt(formData.get('fiscal_year')),
      fiscal_quarter: formData.get('fiscal_quarter') ? parseInt(formData.get('fiscal_quarter')) : null,
      total_points: parseFloat(formData.get('total_points')),
    })
  }

  const handleAllocate = (e) => {
    e.preventDefault()
    const formData = new FormData(e.target)
    const allocations = []
    
    departments?.data?.forEach((dept) => {
      const points = formData.get(`points_${dept.id}`)
      if (points && parseFloat(points) > 0) {
        allocations.push({
          department_id: dept.id,
          allocated_points: parseFloat(points),
          monthly_cap: formData.get(`cap_${dept.id}`) ? parseFloat(formData.get(`cap_${dept.id}`)) : null,
        })
      }
    })

    if (allocations.length === 0) {
      toast.error('Please allocate points to at least one department')
      return
    }

    allocateMutation.mutate({
      id: selectedBudget.id,
      data: { allocations },
    })
  }

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-800',
      active: 'bg-green-100 text-green-800',
      closed: 'bg-red-100 text-red-800',
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  if (!isHRAdmin()) {
    return (
      <div className="card text-center py-12">
        <HiOutlineChartBar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Restricted</h2>
        <p className="text-gray-500">Only HR Admins can manage budgets.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budget Management</h1>
          <p className="text-sm text-gray-500">Manage organizational budgets and lead point allocations</p>
        </div>
        {activeTab === 'budgets' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary flex items-center gap-2"
          >
            <HiOutlinePlus className="w-5 h-5" />
            Create Budget
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setActiveTab('budgets')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'budgets'
              ? 'border-perksu-purple text-perksu-purple'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Organizational Budgets
        </button>
        <button
          onClick={() => setActiveTab('allocations')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'allocations'
              ? 'border-perksu-purple text-perksu-purple'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Lead Point Allocations
        </button>
      </div>

      {activeTab === 'budgets' ? (
        <>
          {/* Budgets list */}
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : budgets?.data?.length > 0 ? (
            <div className="space-y-4">
              {budgets.data.map((budget) => (
                <div key={budget.id} className="card">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="text-lg font-semibold text-gray-900">{budget.name}</h3>
                        <span className={`badge ${getStatusColor(budget.status)}`}>
                          {budget.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        FY {budget.fiscal_year} {budget.fiscal_quarter && `Q${budget.fiscal_quarter}`}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {budget.status === 'draft' && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedBudget(budget)
                              setShowAllocateModal(true)
                            }}
                            className="btn-secondary text-sm"
                          >
                            <HiOutlinePencil className="w-4 h-4 mr-1" />
                            Allocate
                          </button>
                          <button
                            onClick={() => activateMutation.mutate(budget.id)}
                            className="btn-primary text-sm"
                            disabled={activateMutation.isPending}
                          >
                            <HiOutlineCheck className="w-4 h-4 mr-1" />
                            Activate
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm text-gray-500">Total Budget</p>
                      <p className="text-xl font-semibold text-gray-900">{budget.total_points}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <p className="text-sm text-gray-500">Allocated</p>
                      <p className="text-xl font-semibold text-blue-600">{budget.allocated_points}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <p className="text-sm text-gray-500">Remaining</p>
                      <p className="text-xl font-semibold text-green-600">{budget.remaining_points}</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-4">
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-perksu-purple to-perksu-blue"
                        style={{
                          width: `${(budget.allocated_points / budget.total_points) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between items-center mt-1">
                        <p className="text-xs text-gray-500">
                          {((budget.allocated_points / budget.total_points) * 100).toFixed(1)}% allocated
                        </p>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Departmental distribution</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card text-center py-12">
              <HiOutlineChartBar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No budgets yet</h3>
              <p className="text-gray-500 mb-4">Create your first budget to start allocating points.</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary"
              >
                Create Budget
              </button>
            </div>
          )}
        </>
      ) : (
        /* Leads point allocation view */
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Lead Name</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Department</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leads?.data?.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-bold text-gray-900">
                      {lead.first_name} {lead.last_name}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {lead.department_id ? departments?.data?.find(d => d.id === lead.department_id)?.name || 'N/A' : '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {lead.email}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedLead(lead)
                          setShowPointAllocationModal(true)
                        }}
                        className="btn-primary text-xs py-1.5 px-4 flex items-center gap-1.5 ml-auto shadow-sm"
                      >
                        <HiOutlineSparkles className="w-4 h-4" />
                        Allocate Points
                      </button>
                    </td>
                  </tr>
                ))}
                {(!leads?.data || leads.data.length === 0) && (
                    <tr>
                        <td colSpan="4" className="px-6 py-12 text-center text-gray-400 italic">
                            No Tenant Leads (Managers) found in the organization.
                        </td>
                    </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Budget Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h2 className="text-xl font-semibold mb-4">Create New Budget</h2>
            <form onSubmit={handleCreateBudget} className="space-y-4">
              <div>
                <label className="label">Budget Name</label>
                <input name="name" className="input" required placeholder="e.g., FY 2026 Q1 Budget" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Fiscal Year</label>
                  <input
                    name="fiscal_year"
                    type="number"
                    className="input"
                    required
                    defaultValue={new Date().getFullYear()}
                  />
                </div>
                <div>
                  <label className="label">Quarter (optional)</label>
                  <select name="fiscal_quarter" className="input">
                    <option value="">Annual</option>
                    <option value="1">Q1</option>
                    <option value="2">Q2</option>
                    <option value="3">Q3</option>
                    <option value="4">Q4</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Total Points</label>
                <input
                  name="total_points"
                  type="number"
                  className="input"
                  required
                  placeholder="100000"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Allocate Budget Modal */}
      {showAllocateModal && selectedBudget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h2 className="text-xl font-semibold mb-2">Allocate Budget</h2>
            <p className="text-gray-500 mb-4">
              {selectedBudget.name} - Available: {selectedBudget.remaining_points} points
            </p>
            <form onSubmit={handleAllocate} className="space-y-4">
              {departments?.data?.map((dept) => {
                const existing = departmentBudgets?.data?.find(
                  (db) => db.department_id === dept.id
                )
                return (
                  <div key={dept.id} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{dept.name}</p>
                      {existing && (
                        <p className="text-sm text-gray-500">
                          Current: {existing.allocated_points} pts
                        </p>
                      )}
                    </div>
                    <div className="w-32">
                      <input
                        name={`points_${dept.id}`}
                        type="number"
                        className="input text-sm"
                        placeholder="Points"
                        min="0"
                      />
                    </div>
                    <div className="w-32">
                      <input
                        name={`cap_${dept.id}`}
                        type="number"
                        className="input text-sm"
                        placeholder="Monthly cap"
                        min="0"
                      />
                    </div>
                  </div>
                )
              })}
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAllocateModal(false)
                    setSelectedBudget(null)
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={allocateMutation.isPending}
                  className="btn-primary flex-1"
                >
                  {allocateMutation.isPending ? 'Allocating...' : 'Allocate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Allocate Points to Lead Modal */}
      {showPointAllocationModal && selectedLead && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <HiOutlineSparkles className="w-7 h-7 text-perksu-purple" />
                Allocate Points
              </h2>
              <button 
                onClick={() => { setShowPointAllocationModal(false); setSelectedLead(null); }}
                className="text-gray-400 hover:text-gray-600"
              >
                <HiOutlinePlus className="w-6 h-6 rotate-45" />
              </button>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-perksu-purple/10 rounded-xl flex items-center justify-center text-perksu-purple font-bold">
                        {selectedLead.first_name[0]}{selectedLead.last_name[0]}
                    </div>
                    <div>
                        <p className="font-bold text-gray-900">{selectedLead.first_name} {selectedLead.last_name}</p>
                        <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">{selectedLead.role.replace('_', ' ')}</p>
                    </div>
                </div>
            </div>

            <form 
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                pointAllocationMutation.mutate({
                  user_id: selectedLead.id,
                  points: parseFloat(formData.get('points')),
                  description: formData.get('description'),
                });
              }} 
              className="space-y-4"
            >
              <div>
                <label className="label">Amount to Allocate</label>
                <div className="relative">
                    <input 
                      name="points" 
                      type="number" 
                      className="input pl-10" 
                      placeholder="Enter points amount" 
                      required 
                      min="1"
                    />
                    <HiOutlineCash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
              </div>
              
              <div>
                <label className="label">Allocation Note (Optional)</label>
                <textarea 
                  name="description" 
                  className="input min-h-[100px] py-3" 
                  placeholder="e.g., Monthly budget for Q1 Rewards"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => { setShowPointAllocationModal(false); setSelectedLead(null); }}
                  className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-2xl font-bold hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={pointAllocationMutation.isPending}
                  className="flex-1 btn-primary py-3 rounded-2xl shadow-lg shadow-perksu-purple/20"
                >
                  {pointAllocationMutation.isPending ? 'Processing...' : 'Confirm Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
