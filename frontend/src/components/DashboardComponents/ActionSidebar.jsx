import { HiOutlinePlusCircle, HiOutlineBell, HiOutlineDocumentArrowDown } from 'react-icons/hi2'
import { formatNumber } from '../../lib/currency'

/**
 * ActionSidebar Component
 * Quick action buttons for managers
 */
export default function ActionSidebar({
  tenantId,
  onDistributeClick,
  onTopupClick,
  onExportReport,
  stats
}) {
  const handleExportReport = async () => {
    try {
      const response = await fetch(`/api/v1/dashboard/export-report/${tenantId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })

      if (response.ok) {
        // Create blob and download
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `monthly-report-${new Date().toISOString().split('T')[0]}.csv`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to export report')
    }
  }

  const actions = [
    {
      id: 'distribute',
      title: 'Distribute Points',
      description: 'Send points to a Lead or User',
      icon: HiOutlinePlusCircle,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      onClick: onDistributeClick,
    },
    {
      id: 'topup',
      title: 'Top-up Request',
      description: 'Request more points from admin',
      icon: HiOutlineBell,
      color: 'from-yellow-500 to-yellow-600',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-600',
      onClick: onTopupClick,
    },
    {
      id: 'export',
      title: 'Export Report',
      description: 'Download monthly transactions',
      icon: HiOutlineDocumentArrowDown,
      color: 'from-emerald-500 to-emerald-600',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
      onClick: handleExportReport,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Quick Actions Panel */}
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>

        <div className="space-y-3">
          {actions.map(action => {
            const Icon = action.icon
            return (
              <button
                key={action.id}
                onClick={action.onClick}
                className={`w-full ${action.bgColor} border-2 border-gray-200 rounded-lg p-4 hover:shadow-md transition group`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg bg-gradient-to-br ${action.color} text-white group-hover:scale-110 transition`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-left">
                    <p className={`font-semibold ${action.textColor}`}>
                      {action.title}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {action.description}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Summary Stats Card */}
      {stats && (
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-md p-6 text-white">
          <h3 className="text-lg font-bold mb-4">At a Glance</h3>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm opacity-90 mb-1">Active Users</p>
              <p className="text-2xl font-bold">
                {formatNumber(stats.active_users_count) || 0}
              </p>
            </div>

            <div className="pt-4 border-t border-blue-400">
              <p className="text-sm opacity-90 mb-2">Available to Distribute</p>
              <div className="flex items-baseline gap-2">
                <p className="text-3xl font-bold">
                  {formatNumber(stats.master_pool) || 0}
                </p>
                <p className="text-sm opacity-75">points</p>
              </div>
            </div>

            <div className="pt-4 border-t border-blue-400">
              <p className="text-sm opacity-90 mb-2">Employee Participation</p>
              <div className="w-full bg-blue-400 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-white"
                  style={{
                    width: `${stats.active_users_count > 0 ? Math.min((stats.active_users_count / 500) * 100, 100) : 0}%`,
                  }}
                />
              </div>
              <p className="text-xs opacity-75 mt-2">
                {stats.active_users_count || 0} of ~500 employees
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Help Card */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
        <h4 className="font-semibold text-gray-900 text-sm mb-2">Need Help?</h4>
        <p className="text-xs text-gray-600 mb-3">
          Explore our documentation for detailed guides and best practices.
        </p>
        <a
          href="https://docs.yourcompany.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          View Documentation →
        </a>
      </div>
    </div>
  )
}
