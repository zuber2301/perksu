import { useState } from 'react'
import { HiOutlinePencil, HiOutlineTrash, HiOutlineEye } from 'react-icons/hi2'
import { formatNumber } from '../../lib/currency'

/**
 * DelegationStatusTable Component
 * Displays leads and their delegated budgets with usage tracking
 */
export default function DelegationStatusTable({ leads, currency = 'INR', onRefresh }) {
  const [expandedLead, setExpandedLead] = useState(null)

  const getUsagePercentage = (used, assigned) => {
    if (assigned === 0) return 0
    return Math.round((used / assigned) * 100)
  }

  const getStatusColor = (percentage) => {
    if (percentage >= 90) return 'text-red-600'
    if (percentage >= 70) return 'text-yellow-600'
    return 'text-green-600'
  }

  const getProgressBarColor = (percentage) => {
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 70) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Delegation Status</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage Department Leads and their delegated budgets
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          Refresh
        </button>
      </div>

      {leads && leads.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Lead Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Budget Assigned
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Budget Used
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                  Usage %
                </th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead, index) => {
                const percentage = getUsagePercentage(lead.used, lead.budget)
                return (
                  <tr
                    key={index}
                    className="border-b border-gray-200 hover:bg-gray-50 transition"
                  >
                    <td className="px-6 py-4">
                      <span className="font-semibold text-gray-900">{lead.name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {lead.department || 'Engineering'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-gray-900">
                        {formatNumber(lead.budget) || 0} pts
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-gray-600">
                        {formatNumber(lead.used) || 0} pts
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-24">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full transition ${getProgressBarColor(
                                percentage
                              )}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                        <span
                          className={`text-sm font-semibold ${getStatusColor(percentage)}`}
                        >
                          {percentage}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() =>
                            setExpandedLead(
                              expandedLead === index ? null : index
                            )
                          }
                          className="p-2 hover:bg-blue-100 text-blue-600 rounded-lg transition"
                          title="View Details"
                        >
                          <HiOutlineEye className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 hover:bg-amber-100 text-amber-600 rounded-lg transition"
                          title="Edit Budget"
                        >
                          <HiOutlinePencil className="w-4 h-4" />
                        </button>
                        <button
                          className="p-2 hover:bg-red-100 text-red-600 rounded-lg transition"
                          title="Recall Budget"
                        >
                          <HiOutlineTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-6 py-12 text-center text-gray-500">
          <p>No Department Leads found. Create one to start delegating budgets.</p>
        </div>
      )}

      {/* Summary Footer */}
      {leads && leads.length > 0 && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase mb-1">
              Total Assigned
            </p>
            <p className="text-lg font-bold text-gray-900">
              {formatNumber(leads.reduce((sum, lead) => sum + (lead.budget || 0), 0))}
              pts
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase mb-1">
              Total Used
            </p>
            <p className="text-lg font-bold text-gray-900">
              {formatNumber(leads.reduce((sum, lead) => sum + (lead.used || 0), 0))}
              pts
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-gray-600 uppercase mb-1">
              Remaining
            </p>
            <p className="text-lg font-bold text-green-600">
              {formatNumber(
                leads.reduce((sum, lead) => sum + (lead.budget || 0), 0) -
                leads.reduce((sum, lead) => sum + (lead.used || 0), 0)
              )}
              pts
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
