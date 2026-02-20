import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '../lib/api'
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
import DepartmentManagementTable from './DashboardComponents/DepartmentManagementTable'
import RecentRecognitionFeed from './DashboardComponents/RecentRecognitionFeed'
import SpendingAnalytics from './DashboardComponents/SpendingAnalytics'
import ActionSidebar from './DashboardComponents/ActionSidebar'
import DistributePointsModal from './DashboardComponents/DistributePointsModal'
import TopupRequestModal from './DashboardComponents/TopupRequestModal'

/**
 * TenantManagerDashboard Component
 * Main dashboard for HR Admins to view and manage company points allocation
 */
export default function TenantManagerDashboard() {
  // Modal states
  const [showDistributeModal, setShowDistributeModal] = useState(false)
  const [showTopupModal, setShowTopupModal] = useState(false)

  // Fetch dashboard summary using React Query
  const { 
    data: summaryResponse, 
    isLoading, 
    isError, 
    error, 
    refetch, 
    isFetching 
  } = useQuery({
    queryKey: ['dashboardSummary'],
    queryFn: () => dashboardApi.getSummary(),
    refetchInterval: 60000, // Refresh every minute
  })

  const dashboardData = summaryResponse?.data?.data || summaryResponse?.data

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin mb-4">
            <HiOutlineArrowTrendingUp className="w-12 h-12 text-perksu-purple" />
          </div>
          <p className="text-gray-700 font-medium">Loading your management dashboard...</p>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="p-8">
        <div className="max-w-4xl mx-auto bg-red-50 border border-red-200 rounded-2xl p-6 text-red-700">
          <p className="font-semibold mb-2 text-lg">Error Loading Dashboard</p>
          <p>{error?.message || 'Could not fetch dashboard data'}</p>
          <button
            onClick={() => refetch()}
            className="mt-4 px-6 py-2 bg-perksu-purple text-white rounded-xl hover:bg-perksu-purple/90 transition shadow-sm"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            {dashboardData?.tenant_name || 'Organization Dashboard'}
          </h1>
          <p className="text-gray-500 mt-1 font-medium italic">Manage your points allocation and team performance</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
        >
          <HiOutlineArrowTrendingUp className={`w-4 h-4 text-perksu-purple ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Syncing...' : 'Sync Data'}
        </button>
      </div>

      {/* Main Content */}
      <div className="space-y-8">
        {/* Hero Section */}
        <HeroSection stats={dashboardData?.stats} currency={dashboardData?.currency} />

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Department Management Table (operational heart) */}
            <DepartmentManagementTable onRefresh={refetch} />

            {/* Delegation Status Table */}
            <DelegationStatusTable
              leads={dashboardData?.leads || []}
              currency={dashboardData?.currency}
              onRefresh={refetch}
            />

            {/* Recent Recognition Feed */}
            <RecentRecognitionFeed
              recognitions={dashboardData?.recent_recognitions || []}
              onRefresh={refetch}
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
            onExportReport={refetch}
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
            refetch()
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
            refetch()
          }}
          tenantName={dashboardData?.tenant_name}
        />
      )}
    </div>
  )
}
