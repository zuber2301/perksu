import { useEffect, useState } from 'react'
import { HiOutlineBanknotes, HiOutlineExclamationCircle } from 'react-icons/hi2'
import { formatNumber } from '../lib/currency'

export default function TenantManagerStats() {
  const [allocationStats, setAllocationStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetchAllocationStats = async () => {
      try {
        const response = await fetch('/api/v1/points/tenant-allocation-stats', {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error('Failed to fetch allocation stats')
        }

        const data = await response.json()
        setAllocationStats(data)
        setError(null)
      } catch (err) {
        setError(err.message)
        setAllocationStats(null)
      } finally {
        setLoading(false)
      }
    }

    fetchAllocationStats()
    // Refresh every 30 seconds
    const interval = setInterval(fetchAllocationStats, 30000)

    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="h-8 bg-gray-200 rounded w-1/2"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center gap-2 text-red-700">
          <HiOutlineExclamationCircle className="w-5 h-5" />
          <span>Failed to load allocation stats: {error}</span>
        </div>
      </div>
    )
  }

  if (!allocationStats) {
    return null
  }

  const balance = parseFloat(allocationStats.points_allocation_balance)
  const isLowBalance = balance < 100
  const isNoBalance = balance === 0

  return (
    <div className={`rounded-lg shadow p-6 ${isNoBalance ? 'bg-yellow-50 border border-yellow-200' : 'bg-white'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <HiOutlineBanknotes className={`w-6 h-6 ${isNoBalance ? 'text-yellow-600' : 'text-blue-600'}`} />
          <h3 className="font-semibold text-gray-900">Company Distribution Pool</h3>
        </div>
      </div>

      {/* Balance Display */}
      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-1">Available to Distribute</p>
        <p className={`text-3xl font-bold ${isNoBalance ? 'text-yellow-600' : 'text-gray-900'}`}>
          {formatNumber(balance)}
        </p>
        <p className="text-sm text-gray-500 mt-1">{allocationStats.currency_label}</p>
      </div>

      {/* Status Message */}
      <div className={`p-3 rounded text-sm ${
        isNoBalance
          ? 'bg-yellow-100 text-yellow-800'
          : isLowBalance
          ? 'bg-blue-100 text-blue-800'
          : 'bg-green-100 text-green-800'
      }`}>
        {allocationStats.message}
      </div>

      {/* Info Box */}
      <div className="mt-4 p-3 bg-gray-50 rounded text-xs text-gray-600">
        <p className="font-semibold mb-1">How it works:</p>
        <ul className="space-y-1 list-disc list-inside">
          <li>Platform Admin allocates points to this pool</li>
          <li>You distribute these points as recognition to employees</li>
          <li>Each recognition reduces this balance</li>
          <li>When balance is zero, no new recognitions can be awarded</li>
        </ul>
      </div>

      {/* Tenant Status */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500">
          Tenant: <span className="font-semibold text-gray-700">{allocationStats.tenant_name}</span>
        </p>
        <p className="text-xs text-gray-500 mt-1">
          Status: <span className={`font-semibold ${allocationStats.status === 'ACTIVE' ? 'text-green-600' : 'text-gray-700'}`}>
            {allocationStats.status}
          </span>
        </p>
      </div>
    </div>
  )
}
