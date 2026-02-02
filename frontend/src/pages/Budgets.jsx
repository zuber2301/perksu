import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { budgetsAPI, tenantsAPI, usersAPI, walletsAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { 
  HiOutlinePlus, HiOutlinePencil, HiOutlineChartBar, HiOutlineCheck, 
  HiOutlineUsers, HiOutlineCash, HiOutlineSparkles, HiOutlineTrendingUp,
  HiOutlineFire, HiOutlineCube, HiOutlineDotsVertical, HiOutlineCalendar
} from 'react-icons/hi'
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar
} from 'recharts'

export default function Budgets() {
  const [activeTab, setActiveTab] = useState('budgets') // budgets, allocations, insights
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showAllocateModal, setShowAllocateModal] = useState(false)
  const [showPointAllocationModal, setShowPointAllocationModal] = useState(false)
  const [selectedBudget, setSelectedBudget] = useState(null)
  const [selectedLead, setSelectedLead] = useState(null)
  const [showEmployeeTopUpModal, setShowEmployeeTopUpModal] = useState(false)
  const [topUpDepartment, setTopUpDepartment] = useState(null)
  const [topUpUser, setTopUpUser] = useState(null)
  const [topUpPoints, setTopUpPoints] = useState(0)
  
  const queryClient = useQueryClient()
  const { isHRAdmin } = useAuthStore()

  const { data: budgets, isLoading } = useQuery({
    queryKey: ['budgets'],
    queryFn: () => budgetsAPI.getAll(),
  })

  const { data: leads } = useQuery({
    queryKey: ['users', { role: 'manager' }],
    queryFn: () => usersAPI.getAll({ role: 'manager' }),
    enabled: activeTab === 'allocations' || activeTab === 'insights',
  })

  const { data: employees } = useQuery({
    queryKey: ['users', { department_id: topUpDepartment, role: 'employee' }],
    queryFn: () => usersAPI.getAll({ department_id: topUpDepartment, role: 'employee', status: 'active' }),
    enabled: showEmployeeTopUpModal && !!topUpDepartment,
  })

  useEffect(() => {
    // Reset selected employee & points when department changes
    setTopUpUser(null)
    setTopUpPoints(0)
  }, [topUpDepartment])

  const { data: leadAllocations } = useQuery({
    queryKey: ['leadAllocations', selectedBudget?.id],
    queryFn: () => budgetsAPI.getAllLeadAllocations({ budget_id: selectedBudget?.id }),
    enabled: !!selectedBudget && (activeTab === 'allocations' || activeTab === 'insights'),
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

  const leadPointAllocationMutation = useMutation({
    mutationFn: (data) => budgetsAPI.allocateToLead(data),
    onSuccess: () => {
      toast.success('Lead points allocated successfully')
      queryClient.invalidateQueries(['budgets'])
      queryClient.invalidateQueries(['leadAllocations'])
      setShowPointAllocationModal(false)
      setSelectedLead(null)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to allocate points')
    },
  })

  const allocateEmployeeMutation = useMutation({
    mutationFn: ({ budgetId, departmentId, data }) => budgetsAPI.allocateToEmployee(budgetId, departmentId, data),
    onSuccess: () => {
      toast.success('Employee topped up successfully')
      queryClient.invalidateQueries(['departmentBudgets'])
      queryClient.invalidateQueries(['budgets'])
      setShowEmployeeTopUpModal(false)
      setTopUpDepartment(null)
      setTopUpUser(null)
      setTopUpPoints(0)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to top-up employee')
    }
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

  // Prevent runtime NaN/Infinity errors in percentage/width calculations
  const safePercent = (numerator, denominator) => {
    const n = parseFloat(numerator) || 0
    const d = parseFloat(denominator) || 0
    if (d === 0) return 0
    const p = (n / d) * 100
    if (!isFinite(p)) return 0
    return Math.max(0, Math.min(100, +p.toFixed(1)))
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
        {activeTab === 'allocations' && (
          <button
            onClick={() => setShowEmployeeTopUpModal(true)}
            className="btn-secondary flex items-center gap-2"
          >
            <HiOutlineCash className="w-4 h-4" />
            Top-up Employee
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
        <button
          onClick={() => setActiveTab('insights')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-all ${
            activeTab === 'insights'
              ? 'border-perksu-purple text-perksu-purple'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Spend Analysis
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
                          width: `${safePercent(budget.allocated_points, budget.total_points)}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between items-center mt-1">
                        <p className="text-xs text-gray-500">
                          {safePercent(budget.allocated_points, budget.total_points)}% allocated
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
      ) : activeTab === 'allocations' ? (
        /* Leads point allocation view */
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Lead Name</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Allocated</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Used</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Remaining</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Usage %</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Expiry</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leads?.data?.map((lead) => {
                  const allocation = leadAllocations?.data?.find(a => a.lead_id === lead.id) || null;
                  const budget = budgets?.data?.find(b => b.id === allocation?.budget_id) || null;
                  const usagePct = allocation ? safePercent(allocation.spent_points, allocation.allocated_points) : 0
                  const allocatedPoints = allocation ? (parseFloat(allocation.allocated_points) || 0) : 0
                  const spentPoints = allocation ? (parseFloat(allocation.spent_points) || 0) : 0
                  const remainingPoints = allocation ? Math.max(0, allocatedPoints - spentPoints) : 0
                  
                  return (
                    <tr key={lead.id} className="hover:bg-gray-50 transition-colors">                      <td className="px-6 py-4">
                        <p className="font-bold text-gray-900">{lead.first_name} {lead.last_name}</p>
                        <p className="text-xs text-gray-500">
                           {lead.department_id ? departments?.data?.find(d => d.id === lead.department_id)?.name : 'No Department'}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-center font-semibold text-gray-900">
                        {allocatedPoints}
                      </td>
                      <td className="px-6 py-4 text-center font-semibold text-orange-600">
                        {spentPoints}
                      </td>
                      <td className="px-6 py-4 text-center font-semibold text-green-600">
                        {remainingPoints}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-perksu-purple" 
                              style={{ width: `${usagePct}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-gray-500">{allocation?.usage_percentage || 0}%</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center text-xs font-bold text-gray-500 uppercase">
                        {budget?.expiry_date ? format(new Date(budget.expiry_date), 'dd MMM yyyy') : '-'}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => {
                            setSelectedLead(lead)
                            setShowPointAllocationModal(true)
                          }}
                          className="btn-secondary text-xs"
                        >
                          {allocation ? 'Top Up' : 'Allocate'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {(!leads?.data || leads.data.length === 0) && (
                <div className="px-6 py-12 text-center text-gray-400 italic">
                    No Tenant Leads (Managers) found in the organization.
                </div>
            )}
          </div>
        </div>
      ) : (
        /* Spend Analysis / Insights View */
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="card p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                  <HiOutlineTrendingUp className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Burn Rate</p>
                  <p className="text-2xl font-bold text-gray-900">12.5k / mo</p>
                </div>
              </div>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center text-orange-600">
                  <HiOutlineFire className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Active Leads</p>
                  <p className="text-2xl font-bold text-gray-900">84%</p>
                </div>
              </div>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600">
                  <HiOutlineCube className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Points Yield</p>
                  <p className="text-2xl font-bold text-gray-900">92%</p>
                </div>
              </div>
            </div>
            <div className="card p-5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center text-green-600">
                  <HiOutlineSparkles className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">ROI Ratio</p>
                  <p className="text-2xl font-bold text-gray-900">4.2 : 1</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <HiOutlineTrendingUp className="text-blue-500" />
                Burn Rate Velocity
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={[
                      { month: 'Jan', points: 4000 },
                      { month: 'Feb', points: 3000 },
                      { month: 'Mar', points: 5000 },
                      { month: 'Apr', points: 8000 },
                      { month: 'May', points: 6000 },
                      { month: 'Jun', points: 9000 },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#9CA3AF' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#9CA3AF' }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                    />
                    <Line type="monotone" dataKey="points" stroke="#8B5CF6" strokeWidth={4} dot={{ r: 6, fill: '#8B5CF6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                <HiOutlineCube className="text-purple-500" />
                Departmental Spend Heatmap
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={[
                      { dept: 'Sales', allocated: 10000, spent: 8500 },
                      { dept: 'Eng', allocated: 15000, spent: 7000 },
                      { dept: 'HR', allocated: 5000, spent: 4500 },
                      { dept: 'Marketing', allocated: 8000, spent: 3000 },
                      { dept: 'Ops', allocated: 12000, spent: 10000 },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E5E7EB" />
                    <XAxis type="number" hide />
                    <YAxis dataKey="dept" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#374151' }} />
                    <Tooltip cursor={{ fill: '#F9FAFB' }} />
                    <Bar dataKey="spent" fill="#8B5CF6" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
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
                leadPointAllocationMutation.mutate({
                  lead_id: selectedLead.id,
                  budget_id: formData.get('budget_id'),
                  points: parseFloat(formData.get('points')),
                });
              }} 
              className="space-y-4"
            >
              <div>
                <label className="label">Source Budget</label>
                <select 
                  name="budget_id" 
                  className="input" 
                  required
                  defaultValue={selectedBudget?.id}
                >
                  <option value="">Select a budget</option>
                  {budgets?.data?.filter(b => b.status === 'active').map(b => (
                    <option key={b.id} value={b.id}>{b.name} (FY{b.fiscal_year}) - {b.remaining_points} left</option>
                  ))}
                </select>
              </div>

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
                  disabled={leadPointAllocationMutation.isPending}
                  className="flex-1 btn-primary py-3 rounded-2xl shadow-lg shadow-perksu-purple/20"
                >
                  {leadPointAllocationMutation.isPending ? 'Processing...' : 'Confirm Allocation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Employee Top-up Modal */}
      {showEmployeeTopUpModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <HiOutlineCash className="w-7 h-7 text-perksu-purple" />
                Top-up Employee Wallet
              </h2>
              <button 
                onClick={() => setShowEmployeeTopUpModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <HiOutlinePlus className="w-6 h-6 rotate-45" />
              </button>
            </div>

            <form onSubmit={(e) => {
                e.preventDefault()
                if (!selectedBudget) {
                  toast.error('Select a budget first')
                  return
                }
                if (!topUpDepartment || !topUpUser || !topUpPoints) {
                  toast.error('Please select department, user and points')
                  return
                }
                allocateEmployeeMutation.mutate({
                  budgetId: selectedBudget.id,
                  departmentId: topUpDepartment,
                  data: { user_id: topUpUser, points: parseFloat(topUpPoints) }
                })
              }} className="space-y-4">

              <div>
                <label className="label">Source Budget</label>
                <select 
                  name="budget_id" 
                  className="input" 
                  required
                  value={selectedBudget?.id || ''}
                  onChange={(e) => {
                    const b = budgets?.data?.find(x => x.id === e.target.value)
                    setSelectedBudget(b)
                  }}
                >
                  <option value="">Select a budget</option>
                  {budgets?.data?.filter(b => b.status === 'active').map(b => (
                    <option key={b.id} value={b.id}>{b.name} - {b.remaining_points} left</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Department</label>
                <select className="input" value={topUpDepartment || ''} onChange={(e) => setTopUpDepartment(e.target.value)} required>
                  <option value="">Select a department</option>
                  {departments?.data?.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Employee</label>
                <select className="input" value={topUpUser || ''} onChange={(e) => setTopUpUser(e.target.value)} required>
                  <option value="">Select an employee</option>
                  {/** fetch all users and filter client-side for selected department **/}
                  {/** Reuse leads query if needed; using usersAPI.getAll may be heavier but acceptable for admin screens. */}
                  {/** Here we use departments + an existing users query (leads) — keep simple and show all users. */}
                  {/** We'll lazy-load users via usersAPI.getAll when modal shows; but budgets page already fetched leads earlier. */}
                  {/** For simplicity show leads + others by calling usersAPI.getAll when needed in next iteration. */}
                  {employees?.data?.map(u => (
                    <option key={u.id} value={u.id}>{u.first_name} {u.last_name} — {u.email}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Points</label>
                <input type="number" className="input" min="1" value={topUpPoints} onChange={(e) => setTopUpPoints(e.target.value)} required />
              </div>

              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowEmployeeTopUpModal(false)} className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-2xl font-bold hover:bg-gray-50 transition-all">Cancel</button>
                <button type="submit" disabled={allocateEmployeeMutation.isPending} className="flex-1 btn-primary py-3 rounded-2xl">{allocateEmployeeMutation.isPending ? 'Processing...' : 'Confirm Top-up'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
