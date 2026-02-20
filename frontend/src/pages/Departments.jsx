import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tenantsAPI, usersAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { formatCurrency } from '../lib/currency'
import toast from 'react-hot-toast'
import { 
  HiOutlineOfficeBuilding, 
  HiOutlinePlus, 
  HiOutlineCurrencyDollar,
  HiOutlineUsers,
  HiOutlineUserAdd,
  HiOutlinePencil
} from 'react-icons/hi'
import { HiOutlineEllipsisVertical } from 'react-icons/hi2'

export default function Departments() {
  const [showAddPointsModal, setShowAddPointsModal] = useState(false)
  const [showAssignLeadModal, setShowAssignLeadModal] = useState(false)
  const [showCreateDeptModal, setShowCreateDeptModal] = useState(false)
  const [selectedDept, setSelectedDept] = useState(null)
  const [allocationAmount, setAllocationAmount] = useState('')
  const [newDeptName, setNewDeptName] = useState('')
  const [newDeptAllocation, setNewDeptAllocation] = useState('')
  const [selectedLeadUserId, setSelectedLeadUserId] = useState('')
  const [newlyCreatedDeptId, setNewlyCreatedDeptId] = useState(null)
  const [openActionsMenu, setOpenActionsMenu] = useState(null)
  const queryClient = useQueryClient()
  const { user, isHRAdmin } = useAuthStore()

  const { data: tenant } = useQuery({
    queryKey: ['tenant', 'current'],
    queryFn: () => tenantsAPI.getCurrent(),
  })

  const { data: deptManagement, isLoading } = useQuery({
    queryKey: ['departments', 'management'],
    queryFn: () => tenantsAPI.getDepartmentManagement(),
  })

  const { data: users } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersAPI.getAll(),
  })

  const allocateMutation = useMutation({
    mutationFn: ({ deptId, amount }) => tenantsAPI.allocateDepartmentBudget(deptId, parseFloat(amount)),
    onSuccess: (response) => {
      toast.success(response.message)
      queryClient.invalidateQueries(['departments', 'management'])
      queryClient.invalidateQueries(['tenant', 'current'])
      setShowAddPointsModal(false)
      setSelectedDept(null)
      setAllocationAmount('')
    },
    onError: (error) => {
      const detail = error.response?.data?.detail || error.message || 'Failed to allocate budget'
      toast.error(detail)
    },
  })

  const assignLeadMutation = useMutation({
    mutationFn: ({ deptId, userId }) => tenantsAPI.assignDepartmentLead(deptId, userId),
    onSuccess: (response) => {
      toast.success(response.message)
      queryClient.invalidateQueries(['departments', 'management'])
      setShowAssignLeadModal(false)
      setSelectedDept(null)
    },
    onError: (error) => {
      const detail = error.response?.data?.detail || error.message || 'Failed to assign lead'
      toast.error(detail)
    },
  })


  
  // Note: Department name availability checking could be added in the future
  // via a backend endpoint for validation

  const createDeptMutation = useMutation({
    mutationFn: async (data) => {
      // First, create the department
      const deptResponse = await tenantsAPI.createDepartment({ name: data.name })
      const newDeptId = deptResponse.data.id || deptResponse.id
      
      // Then, if there's an initial allocation, add points
      if (data.initial_allocation && data.initial_allocation > 0) {
        await tenantsAPI.allocateDepartmentBudget(newDeptId, data.initial_allocation)
      }
      
      // Finally, if there's a lead to assign, assign it
      if (data.lead_user_id) {
        await tenantsAPI.assignDepartmentLead(newDeptId, data.lead_user_id)
      }
      
      return { ...deptResponse.data, dept_id: newDeptId, department_id: newDeptId }
    },
    onSuccess: (response) => {
      toast.success(`Department created successfully!`)
      queryClient.invalidateQueries(['departments', 'management'])
      queryClient.invalidateQueries(['tenant', 'current'])
      setNewlyCreatedDeptId(response.dept_id || response.id)
      setShowCreateDeptModal(false)
      resetCreateForm()
      
      // Remove highlight after 3 seconds
      setTimeout(() => setNewlyCreatedDeptId(null), 3000)
    },
    onError: (error) => {
      let detail = error.response?.data?.detail || error.message || 'Failed to create department'
      
      // Handle Pydantic validation errors
      if (Array.isArray(detail)) {
        detail = detail.map(err => err.msg || err.message).join(', ')
      } else if (typeof detail === 'object' && detail !== null) {
        detail = detail.message || detail.msg || JSON.stringify(detail)
      }
      
      toast.error(detail)
    },
  })

  const resetCreateForm = () => {
    setNewDeptName('')
    setNewDeptAllocation('')
    setSelectedLeadUserId('')
  }

  const handleAddPoints = (dept) => {
    setSelectedDept(dept)
    setShowAddPointsModal(true)
    setOpenActionsMenu(null)
  }

  const handleAssignLead = (dept) => {
    setSelectedDept(dept)
    setShowAssignLeadModal(true)
    setOpenActionsMenu(null)
  }

  const handleEditDept = (dept) => {
    setSelectedDept(dept)
    setNewDeptName(dept.name)
    setShowCreateDeptModal(true)
    setOpenActionsMenu(null)
  }

  const submitAllocation = () => {
    if (!allocationAmount || parseFloat(allocationAmount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    allocateMutation.mutate({ deptId: selectedDept.id, amount: allocationAmount })
  }

  const submitAssignLead = (userId) => {
    assignLeadMutation.mutate({ deptId: selectedDept.id, userId })
  }

  const handleCreateDepartment = () => {
    if (!newDeptName.trim()) {
      toast.error('Please enter a department name')
      return
    }

    const allocation = newDeptAllocation ? parseFloat(newDeptAllocation) || 0 : 0
    if (allocation < 0) {
      toast.error('Allocation amount cannot be negative')
      return
    }

    if (allocation > (tenant?.master_budget_balance || 0)) {
      toast.error('Allocation exceeds available Total Budget (Tenant) balance')
      return
    }

    createDeptMutation.mutate({
      name: newDeptName.trim(),
      initial_allocation: allocation,
      lead_user_id: selectedLeadUserId || undefined
    })
  }

  const formatBudgetValue = (value) => {
    return formatCurrency(value)
  }

  if (!isHRAdmin()) {
    return (
      <div className="card text-center py-12">
        <HiOutlineOfficeBuilding className="w-16 h-16 mx-auto mb-4 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Restricted</h2>
        <p className="text-gray-500">Only HR Admins can manage departments.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-perksu-purple"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Department Management</h1>
          <p className="text-gray-600">Monitor department budgets and point allocation flow</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-500">Total Budget (Tenant)</p>
            <p className="text-2xl font-bold text-perksu-purple">
              {formatBudgetValue(tenant?.master_budget_balance || 0)}
            </p>
          </div>
          <button
            onClick={() => setShowCreateDeptModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-perksu-purple text-white rounded-lg hover:bg-perksu-purple/90 transition-colors"
          >
            <HiOutlinePlus className="w-4 h-4" />
            New Department
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700 uppercase">Department Name</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700 uppercase">Dept Lead</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700 uppercase">Unallocated Budget</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700 uppercase">User Wallet Sum</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700 uppercase">Total Dept Liability</th>
                <th className="px-6 py-4 text-left text-sm font-medium text-gray-700 uppercase text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {deptManagement?.data?.map((dept) => (
                <tr 
                  key={dept.id} 
                  className={`hover:bg-gray-50 transition-colors ${
                    newlyCreatedDeptId === dept.id ? 'bg-green-50 border-l-4 border-green-500' : ''
                  }`}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-perksu-purple/10 rounded-lg">
                        <HiOutlineOfficeBuilding className="w-5 h-5 text-perksu-purple" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{dept.name}</div>
                        <div className="text-sm text-gray-500">{dept.employee_count} employees</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {dept.dept_lead_name || <span className="text-gray-400 italic">Unassigned</span>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {formatBudgetValue(dept.unallocated_budget)}
                      </span>
                      {dept.unallocated_budget === 0 && (
                        <HiOutlineExclamation className="w-4 h-4 text-red-500" title="Zero balance - needs refill" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {formatBudgetValue(dept.user_wallet_sum)}
                  </td>
                  <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                    {formatBudgetValue(dept.total_liability)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={() => setOpenActionsMenu(openActionsMenu === dept.id ? null : dept.id)}
                        className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Actions"
                      >
                        <HiOutlineEllipsisVertical className="w-5 h-5" />
                      </button>
                      {openActionsMenu === dept.id && (
                        <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-40">
                          <button
                            onClick={() => handleAddPoints(dept)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 first:rounded-t-lg"
                          >
                            <HiOutlineCurrencyDollar className="w-4 h-4" />
                            Add points
                          </button>
                          <button
                            onClick={() => handleAssignLead(dept)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <HiOutlineUserAdd className="w-4 h-4" />
                            Assign Lead
                          </button>
                          <button
                            onClick={() => handleEditDept(dept)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 last:rounded-b-lg"
                          >
                            <HiOutlinePencil className="w-4 h-4" />
                            Edit Dept.
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Points Modal */}
      {showAddPointsModal && selectedDept && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Add Points to {selectedDept.name}
            </h3>
            
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">Total Budget (Tenant) Balance</p>
              <p className="text-xl font-bold text-perksu-purple">
                {formatBudgetValue(tenant?.master_budget_balance || 0)}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount to Allocate
              </label>
              <input
                type="number"
                value={allocationAmount}
                onChange={(e) => setAllocationAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-perksu-purple focus:border-transparent"
                placeholder="Enter amount"
                min="0"
                step="0.01"
              />
            </div>

            {allocationAmount && parseFloat(allocationAmount) > 0 && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">Preview:</p>
                <p className="text-sm">
                  New Total Budget (Tenant): <span className="font-medium">{formatBudgetValue((tenant?.master_budget_balance || 0) - parseFloat(allocationAmount))}</span>
                </p>
                <p className="text-sm">
                  New Dept Budget: <span className="font-medium">{formatBudgetValue(selectedDept.unallocated_budget + parseFloat(allocationAmount))}</span>
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowAddPointsModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitAllocation}
                disabled={allocateMutation.isPending}
                className="flex-1 px-4 py-2 bg-perksu-purple text-white rounded-lg hover:bg-perksu-purple/90 transition-colors disabled:opacity-50"
              >
                {allocateMutation.isPending ? 'Allocating...' : 'Allocate Points'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Lead Modal */}
      {showAssignLeadModal && selectedDept && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Assign Department Lead for {selectedDept.name}
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select User
              </label>
              <select
                onChange={(e) => submitAssignLead(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-perksu-purple focus:border-transparent"
                defaultValue=""
              >
                <option value="" disabled>Select a user...</option>
                {users?.data?.filter(u => u.dept_id === selectedDept.id)?.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.first_name} {user.last_name} ({user.corporate_email})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowAssignLeadModal(false)}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Department Modal */}
      {showCreateDeptModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <h3 className="text-xl font-semibold text-gray-900 mb-6">
              Create New Department
            </h3>

            <div className="space-y-4">
              {/* Department Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Department Name *
                </label>
                <input
                  type="text"
                  value={newDeptName}
                  onChange={(e) => setNewDeptName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-perksu-purple focus:border-transparent"
                  placeholder="e.g., Customer Success"
                />
              </div>

              {/* Initial Allocation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Initial Allocation (Optional)
                </label>
                <input
                  type="number"
                  value={newDeptAllocation}
                  onChange={(e) => setNewDeptAllocation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-perksu-purple focus:border-transparent"
                  placeholder="Points to allocate from tenant budget"
                  min="0"
                  step="0.01"
                />
                <p className="text-sm text-gray-500 mt-1">
                  Available: {formatBudgetValue(tenant?.master_budget_balance || 0)}
                </p>
                {newDeptAllocation && parseFloat(newDeptAllocation) > (tenant?.master_budget_balance || 0) && (
                  <p className="text-sm text-red-600 mt-1">Amount exceeds available tenant budget balance</p>
                )}
              </div>

              {/* Assign Department Lead */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Assign Department Lead (Optional)
                </label>
                <select
                  value={selectedLeadUserId}
                  onChange={(e) => setSelectedLeadUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-perksu-purple focus:border-transparent"
                >
                  <option value="">Select a user to promote to department lead...</option>
                  {users?.data?.filter(u => u.org_role !== 'dept_lead')?.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.first_name} {user.last_name} ({user.corporate_email})
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500 mt-1">
                  Selected user will be promoted to department lead role
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowCreateDeptModal(false)
                  resetCreateForm()
                }}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDepartment}
                disabled={createDeptMutation.isPending}
                className="flex-1 px-4 py-2 bg-perksu-purple text-white rounded-lg hover:bg-perksu-purple/90 transition-colors disabled:opacity-50"
              >
                {createDeptMutation.isPending ? 'Creating...' : 'Create Department'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}