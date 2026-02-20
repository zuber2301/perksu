import { useState } from 'react'
import { HiOutlineXMark } from 'react-icons/hi2'
import { formatCurrency } from '../../../lib/currency'

export default function AddPointsModal({ isOpen, onClose, department, availablePoints = 0, onSubmit }) {
  const [amount, setAmount] = useState('')
  const [error, setError] = useState(null)

  if (!isOpen) return null

  const parsed = parseFloat(amount || 0)
  const remaining = availablePoints - (isNaN(parsed) ? 0 : parsed)

  const handleSubmit = (e) => {
    e.preventDefault()
    setError(null)
    if (!amount || isNaN(parsed) || parsed <= 0) {
      setError('Please enter a valid amount')
      return
    }
    if (parsed > availablePoints) {
      setError('Amount cannot exceed the Total Budget (Tenant)')
      return
    }
    onSubmit(parsed)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">Add Points to {department.name}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><HiOutlineXMark className="w-6 h-6 text-gray-600"/></button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
          <div className="p-3 bg-blue-50 border border-blue-100 rounded">
            <p className="text-xs text-gray-600">Total Budget (Tenant) Balance</p>
            <p className="text-2xl font-bold">{formatCurrency(availablePoints)}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount to Allocate to {department.name}</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500"
              min="0"
            />
            {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
          </div>

          <div className="p-3 bg-gray-50 rounded">
            <p className="text-sm text-gray-600">Preview</p>
            <div className="flex justify-between items-center mt-2">
              <div>New Total Budget (Tenant)</div>
              <div className="font-semibold">{formatCurrency(remaining >= 0 ? remaining : 0)}</div>
            </div>
            <div className="flex justify-between items-center mt-1">
              <div>New Dept Budget</div>
              <div className="font-semibold">{formatCurrency(department.dept_budget_balance + (isNaN(parsed) ? 0 : parsed))}</div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 text-white rounded">Add Points</button>
          </div>
        </form>
      </div>
    </div>
  )
}
