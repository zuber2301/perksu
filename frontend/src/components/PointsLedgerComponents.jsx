import { useState, useEffect } from 'react'
import { HiOutlineXMark, HiOutlineEye, HiOutlineTrash } from 'react-icons/hi2'

/**
 * LedgerRow Component - Individual transaction row with expand/collapse
 */
export function LedgerRow({ transaction, isExpanded, onToggle, onAction, type = 'allocation' }) {
  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="inline-block w-3 h-3 bg-green-500 rounded-full"></span>
      case 'PENDING':
        return <span className="inline-block w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></span>
      case 'REVOKED':
        return <span className="inline-block w-3 h-3 bg-red-500 rounded-full"></span>
      default:
        return <span className="inline-block w-3 h-3 bg-gray-500 rounded-full"></span>
    }
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <>
      <tr className={`border-b hover:bg-blue-50 transition ${isExpanded ? 'bg-blue-50' : ''}`}>
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            {getStatusBadge(transaction.status)}
            <span className="text-sm font-medium text-gray-900">
              {formatDate(transaction.created_at)}
            </span>
          </div>
        </td>

        {type === 'allocation' ? (
          <>
            <td className="px-6 py-4">
              <div className="text-sm text-gray-600">{transaction.tenant_name || 'Unknown'}</div>
            </td>
            <td className="px-6 py-4">
              <div className="text-sm font-semibold text-green-600">
                +{transaction.amount?.toLocaleString()}
              </div>
            </td>
          </>
        ) : (
          <>
            <td className="px-6 py-4">
              <div className="text-sm text-gray-600">{transaction.wallet_owner || 'Unknown'}</div>
            </td>
            <td className="px-6 py-4">
              <div className={`text-sm font-semibold ${
                transaction.transaction_type === 'debit' ? 'text-red-600' : 'text-green-600'
              }`}>
                {transaction.transaction_type === 'debit' ? '-' : '+'}
                {(transaction.points || transaction.amount)?.toLocaleString()}
              </div>
            </td>
          </>
        )}

        <td className="px-6 py-4">
          <div className="text-sm text-gray-600 truncate max-w-xs">
            {transaction.reference_note || transaction.description || '-'}
          </div>
        </td>

        <td className="px-6 py-4 text-right">
          <button
            onClick={() => onToggle()}
            className="inline-flex items-center text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            <HiOutlineEye className="w-4 h-4 mr-1" />
            {isExpanded ? 'Hide' : 'View'}
          </button>
        </td>
      </tr>

      {isExpanded && (
        <tr className="bg-gray-50 border-b">
          <td colSpan="5" className="px-6 py-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Transaction ID</p>
                <p className="text-sm font-mono text-gray-900 break-all">{transaction.id}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Status</p>
                <p className="text-sm text-gray-900 capitalize">{transaction.status}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Amount</p>
                <p className="text-sm font-semibold text-gray-900">
                  {(transaction.amount || transaction.points)?.toLocaleString()} pts
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Currency</p>
                <p className="text-sm text-gray-900">{transaction.currency || 'INR'}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Reference Note</p>
                <p className="text-sm text-gray-900">{transaction.reference_note || transaction.description || '-'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Created By</p>
                <p className="text-sm font-mono text-gray-900">{transaction.allocated_by || transaction.created_by || 'System'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Created At</p>
                <p className="text-sm text-gray-900">
                  {new Date(transaction.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

/**
 * LedgerSummary Component - Shows aggregated statistics
 */
export function LedgerSummary({ transactions, type = 'allocation' }) {
  const stats = {
    totalTransactions: transactions.length,
    totalAmount: transactions.reduce((sum, tx) => sum + (tx.amount || tx.points || 0), 0),
    credits: transactions
      .filter(tx => tx.transaction_type !== 'debit' && tx.transaction_type !== 'CLAWBACK')
      .reduce((sum, tx) => sum + (tx.amount || tx.points || 0), 0),
    debits: transactions
      .filter(tx => tx.transaction_type === 'debit' || tx.transaction_type === 'CLAWBACK')
      .reduce((sum, tx) => sum + (tx.amount || tx.points || 0), 0),
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-white rounded-lg shadow p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Total Transactions</p>
        <p className="text-2xl font-bold text-gray-900">{stats.totalTransactions}</p>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Total Amount</p>
        <p className="text-2xl font-bold text-gray-900">{stats.totalAmount.toLocaleString()}</p>
        <p className="text-xs text-gray-500 mt-1">points</p>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Total Credits</p>
        <p className="text-2xl font-bold text-green-600">+{stats.credits.toLocaleString()}</p>
        <p className="text-xs text-gray-500 mt-1">incoming</p>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Total Debits</p>
        <p className="text-2xl font-bold text-red-600">-{stats.debits.toLocaleString()}</p>
        <p className="text-xs text-gray-500 mt-1">outgoing</p>
      </div>
    </div>
  )
}

/**
 * LedgerExportMenu Component - Export options
 */
export function LedgerExportMenu({ transactions, filename = 'ledger.csv' }) {
  const [isOpen, setIsOpen] = useState(false)

  const handleExport = (format) => {
    try {
      if (format === 'csv') {
        const csv = generateCSV(transactions)
        downloadFile(csv, `${filename}.csv`, 'text/csv')
      } else if (format === 'json') {
        const json = JSON.stringify(transactions, null, 2)
        downloadFile(json, `${filename}.json`, 'application/json')
      }
      setIsOpen(false)
    } catch (err) {
      alert('Export failed: ' + err.message)
    }
  }

  const generateCSV = (data) => {
    const headers = ['Date', 'ID', 'Amount', 'Status', 'Description']
    const rows = data.map(tx => [
      new Date(tx.created_at).toLocaleString(),
      tx.id,
      tx.amount || tx.points,
      tx.status,
      (tx.reference_note || tx.description || '-').replace(/,/g, ';'),
    ])

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n')
  }

  const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType })
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
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
      >
        ⬇ Export
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          ></div>
          <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-300 rounded-lg shadow-lg z-50">
            <button
              onClick={() => handleExport('csv')}
              className="block w-full text-left px-4 py-2 hover:bg-gray-50 text-sm font-medium first:rounded-t-lg"
            >
              📊 Export as CSV
            </button>
            <button
              onClick={() => handleExport('json')}
              className="block w-full text-left px-4 py-2 hover:bg-gray-50 text-sm font-medium last:rounded-b-lg"
            >
              { } Export as JSON
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * LedgerFilter Component - Advanced filtering options
 */
export function LedgerFilter({ onFilterChange, type = 'allocation' }) {
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    statusFilter: 'all',
    minAmount: '',
    maxAmount: '',
  })

  const handleChange = (field, value) => {
    const newFilters = { ...filters, [field]: value }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-semibold text-gray-900 mb-4">Advanced Filters</h3>
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">From Date</label>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => handleChange('dateFrom', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">To Date</label>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => handleChange('dateTo', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
          <select
            value={filters.statusFilter}
            onChange={(e) => handleChange('statusFilter', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All</option>
            <option value="COMPLETED">Completed</option>
            <option value="PENDING">Pending</option>
            <option value="REVOKED">Revoked</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Min Amount</label>
          <input
            type="number"
            value={filters.minAmount}
            onChange={(e) => handleChange('minAmount', e.target.value)}
            placeholder="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Max Amount</label>
          <input
            type="number"
            value={filters.maxAmount}
            onChange={(e) => handleChange('maxAmount', e.target.value)}
            placeholder="∞"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  )
}
