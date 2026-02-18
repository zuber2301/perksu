import { useState } from 'react'
import { HiOutlineGift, HiOutlineCheckCircle, HiOutlineExclamationCircle } from 'react-icons/hi2'

export default function AllocationPanel({ tenantId, tenantName, onAllocationSuccess }) {
  const [amount, setAmount] = useState('')
  const [referenceNote, setReferenceNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(null)
  const [error, setError] = useState(null)

  const handleAllocate = async (e) => {
    e.preventDefault()

    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount')
      return
    }

    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/v1/points/allocate-to-tenant', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          amount: parseFloat(amount),
          currency: 'INR',
          reference_note: referenceNote || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.detail || 'Failed to allocate points')
      }

      const data = await response.json()
      setSuccess(data)
      setAmount('')
      setReferenceNote('')

      if (onAllocationSuccess) {
        onAllocationSuccess(data)
      }

      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <HiOutlineGift className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-semibold text-gray-900">Allocate Points to Tenant</h2>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-3">
            <HiOutlineCheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-800">Allocation Successful</p>
              <p className="text-sm text-green-700 mt-1">
                {success.amount_allocated} points allocated to {tenantName}
              </p>
              <p className="text-xs text-green-600 mt-1">
                New Balance: {success.new_allocation_balance} points
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-3">
            <HiOutlineExclamationCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-red-800">Allocation Failed</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleAllocate} className="space-y-4">
        <div>
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
            Points to Allocate
          </label>
          <div className="relative">
            <input
              id="amount"
              type="number"
              min="100"
              step="100"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter number of points (e.g., 50000)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm font-medium">
              pts
            </span>
          </div>
        </div>

        <div>
          <label htmlFor="referenceNote" className="block text-sm font-medium text-gray-700 mb-2">
            Reference Note (Optional)
          </label>
          <input
            id="referenceNote"
            type="text"
            value={referenceNote}
            onChange={(e) => setReferenceNote(e.target.value)}
            placeholder="e.g., Monthly subscription - Invoice #8842"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />
          <p className="text-xs text-gray-500 mt-1">
            This will be recorded in audit logs for tracking
          </p>
        </div>

        <button
          type="submit"
          disabled={loading || !amount}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">⏳</span>
              Allocating...
            </span>
          ) : (
            'Allocate Points'
          )}
        </button>
      </form>

      {/* Info Box */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-blue-900">
        <p className="font-semibold mb-2">What happens next:</p>
        <ol className="space-y-1 list-decimal list-inside">
          <li>Points are added to {tenantName}'s distribution pool</li>
          <li>Their Tenant Manager can see "Available to Distribute"</li>
          <li>They can award points to employees as recognition</li>
          <li>All transactions are logged for audit purposes</li>
        </ol>
      </div>
    </div>
  )
}
