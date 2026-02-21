import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { departmentsAPI, budgetsAPI } from '../../../lib/api'
import toast from 'react-hot-toast'
import {
  HiOutlineXMark,
  HiOutlineUsers,
  HiOutlineBanknotes,
  HiOutlineCheckCircle,
  HiOutlineInformationCircle,
} from 'react-icons/hi2'
import { formatNumber, formatCurrency } from '../../../lib/currency'

/**
 * PerEmployeeDistributionModal
 *
 * HR-Admin-only workflow:  Enter a per-employee points rate and the system
 * calculates each department's allocation as  active_employees × points_per_user.
 * All departments are pre-selected; individual departments can be deselected.
 */
export default function PerEmployeeDistributionModal({
  isOpen,
  onClose,
  onSuccess,
  availableMasterPool = 0,
}) {
  const queryClient = useQueryClient()

  const [pointsPerUser, setPointsPerUser] = useState('')
  const [selectedDeptIds, setSelectedDeptIds] = useState(null) // null = all

  // Fetch department management list (includes employee_count)
  const { data: departments = [], isLoading: loadingDepts } = useQuery({
    queryKey: ['departments-management'],
    queryFn: () => departmentsAPI.getManagementList(),
    enabled: isOpen,
  })

  // When data is first loaded, initialise selectedDeptIds to all
  const allDeptIds = useMemo(() => departments.map((d) => d.id), [departments])

  const effectiveSelected = selectedDeptIds ?? allDeptIds

  const toggleDept = (id) => {
    const current = effectiveSelected
    if (current.includes(id)) {
      setSelectedDeptIds(current.filter((x) => x !== id))
    } else {
      setSelectedDeptIds([...current, id])
    }
  }

  const selectAll = () => setSelectedDeptIds(null) // null = all
  const clearAll = () => setSelectedDeptIds([])

  // Compute preview
  const pts = parseInt(pointsPerUser, 10) || 0
  const preview = useMemo(() => {
    return departments
      .filter((d) => effectiveSelected.includes(d.id))
      .map((d) => ({
        ...d,
        deptTotal: (d.employee_count || 0) * pts,
      }))
  }, [departments, effectiveSelected, pts])

  const totalPoints = preview.reduce((acc, d) => acc + d.deptTotal, 0)
  const isOverBudget = totalPoints > availableMasterPool
  const canSubmit =
    pts > 0 &&
    effectiveSelected.length > 0 &&
    !isOverBudget &&
    totalPoints > 0

  const mutation = useMutation({
    mutationFn: (payload) => budgetsAPI.distributePerEmployee(payload),
    onSuccess: (res) => {
      toast.success(
        `Distributed ${formatCurrency(res.total_points_allocated)} across ${res.departments_updated} departments`
      )
      queryClient.invalidateQueries(['departments-management'])
      queryClient.invalidateQueries(['master-pool'])
      queryClient.invalidateQueries(['dashboardSummary'])
      onSuccess?.()
    },
    onError: (err) => {
      toast.error(err?.response?.data?.detail || 'Distribution failed')
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    mutation.mutate({
      points_per_user: pts,
      department_ids: selectedDeptIds, // null sends to all
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Per-Employee Department Distribution</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Allocate budget to each department based on headcount
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition"
          >
            <HiOutlineXMark className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Body (scrollable) */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {/* Available pool info */}
          <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
            <HiOutlineBanknotes className="w-5 h-5 text-blue-600 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">Available Master Pool</p>
              <p className="text-lg font-bold text-blue-700">{formatCurrency(availableMasterPool)}</p>
            </div>
          </div>

          {/* Points per user input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Points per Employee <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={pointsPerUser}
              onChange={(e) => setPointsPerUser(e.target.value)}
              placeholder="e.g. 500"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-perksu-purple text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">
              Each department will receive: active employees × {pts > 0 ? formatCurrency(pts) : '?'}
            </p>
          </div>

          {/* Department selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-700">
                Target Departments
              </label>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  onClick={selectAll}
                  className="text-perksu-purple hover:underline"
                >
                  Select All
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={clearAll}
                  className="text-gray-500 hover:underline"
                >
                  Clear All
                </button>
              </div>
            </div>

            {loadingDepts ? (
              <div className="text-sm text-gray-400 py-4 text-center">Loading departments…</div>
            ) : (
              <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {departments.map((dept) => {
                  const isChecked = effectiveSelected.includes(dept.id)
                  const deptTotal = isChecked ? (dept.employee_count || 0) * pts : 0
                  return (
                    <label
                      key={dept.id}
                      className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition ${
                        isChecked ? 'bg-purple-50/40' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleDept(dept.id)}
                        className="accent-perksu-purple w-4 h-4 rounded shrink-0"
                      />
                      <HiOutlineUsers className="w-4 h-4 text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{dept.name}</p>
                        <p className="text-xs text-gray-400">
                          {dept.employee_count || 0} active employee{dept.employee_count !== 1 ? 's' : ''}
                        </p>
                      </div>
                      {pts > 0 && isChecked && (
                        <span className="text-xs font-semibold text-perksu-purple shrink-0">
                          +{formatCurrency(deptTotal)}
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            )}
          </div>

          {/* Summary */}
          {pts > 0 && effectiveSelected.length > 0 && (
            <div className={`p-4 rounded-xl border ${isOverBudget ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-200'}`}>
              <div className="flex items-start gap-2">
                {isOverBudget ? (
                  <HiOutlineInformationCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                ) : (
                  <HiOutlineCheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Departments selected:</span>
                    <span className="font-semibold">{effectiveSelected.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total points needed:</span>
                    <span className={`font-bold ${isOverBudget ? 'text-red-600' : 'text-green-700'}`}>
                      {formatCurrency(totalPoints)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Remaining after distribution:</span>
                    <span className={`font-semibold ${isOverBudget ? 'text-red-600' : 'text-gray-800'}`}>
                      {formatCurrency(availableMasterPool - totalPoints)}
                    </span>
                  </div>
                  {isOverBudget && (
                    <p className="text-red-600 font-medium text-xs mt-1">
                      Insufficient master pool balance. Reduce points per employee or deselect some departments.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-200 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition font-medium text-sm"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || mutation.isPending}
            className="flex-1 px-4 py-2 bg-perksu-purple text-white rounded-xl hover:bg-perksu-purple/90 transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? 'Distributing…' : `Distribute ${totalPoints > 0 ? formatCurrency(totalPoints) : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
