import { useState, useEffect } from 'react'
import {
  HiOutlineBanknotes,
  HiOutlineUsers,
  HiOutlineWallet,
  HiOutlineArrowTrendingUp,
  HiOutlinePlusCircle,
  HiOutlineDocumentArrowDown,
  HiOutlineBell,
} from 'react-icons/hi2'
import HeroSection from './DashboardComponents/HeroSection'
import DelegationStatusTable from './DashboardComponents/DelegationStatusTable'
import RecentRecognitionFeed from './DashboardComponents/RecentRecognitionFeed'
import SpendingAnalytics from './DashboardComponents/SpendingAnalytics'
import ActionSidebar from './DashboardComponents/ActionSidebar'
import DistributePointsModal from './DashboardComponents/DistributePointsModal'
import TopupRequestModal from './DashboardComponents/TopupRequestModal'

/**
 * TenantManagerDashboard Component
 * Main dashboard for Tenant Managers to view and manage company points allocation
 */
export default function TenantManagerDashboard() {
  const [dashboardData, setDashboardData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  
  // Modal states
  const [showDistributeModal, setShowDistributeModal] = useState(false)
  const [showTopupModal, setShowTopupModal] = useState(false)

  // Fetch dashboard summary
  const fetchDashboardData = async () => {
    try {
      setRefreshing(true)
      const response = await fetch('/api/v1/dashboard/summary', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch dashboard data: ${response.statusText}`)
      }

      const data = await response.json()
      setDashboardData(data.data)
      setError(null)
    } catch (err) {
      setError(err.message)
      console.error('Dashboard fetch error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  // Initial data fetch
  useEffect(() => {
    fetchDashboardData()
    
    // Set up refresh interval (30 seconds)
    const interval = setInterval(fetchDashboardData, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin mb-4">
            <HiOutlineArrowTrendingUp className="w-12 h-12 text-blue-600" />
          </div>
          <p className="text-gray-700 font-medium">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
        <div className="max-w-4xl mx-auto bg-red-50 border border-red-200 rounded-lg p-6 text-red-700">
          <p className="font-semibold mb-2">Error Loading Dashboard</p>
          <p>{error}</p>
          <button
            onClick={() => {
              setLoading(true)
              fetchDashboardData()
            }}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {dashboardData?.tenant_name || 'Company Dashboard'}
            </h1>
            <p className="text-gray-600 mt-1">Manage your points allocation and team recognition</p>
          </div>
          <button
            onClick={fetchDashboardData}
            disabled={refreshing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
          >
            <HiOutlineArrowTrendingUp className="w-4 h-4" />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Hero Section */}
        <HeroSection stats={dashboardData?.stats} currency={dashboardData?.currency} />

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Delegation Status Table */}
            <DelegationStatusTable
              leads={dashboardData?.leads || []}
              currency={dashboardData?.currency}
              onRefresh={fetchDashboardData}
            />

            {/* Recent Recognition Feed */}
            <RecentRecognitionFeed
              recognitions={dashboardData?.recent_recognitions || []}
              onRefresh={fetchDashboardData}
            />

            {/* Spending Analytics */}
            <SpendingAnalytics
              spendingData={dashboardData?.spending_analytics}
              currency={dashboardData?.currency}
            />
          </div>

          {/* Right Column - Action Sidebar */}
          <ActionSidebar
            tenantId={dashboardData?.tenant_id}
            onDistributeClick={() => setShowDistributeModal(true)}
            onTopupClick={() => setShowTopupModal(true)}
            onExportReport={fetchDashboardData}
            stats={dashboardData?.stats}
          />
        </div>
      </div>

      {/* Modals */}
      {showDistributeModal && (
        <DistributePointsModal
          isOpen={showDistributeModal}
          onClose={() => setShowDistributeModal(false)}
          onSuccess={() => {
            setShowDistributeModal(false)
            fetchDashboardData()
          }}
          availablePoints={dashboardData?.stats?.master_pool}
          leads={dashboardData?.leads || []}
          currency={dashboardData?.currency}
        />
      )}

      {showTopupModal && (
        <TopupRequestModal
          isOpen={showTopupModal}
          onClose={() => setShowTopupModal(false)}
          onSuccess={() => {
            setShowTopupModal(false)
            fetchDashboardData()
          }}
          tenantName={dashboardData?.tenant_name}
        />
      )}
    </div>
  )
}
