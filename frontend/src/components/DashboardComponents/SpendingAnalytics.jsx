import { HiOutlineChartBar } from 'react-icons/hi2'
import { formatCurrency, formatNumber } from '../../lib/currency'

/**
 * SpendingAnalytics Component
 * Shows spending distribution by category (gift cards, etc.)
 */
export default function SpendingAnalytics({ spendingData, currency = 'INR' }) {
  if (!spendingData || spendingData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">
          Redemptions & Spending
        </h2>
        <div className="text-center py-12 text-gray-500">
          <HiOutlineChartBar className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No spending data available yet</p>
        </div>
      </div>
    )
  }

  const total = spendingData.reduce((sum, item) => sum + item.amount, 0)

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900">Redemptions & Spending</h2>
        <p className="text-sm text-gray-600 mt-1">
          Top categories where your employees are redeeming points
        </p>
      </div>

      <div className="px-6 py-6">
        <div className="space-y-4">
          {spendingData.map((item, index) => {
            const percentage = (item.amount / total) * 100
            const colors = [
              'from-blue-500 to-blue-600',
              'from-purple-500 to-purple-600',
              'from-pink-500 to-pink-600',
              'from-yellow-500 to-yellow-600',
              'from-emerald-500 to-emerald-600',
            ]

            return (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {item.category || `Category ${index + 1}`}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {item.redemptions || 0} redemptions
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">
                      {formatCurrency(item.amount || 0)}
                    </p>
                    <p className="text-xs text-gray-600">
                      {percentage.toFixed(0)}% of total
                    </p>
                  </div>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-3 bg-gradient-to-r ${
                      colors[index % colors.length]
                    } rounded-full transition-all duration-500`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Insights */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <p className="text-sm font-semibold text-gray-900 mb-3">Key Insights</p>
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <p className="text-sm text-gray-700">
              <span className="font-semibold">
                {spendingData[0]?.category || 'Food & Beverage'}
              </span>
              {' '}is the most popular category with{' '}
              <span className="font-semibold">
                {Math.round(
                  (spendingData[0]?.amount /
                    spendingData.reduce((sum, item) => sum + item.amount, 0)) *
                    100
                )}
                %
              </span>
              {' '}of your employee redemptions
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
