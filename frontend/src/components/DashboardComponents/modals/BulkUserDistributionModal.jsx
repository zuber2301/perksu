import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { budgetsAPI } from '../../../lib/api'
import toast from 'react-hot-toast'
import {
  HiOutlineXMark,
  HiOutlineUsers,
  HiOutlineBanknotes,
  HiOutlineCheckCircle,
  HiOutlineInformationCircle,
  HiOutlineSparkles,
} from 'react-icons/hi2'
import { formatNumber } from '../../../lib/currency'

/**
 * BulkUserDistributionModal
 *
 * HR-Admin-only workflow: Enter a per-user points value and every active user
 * in the tenant receives that amount credited directly to their wallet.
 */
export default function BulkUserDistributionModal({
  isOpen,
  onClose,
  onSuccess,
  availableMasterPool = 0,
  totalActiveUsers = 0,
}) {
  const queryClient = useQueryClient()

  const [pointsPerUser, setPointsPerUser] = useState('')
  const [description, setDescription] = useState('')

  const pts = parseInt(pointsPerUser, 10) || 0
  const totalPoints = pts * totalActiveUsers
  const isOverBudget = totalPoints > availableMasterPool
  const canSubmit = pts > 0 && !isOverBudget && totalActiveUsers > 0

  const mutation = useMutation({
    mutationFn: (payload) => budgetsAPI.distributeToAllUsers(payload),
    onSuccess: (res) => {
      toast.success(
        `Distributed ${formatNumber(res.total_points_distributed)} pts to ${res.total_users_credited} users`
      )
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
      description: description || undefined,
    })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Distribute to All Users</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Credit every active employee's wallet at once
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition"
          >
            <HiOutlineXMark className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl">
              <HiOutlineBanknotes className="w-5 h-5 text-blue-600 shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Master Pool</p>
                <p className="text-base font-bold text-blue-700">{formatNumber(availableMasterPool)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 bg-purple-50 border border-purple-200 rounded-xl">
              <HiOutlineUsers className="w-5 h-5 text-perksu-purple shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Active Users</p>
                <p className="text-base font-bold text-perksu-purple">{totalActiveUsers}</p>
              </div>
            </div>
          </div>

          {/* Points per user */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Points per User <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              value={pointsPerUser}
              onChange={(e) => setPointsPerUser(e.target.value)}
              placeholder="e.g. 200"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-perksu-purple text-sm"
            />
          </div>

          {/* Optional description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Q1 2026 Reward Distribution"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-perksu-purple text-sm"
            />
          </div>

          {/* Summary / warning */}
          {pts > 0 && (
            <div
              className={`p-4 rounded-xl border ${
                isOverBudget ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-200'
              }`}
            >
              <div className="flex items-start gap-2">
                {isOverBudget ? (
                  <HiOutlineInformationCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                ) : (
                  <HiOutlineCheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Points per user:</span>
                    <span className="font-semibold">{formatNumber(pts)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Active users:</span>
                    <span className="font-semibold">{totalActiveUsers}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-200 pt-1 mt-1">
                    <span className="text-gray-700 font-medium">Total to distribute:</span>
                    <span className={`font-bold ${isOverBudget ? 'text-red-600' : 'text-green-700'}`}>
                      {formatNumber(totalPoints)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Remaining after:</span>
                    <span className={`font-semibold ${isOverBudget ? 'text-red-600' : 'text-gray-800'}`}>
                      {formatNumber(availableMasterPool - totalPoints)}
                    </span>
                  </div>
                  {isOverBudget && (
                    <p className="text-red-600 font-medium text-xs mt-1">
                      Insufficient master pool balance. Reduce points per user or top up the master pool first.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {totalActiveUsers === 0 && (
            <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              No active users found in this tenant.
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition font-medium text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSubmit || mutation.isPending}
              className="flex-1 px-4 py-2 bg-perksu-purple text-white rounded-xl hover:bg-perksu-purple/90 transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <HiOutlineSparkles className="w-4 h-4" />
              {mutation.isPending
                ? 'Distributing…'
                : `Distribute${totalPoints > 0 ? ` ${formatNumber(totalPoints)} pts` : ''}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
