import { useState } from 'react'
import { HiOutlineXMark } from 'react-icons/hi2'

/**
 * TopupRequestModal Component
 * Modal for requesting additional points from platform admin
 */
export default function TopupRequestModal({
  isOpen,
  onClose,
  onSuccess,
  tenantName = 'Your Company'
}) {
  const [formData, setFormData] = useState({
    amount: '',
    justification: '',
    urgency: 'normal',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

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
      if (!formData.amount) {
        throw new Error('Please specify the amount requested')
      }

      const response = await fetch('/api/v1/dashboard/topup-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          amount: parseFloat(formData.amount),
          justification: formData.justification,
          urgency: formData.urgency,
        })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.detail || 'Failed to submit request')
      }

      setSuccess(true)
      setTimeout(() => {
        onSuccess()
      }, 2000)
    } catch (err) {
      setError(err.message)
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
          <h2 className="text-xl font-bold text-gray-900">Request Top-up</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
          >
            <HiOutlineXMark className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        {/* Content */}
        {success ? (
          <div className="px-6 py-12 text-center">
            <div className="inline-block p-3 bg-green-100 rounded-full mb-4">
              <svg className="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-lg font-semibold text-gray-900 mb-2">Request Submitted!</p>
            <p className="text-gray-600 mb-6">
              Your top-up request has been sent to the Platform Admin. You will be notified once it is reviewed.
            </p>
            <button
              onClick={onSuccess}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Info Box */}
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              <p className="font-semibold mb-1">Submit a Request</p>
              <p className="text-xs">
                Let the Platform Admin know how many additional points {tenantName} needs
              </p>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Points Requested
              </label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleChange}
                placeholder="5000"
                required
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Urgency */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Urgency Level
              </label>
              <select
                name="urgency"
                value={formData.urgency}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Low (No rush)</option>
                <option value="normal">Normal (Next week)</option>
                <option value="high">High (Within 2-3 days)</option>
                <option value="urgent">Urgent (ASAP)</option>
              </select>
            </div>

            {/* Justification */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Reason/Justification
              </label>
              <textarea
                name="justification"
                value={formData.justification}
                onChange={handleChange}
                placeholder="e.g., Team growth, upcoming projects, etc."
                rows="4"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>

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
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
