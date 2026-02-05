import { useState, useEffect } from 'react'
import { HiOutlineChevronDown, HiOutlineSearch, HiOutlineFilter, HiOutlineArrowDownTray } from 'react-icons/hi2'
import { formatCurrency, formatNumber } from '../lib/currency'

export default function PointsLedger({ viewType = 'allocation', tenantId = null }) {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState('all')
  const [sortBy, setSortBy] = useState('date-desc')
  const [expandedRow, setExpandedRow] = useState(null)
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0 })

  // Transaction types by view
  const transactionTypes = {
    allocation: [
      { value: 'CREDIT_INJECTION', label: 'Credit Injection', color: 'bg-green-100 text-green-800' },
      { value: 'CLAWBACK', label: 'Clawback', color: 'bg-red-100 text-red-800' },
      { value: 'ADJUSTMENT', label: 'Adjustment', color: 'bg-yellow-100 text-yellow-800' },
    ],
    wallet: [
      { value: 'recognition', label: 'Recognition Award', color: 'bg-blue-100 text-blue-800' },
      { value: 'redemption', label: 'Redemption', color: 'bg-purple-100 text-purple-800' },
      { value: 'expiry', label: 'Expiry', color: 'bg-orange-100 text-orange-800' },
      { value: 'reversal', label: 'Reversal', color: 'bg-gray-100 text-gray-800' },
      { value: 'adjustment', label: 'Adjustment', color: 'bg-yellow-100 text-yellow-800' },
    ],
  }

  const types = transactionTypes[viewType] || transactionTypes.allocation

  useEffect(() => {
    fetchTransactions()
  }, [pagination.page, selectedType, sortBy, searchTerm])

  const fetchTransactions = async () => {
    setLoading(true)
    setError(null)

    try {
      const queryParams = new URLSearchParams({
        page: pagination.page,
        limit: pagination.limit,
        sort: sortBy,
        search: searchTerm,
        type: selectedType !== 'all' ? selectedType : undefined,
        view: viewType,
      })

      if (tenantId) {
        queryParams.append('tenant_id', tenantId)
      }

      const endpoint = viewType === 'allocation' 
        ? '/api/v1/points/allocation-logs' 
        : '/api/v1/wallets/ledger'

      const response = await fetch(`${endpoint}?${queryParams}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        throw new Error('Failed to fetch transactions')
      }

      const data = await response.json()
      setTransactions(data.transactions || [])
      setPagination(prev => ({ ...prev, total: data.total || 0 }))
    } catch (err) {
      setError(err.message)
      setTransactions([])
    } finally {
      setLoading(false)
    }
  }

  const getTotalPages = () => Math.ceil(pagination.total / pagination.limit)

  const getTypeInfo = (type) => {
    return types.find(t => t.value === type) || { value: type, label: type, color: 'bg-gray-100 text-gray-800' }
  }

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'CREDIT_INJECTION':
        return '💰'
      case 'CLAWBACK':
        return '⚠️'
      case 'recognition':
      case 'RECOGNITION':
        return '⭐'
      case 'redemption':
      case 'REDEMPTION':
        return '🎁'
      case 'expiry':
        return '⏰'
      case 'ADJUSTMENT':
      case 'adjustment':
        return '🔧'
      case 'reversal':
        return '↩️'
      default:
        return '📝'
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleExport = async () => {
    try {
      const csv = generateCSV(transactions)
      downloadCSV(csv, `points-ledger-${new Date().toISOString().split('T')[0]}.csv`)
    } catch (err) {
      alert('Failed to export: ' + err.message)
    }
  }

  const generateCSV = (data) => {
    const headers = ['Date', 'Type', 'Amount', 'Balance After', 'Description', 'Reference ID']
    const rows = data.map(tx => [
      formatDate(tx.created_at),
      tx.transaction_type || tx.source,
      tx.amount || tx.points,
      tx.balance_after,
      tx.description || tx.reference_note || '-',
      tx.id,
    ])

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n')
  }

  const downloadCSV = (csv, filename) => {
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {viewType === 'allocation' ? 'Allocation Ledger' : 'Wallet Ledger'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {transactions.length > 0 
              ? `Showing ${(pagination.page - 1) * pagination.limit + 1} to ${Math.min(pagination.page * pagination.limit, pagination.total)} of ${pagination.total} transactions`
              : 'No transactions yet'
            }
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={transactions.length === 0}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition"
        >
          <HiOutlineArrowDownTray className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value)
                setPagination(prev => ({ ...prev, page: 1 }))
              }}
              placeholder="Search by description or ID..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Type Filter */}
          <div className="relative">
            <HiOutlineFilter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value)
                setPagination(prev => ({ ...prev, page: 1 }))
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none"
            >
              <option value="all">All Types</option>
              {types.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value)
              setPagination(prev => ({ ...prev, page: 1 }))
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="amount-desc">Highest Amount</option>
            <option value="amount-asc">Lowest Amount</option>
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="inline-block animate-spin">⏳</div>
          <p className="text-gray-500 mt-2">Loading transactions...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error: {error}</p>
        </div>
      ) : transactions.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 text-lg">No transactions found</p>
          <p className="text-gray-400 text-sm mt-2">Try adjusting your filters</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Date & Time</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Type</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">Amount</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">Balance After</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Description</th>
                  <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {transactions.map((tx) => {
                  const typeInfo = getTypeInfo(tx.transaction_type || tx.source)
                  const isExpanded = expandedRow === tx.id

                  return (
                    <tr key={tx.id} className="hover:bg-gray-50 transition">
                      {/* Date */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatDate(tx.created_at)}
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${typeInfo.color}`}>
                          <span>{getTransactionIcon(tx.transaction_type || tx.source)}</span>
                          <span>{typeInfo.label}</span>
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className={`text-sm font-semibold ${
                          tx.transaction_type === 'debit' || tx.source === 'redemption'
                            ? 'text-red-600'
                            : 'text-green-600'
                        }`}>
                          {tx.transaction_type === 'debit' || tx.source === 'redemption' ? '-' : '+'}
                          {formatNumber(tx.amount || tx.points || 0)}
                        </div>
                      </td>

                      {/* Balance After */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {formatNumber(tx.balance_after || 0)}
                        </div>
                      </td>

                      {/* Description */}
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-600 truncate max-w-xs">
                          {tx.description || tx.reference_note || '-'}
                        </div>
                      </td>

                      {/* Expand Button */}
                      <td className="px-6 py-4 text-center">
                        <button
                          onClick={() => setExpandedRow(isExpanded ? null : tx.id)}
                          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700"
                        >
                          <HiOutlineChevronDown
                            className={`w-5 h-5 transition ${isExpanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Expanded Details Row */}
          {transactions.map((tx) => (
            expandedRow === tx.id && (
              <div key={`${tx.id}-expanded`} className="bg-gray-50 border-t-2 border-blue-200 px-6 py-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Transaction Details</h4>
                    <dl className="space-y-2">
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Transaction ID:</dt>
                        <dd className="font-mono text-sm text-gray-900">{tx.id}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Type:</dt>
                        <dd className="text-gray-900">{tx.transaction_type || tx.source}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Amount:</dt>
                        <dd className="text-gray-900 font-semibold">{formatNumber(tx.amount || tx.points || 0)}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Balance After:</dt>
                        <dd className="text-gray-900 font-semibold">{formatNumber(tx.balance_after || 0)}</dd>
                      </div>
                    </dl>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-3">Additional Information</h4>
                    <dl className="space-y-2">
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Status:</dt>
                        <dd className="text-gray-900 capitalize">{tx.status || 'Completed'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Created By:</dt>
                        <dd className="text-gray-900 font-mono text-sm">{tx.created_by || 'System'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Reference:</dt>
                        <dd className="text-gray-900 font-mono text-sm break-all">{tx.reference_id || tx.reference_note || '-'}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Created At:</dt>
                        <dd className="text-gray-900">{formatDate(tx.created_at)}</dd>
                      </div>
                    </dl>
                  </div>
                </div>
              </div>
            )
          ))}
        </div>
      )}

      {/* Pagination */}
      {getTotalPages() > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Page {pagination.page} of {getTotalPages()}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
              disabled={pagination.page === 1}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            {Array.from({ length: Math.min(5, getTotalPages()) }).map((_, i) => {
              const pageNum = Math.max(1, pagination.page - 2) + i
              if (pageNum > getTotalPages()) return null
              return (
                <button
                  key={pageNum}
                  onClick={() => setPagination(prev => ({ ...prev, page: pageNum }))}
                  className={`px-4 py-2 rounded-lg transition ${
                    pagination.page === pageNum
                      ? 'bg-blue-600 text-white'
                      : 'border border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {pageNum}
                </button>
              )
            })}
            <button
              onClick={() => setPagination(prev => ({ ...prev, page: Math.min(getTotalPages(), prev.page + 1) }))}
              disabled={pagination.page === getTotalPages()}
              className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
