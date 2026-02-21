import { useState } from 'react'
import { HiOutlineXMark } from 'react-icons/hi2'
import { formatNumber, formatCurrency } from '../../lib/currency'
import { dashboardApi } from '../../lib/api'

/**
 * DistributePointsModal Component
 * Modal for distributing points to leads or users
 */
export default function DistributePointsModal({
  isOpen,
  onClose,
  onSuccess,
  availablePoints = 0,
  leads = [],
  currency = 'INR'
}) {
  const [formData, setFormData] = useState({
    recipientType: 'lead', // 'lead' or 'user'
    recipientId: '',
    amount: '',
    reference: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (!formData.recipientId || !formData.amount) {
        throw new Error('Please fill in all required fields')
      }

      if (parseFloat(formData.amount) > availablePoints) {
        throw new Error(`Amount cannot exceed available points (${availablePoints})`)
      }

      await dashboardApi.delegatePoints({
        lead_id: formData.recipientId,
        amount: parseFloat(formData.amount),
        reference_note: formData.reference,
      })

      onSuccess()
    } catch (err) {
      setError(err?.response?.data?.detail || err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Distribute Points</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition"
          >
            <HiOutlineXMark className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Available Points Info */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">Available to Distribute</p>
            <p className="text-2xl font-bold text-blue-600">
              {formatNumber(availablePoints)}
            </p>
          </div>

          {/* Recipient Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Distribute To
            </label>
            <select
              name="recipientType"
              value={formData.recipientType}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="lead">Department Lead</option>
              <option value="user">Team Member (Direct)</option>
            </select>
          </div>

          {/* Recipient Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Select {formData.recipientType === 'lead' ? 'Lead' : 'Member'}
            </label>
            <select
              name="recipientId"
              value={formData.recipientId}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">-- Select --</option>
              {leads.map(lead => (
                <option key={lead.id} value={lead.id}>
                  {lead.name}
                  {lead.budget && ` (Current: ${formatCurrency(lead.budget)})`}
                </option>
              ))}
            </select>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Amount (Points)
            </label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              placeholder="1000"
              required
              min="0"
              max={availablePoints}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Reference */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Reference (Optional)
            </label>
            <input
              type="text"
              name="reference"
              value={formData.reference}
              onChange={handleChange}
              placeholder="e.g., Q1 2024 Allocation"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Summary */}
          {formData.amount && (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-2">Summary</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Points to Distribute:</span>
                  <span className="font-semibold">
                    {formatNumber(parseFloat(formData.amount || 0))}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Remaining After:</span>
                  <span className="font-semibold text-blue-600">
                    {formatNumber(availablePoints - parseFloat(formData.amount || 0))}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
            >
              {loading ? 'Distributing...' : 'Distribute Points'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
