import { useState, useEffect } from 'react'
import { HiOutlineFunnel, HiOutlineArrowPath } from 'react-icons/hi2'
import { TenantManagerStats } from './TenantManagerStats'
import { AllocationPanel } from './AllocationPanel'
import { LedgerRow, LedgerSummary, LedgerExportMenu, LedgerFilter } from './PointsLedgerComponents'

/**
 * PointsAllocationDashboard Component
 * Admin dashboard for managing and auditing points allocation system
 */
export default function PointsAllocationDashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [allocationLogs, setAllocationLogs] = useState([])
  const [billingLogs, setBillingLogs] = useState([])
  const [walletLedger, setWalletLedger] = useState([])
  const [expandedRows, setExpandedRows] = useState(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [pagination, setPagination] = useState({
    allocation: { page: 1, total: 0, pages: 0 },
    billing: { page: 1, total: 0, pages: 0 },
    wallet: { page: 1, total: 0, pages: 0 },
  })
  const [filters, setFilters] = useState({
    allocation: { statusFilter: 'all', search: '', dateFrom: '', dateTo: '' },
    billing: { statusFilter: 'all', search: '', dateFrom: '', dateTo: '' },
    wallet: { statusFilter: 'all', search: '' },
  })

  // Fetch allocation logs
  const fetchAllocationLogs = async (page = 1) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
        sort_by: 'created_at',
        sort_order: 'desc',
        ...(filters.allocation.statusFilter !== 'all' && { status: filters.allocation.statusFilter }),
        ...(filters.allocation.search && { search: filters.allocation.search }),
        ...(filters.allocation.dateFrom && { date_from: filters.allocation.dateFrom }),
        ...(filters.allocation.dateTo && { date_to: filters.allocation.dateTo }),
      })

      const response = await fetch(`/api/v1/points/ledger/allocation-logs?${params}`)
      const result = await response.json()

      if (result.success) {
        setAllocationLogs(result.transactions)
        setPagination(prev => ({
          ...prev,
          allocation: {
            page: result.page,
            total: result.total,
            pages: result.pages,
          },
        }))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Fetch billing logs
  const fetchBillingLogs = async (page = 1) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
        sort_by: 'created_at',
        sort_order: 'desc',
        ...(filters.billing.search && { search: filters.billing.search }),
        ...(filters.billing.dateFrom && { date_from: filters.billing.dateFrom }),
        ...(filters.billing.dateTo && { date_to: filters.billing.dateTo }),
      })

      const response = await fetch(`/api/v1/points/ledger/platform-billing-logs?${params}`)
      const result = await response.json()

      if (result.success) {
        setBillingLogs(result.transactions)
        setPagination(prev => ({
          ...prev,
          billing: {
            page: result.page,
            total: result.total,
            pages: result.pages,
          },
        }))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Fetch wallet ledger
  const fetchWalletLedger = async (page = 1) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '25',
        sort_by: 'points',
        sort_order: 'desc',
        ...(filters.wallet.search && { search: filters.wallet.search }),
      })

      const response = await fetch(`/api/v1/points/ledger/wallet-ledger?${params}`)
      const result = await response.json()

      if (result.success) {
        setWalletLedger(result.transactions)
        setPagination(prev => ({
          ...prev,
          wallet: {
            page: result.page,
            total: result.total,
            pages: result.pages,
          },
        }))
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Load data on mount and when tab changes
  useEffect(() => {
    if (activeTab === 'allocation-logs') fetchAllocationLogs()
    else if (activeTab === 'billing-logs') fetchBillingLogs()
    else if (activeTab === 'wallet-ledger') fetchWalletLedger()
  }, [activeTab])

  const toggleExpanded = (rowId) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(rowId)) {
      newExpanded.delete(rowId)
    } else {
      newExpanded.add(rowId)
    }
    setExpandedRows(newExpanded)
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Points Allocation Dashboard</h1>
        <p className="text-gray-600">Manage and audit your points allocation system</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="mb-6 p-4 bg-red-100 border border-red-400 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Overview Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <TenantManagerStats />
          <AllocationPanel onSuccess={() => {
            // Refresh stats after successful allocation
            setActiveTab('allocation-logs')
            fetchAllocationLogs(1)
          }} />
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="mb-6 flex gap-2 border-b border-gray-300">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'overview'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('allocation-logs')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'allocation-logs'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Allocation Logs
        </button>
        <button
          onClick={() => setActiveTab('billing-logs')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'billing-logs'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Billing Logs
        </button>
        <button
          onClick={() => setActiveTab('wallet-ledger')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'wallet-ledger'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Wallet Ledger
        </button>
      </div>

      {/* Allocation Logs Tab */}
      {activeTab === 'allocation-logs' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Allocation Logs</h2>
            <div className="flex gap-2">
              <button
                onClick={() => fetchAllocationLogs(1)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
              >
                <HiOutlineArrowPath className="w-4 h-4" />
                Refresh
              </button>
              <LedgerExportMenu transactions={allocationLogs} filename="allocation-logs" />
            </div>
          </div>

          <LedgerSummary transactions={allocationLogs} type="allocation" />

          <LedgerFilter
            onFilterChange={(newFilters) => {
              setFilters(prev => ({ ...prev, allocation: newFilters }))
              fetchAllocationLogs(1)
            }}
            type="allocation"
          />

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin">
                <HiOutlineArrowPath className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tenant</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Reference</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocationLogs.length > 0 ? (
                      allocationLogs.map(log => (
                        <LedgerRow
                          key={log.id}
                          transaction={log}
                          isExpanded={expandedRows.has(log.id)}
                          onToggle={() => toggleExpanded(log.id)}
                          type="allocation"
                        />
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                          No allocation logs found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.allocation.pages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    Showing {(pagination.allocation.page - 1) * 25 + 1} to{' '}
                    {Math.min(pagination.allocation.page * 25, pagination.allocation.total)} of{' '}
                    {pagination.allocation.total} records
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchAllocationLogs(pagination.allocation.page - 1)}
                      disabled={pagination.allocation.page === 1}
                      className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    {Array.from({ length: pagination.allocation.pages }).map((_, i) => (
                      <button
                        key={i + 1}
                        onClick={() => fetchAllocationLogs(i + 1)}
                        className={`px-3 py-1 rounded-lg transition ${
                          pagination.allocation.page === i + 1
                            ? 'bg-blue-600 text-white'
                            : 'border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      onClick={() => fetchAllocationLogs(pagination.allocation.page + 1)}
                      disabled={pagination.allocation.page === pagination.allocation.pages}
                      className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Billing Logs Tab */}
      {activeTab === 'billing-logs' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Platform Billing Logs</h2>
            <div className="flex gap-2">
              <button
                onClick={() => fetchBillingLogs(1)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
              >
                <HiOutlineArrowPath className="w-4 h-4" />
                Refresh
              </button>
              <LedgerExportMenu transactions={billingLogs} filename="billing-logs" />
            </div>
          </div>

          <LedgerSummary transactions={billingLogs} type="billing" />

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin">
                <HiOutlineArrowPath className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Tenant</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Amount</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Reference</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {billingLogs.length > 0 ? (
                      billingLogs.map(log => (
                        <LedgerRow
                          key={log.id}
                          transaction={log}
                          isExpanded={expandedRows.has(log.id)}
                          onToggle={() => toggleExpanded(log.id)}
                          type="billing"
                        />
                      ))
                    ) : (
                      <tr>
                        <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                          No billing logs found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Wallet Ledger Tab */}
      {activeTab === 'wallet-ledger' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Wallet Ledger</h2>
            <div className="flex gap-2">
              <button
                onClick={() => fetchWalletLedger(1)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
              >
                <HiOutlineArrowPath className="w-4 h-4" />
                Refresh
              </button>
              <LedgerExportMenu transactions={walletLedger} filename="wallet-ledger" />
            </div>
          </div>

          <LedgerSummary transactions={walletLedger} type="wallet" />

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin">
                <HiOutlineArrowPath className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          ) : (
            <>
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">User</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Balance</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {walletLedger.length > 0 ? (
                      walletLedger.map(wallet => (
                        <tr key={wallet.id} className="border-b hover:bg-blue-50 transition">
                          <td className="px-6 py-4">
                            <span className="text-sm font-medium text-gray-900">{wallet.user_name}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm text-gray-600">{wallet.user_email}</span>
                          </td>
                          <td className="px-6 py-4">
                            <span className="text-sm font-semibold text-green-600">
                              {formatNumber(wallet.points)}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                              wallet.status === 'ACTIVE'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {wallet.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="px-6 py-12 text-center text-gray-500">
                          No wallets found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination.wallet.pages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    Showing {(pagination.wallet.page - 1) * 25 + 1} to{' '}
                    {Math.min(pagination.wallet.page * 25, pagination.wallet.total)} of{' '}
                    {pagination.wallet.total} wallets
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => fetchWalletLedger(pagination.wallet.page - 1)}
                      disabled={pagination.wallet.page === 1}
                      className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Previous
                    </button>
                    {Array.from({ length: pagination.wallet.pages }).map((_, i) => (
                      <button
                        key={i + 1}
                        onClick={() => fetchWalletLedger(i + 1)}
                        className={`px-3 py-1 rounded-lg transition ${
                          pagination.wallet.page === i + 1
                            ? 'bg-blue-600 text-white'
                            : 'border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      onClick={() => fetchWalletLedger(pagination.wallet.page + 1)}
                      disabled={pagination.wallet.page === pagination.wallet.pages}
                      className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
