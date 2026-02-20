import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { departmentsAPI, usersAPI } from '../../lib/api'
import toast from 'react-hot-toast'
import { HiOutlineUser, HiOutlineCurrencyRupee, HiOutlineUsers } from 'react-icons/hi'
import { HiOutlinePlus, HiOutlineEye } from 'react-icons/hi2'
import AddPointsModal from './modals/AddPointsModal'
import { formatCurrency } from '../../lib/currency'

export default function DepartmentManagementTable({ onRefresh }) {
  const queryClient = useQueryClient()
  const { data: departments = [] , refetch } = useQuery({
    queryKey: ['departments-management'],
    queryFn: () => departmentsAPI.getManagementList().then(r => r.data),
  })

  const { data: masterPool, isLoading: isLoadingPool } = useQuery({
    queryKey: ['master-pool'],
    queryFn: () => departmentsAPI.getMasterPool().then(r => r.data),
  })

  const [activeDept, setActiveDept] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignUsers, setAssignUsers] = useState([])

  const addPointsMutation = useMutation({
    mutationFn: ({ departmentId, amount }) => departmentsAPI.addPoints(departmentId, { amount, description: 'Added by tenant manager' }),
    onSuccess: () => {
      toast.success('Points added to department')
      queryClient.invalidateQueries(['departments-management'])
      queryClient.invalidateQueries(['master-pool'])
      setShowAddModal(false)
      onRefresh?.()
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to add points')
  })

  const assignLeadMutation = useMutation({
    mutationFn: ({ departmentId, userId }) => departmentsAPI.assignLead(departmentId, { user_id: userId }),
    onSuccess: () => {
      toast.success('Lead assigned')
      queryClient.invalidateQueries(['departments-management'])
      setShowAssignModal(false)
      onRefresh?.()
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to assign lead')
  })

  const handleOpenAdd = (dept) => {
    setActiveDept(dept)
    setShowAddModal(true)
  }

  const handleOpenAssign = async (dept) => {
    setActiveDept(dept)
    // fetch users in dept
    const resp = await usersAPI.getAll(null, dept.id)
    setAssignUsers(resp.data || [])
    setShowAssignModal(true)
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Department Management</h3>
        <p className="text-sm text-gray-500">Financial transparency & allocation actions</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b">
              <th className="py-2">Department Name</th>
              <th className="py-2">Dept Lead</th>
              <th className="py-2">Unallocated Budget</th>
              <th className="py-2">User Wallet Sum</th>
              <th className="py-2">Total Dept Liability</th>
              <th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((d) => (
              <tr key={d.id} className="border-b last:border-b-0">
                <td className="py-3">{d.name}</td>
                <td className="py-3">{d.lead_name || 'Unassigned'}</td>
                <td className={`py-3 font-medium ${d.dept_budget_balance === 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  <div className="flex items-center gap-2">
                    <span>{formatCurrency(d.dept_budget_balance)}</span>
                    {d.dept_budget_balance === 0 && (
                      <svg className="w-4 h-4 text-red-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.72-1.36 3.485 0l6.516 11.59A1.75 1.75 0 0 1 17.6 17h-14a1.75 1.75 0 0 1-1.657-2.311L8.257 3.1zM9 7a1 1 0 10-2 0 1 1 0 002 0zm1 6a1 1 0 10-2 0 1 1 0 002 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                </td>
                <td className="py-3">{formatCurrency(d.user_wallet_sum)}</td>
                <td className="py-3 font-semibold">{formatCurrency(d.total_liability)}</td>
                <td className="py-3">
                  <div className="flex gap-2">
                    <button onClick={() => handleOpenAdd(d)} className="px-3 py-1 bg-blue-50 text-blue-700 rounded text-sm flex items-center gap-2"><HiOutlinePlus className="w-4 h-4"/> Add Points</button>
                    {d.lead_name ? (
                      <button onClick={() => { /* view users */ }} className="px-3 py-1 bg-gray-50 text-gray-700 rounded text-sm flex items-center gap-2"><HiOutlineEye className="w-4 h-4"/> View Users</button>
                    ) : (
                      <button onClick={() => handleOpenAssign(d)} className="px-3 py-1 bg-yellow-50 text-yellow-700 rounded text-sm">Assign Lead</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showAddModal && activeDept && (
        <AddPointsModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          department={activeDept}
          availablePoints={masterPool?.balance || 0}
          isLoading={isLoadingPool}
          onSubmit={(amount) => addPointsMutation.mutate({ departmentId: activeDept.id, amount })}
        />
      )}

      {showAssignModal && activeDept && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold">Assign Lead to {activeDept.name}</h3>
            <div className="mt-4">
              <select className="w-full px-3 py-2 border rounded" onChange={(e) => assignLeadMutation.mutate({ departmentId: activeDept.id, userId: e.target.value })}>
                <option value="">-- Select User --</option>
                {assignUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.first_name} {u.last_name} ({u.email})</option>
                ))}
              </select>
            </div>
            <div className="mt-4 flex gap-2 justify-end">
              <button onClick={() => setShowAssignModal(false)} className="px-4 py-2 bg-gray-100 rounded">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
