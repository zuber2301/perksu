import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { rewardsAPI } from '../lib/api'
import toast from 'react-hot-toast'
import {
  HiOutlineGift,
  HiOutlineCheck,
  HiOutlineClock,
  HiOutlineShoppingBag,
  HiOutlineRefresh,
  HiOutlineSparkles,
  HiOutlineClipboardCopy,
  HiOutlineExternalLink,
} from 'react-icons/hi'
import RewardsCatalog from '../components/RewardsCatalog'
import RedemptionHistory from '../components/RedemptionHistory'

export default function Redeem() {
  const [activeTab, setActiveTab] = useState('catalog')
  const [completedOrder, setCompletedOrder] = useState(null)   // {redemption_id, item_name, points_spent, status}
  const queryClient = useQueryClient()

  // ── Wallet ──────────────────────────────────────────────────────
  const { data: wallet } = useQuery({
    queryKey: ['rewardsWallet'],
    queryFn: () => rewardsAPI.getWallet(),
  })

  // ── Catalog ─────────────────────────────────────────────────────
  const { data: catalogData, isLoading: loadingCatalog } = useQuery({
    queryKey: ['rewardsCatalog'],
    queryFn: () => rewardsAPI.getCatalog({ page_size: 100 }),
  })

  // ── My Orders ───────────────────────────────────────────────────
  const { data: ordersData, isLoading: loadingOrders } = useQuery({
    queryKey: ['myRewardOrders'],
    queryFn: () => rewardsAPI.getMyOrders({ page_size: 50 }),
    enabled: activeTab === 'history',
  })

  // ── Poll single order until COMPLETED / FAILED ──────────────────
  const { data: polledOrder } = useQuery({
    queryKey: ['rewardOrder', completedOrder?.redemption_id],
    queryFn: () => rewardsAPI.getOrder(completedOrder.redemption_id),
    enabled: !!(completedOrder?.redemption_id) && completedOrder?.status === 'PENDING',
    refetchInterval: (data) => {
      if (!data) return 3000
      if (data.status === 'COMPLETED' || data.status === 'FAILED') return false
      return 3000
    },
    onSuccess: (data) => {
      if (data.status === 'COMPLETED') {
        setCompletedOrder(prev => ({ ...prev, ...data }))
      }
    },
  })

  // ── Redeem mutation ──────────────────────────────────────────────
  const redeemMutation = useMutation({
    mutationFn: ({ item, points }) =>
      rewardsAPI.redeem({ catalog_item_id: item.id, points }),
    onSuccess: (response) => {
      queryClient.invalidateQueries(['rewardsWallet'])
      queryClient.invalidateQueries(['myWallet'])
      queryClient.invalidateQueries(['myRewardOrders'])
      setCompletedOrder(response)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Redemption failed. Please try again.')
    },
  })

  const handleRedeem = (item, points) => {
    redeemMutation.mutate({ item, points })
  }

  const copyCode = (code) => {
    navigator.clipboard.writeText(code).then(() => toast.success('Code copied!'))
  }

  const balance = wallet?.balance ?? 0

  return (
    <div className="space-y-6">

      {/* ── Wallet balance hero ──────────────────────────────────── */}
      <div className="bg-gradient-to-r from-perksu-purple to-perksu-blue rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/70 text-sm mb-1">Available Points</p>
            <p className="text-5xl font-bold tracking-tight">{balance.toLocaleString()}</p>
            <div className="flex gap-6 mt-3 text-sm text-white/70">
              <span>↑ {(wallet?.lifetime_earned ?? 0).toLocaleString()} earned</span>
              <span>↓ {(wallet?.lifetime_spent ?? 0).toLocaleString()} spent</span>
            </div>
          </div>
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
            <HiOutlineGift className="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            activeTab === 'catalog'
              ? 'bg-white text-perksu-purple shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <HiOutlineShoppingBag className="w-4 h-4" />
          Browse Rewards
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            activeTab === 'history'
              ? 'bg-white text-perksu-purple shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <HiOutlineClock className="w-4 h-4" />
          My Orders
          {ordersData?.total > 0 && (
            <span className="bg-perksu-purple text-white text-xs rounded-full px-1.5">{ordersData.total}</span>
          )}
        </button>
      </div>

      {/* ── Catalog tab ─────────────────────────────────────────── */}
      {activeTab === 'catalog' && (
        loadingCatalog ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <div className="h-28 bg-gray-200 animate-pulse" />
                <div className="p-4 space-y-2">
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-1/3" />
                  <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
                  <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
                  <div className="h-8 bg-gray-200 rounded-xl animate-pulse mt-3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <RewardsCatalog
            items={catalogData?.items ?? []}
            categories={catalogData?.categories ?? []}
            walletBalance={balance}
            onRedeem={handleRedeem}
            isRedeeming={redeemMutation.isPending}
          />
        )
      )}

      {/* ── Orders tab ──────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <RedemptionHistory
          orders={ordersData?.items ?? []}
          isLoading={loadingOrders}
        />
      )}

      {/* ── Success / Processing modal ───────────────────────────── */}
      {completedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">

            {/* Status header */}
            <div className={`p-6 text-center ${
              completedOrder.status === 'COMPLETED' ? 'bg-green-50' :
              completedOrder.status === 'FAILED'    ? 'bg-red-50'   : 'bg-amber-50'
            }`}>
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3 ${
                completedOrder.status === 'COMPLETED' ? 'bg-green-100' :
                completedOrder.status === 'FAILED'    ? 'bg-red-100'   : 'bg-amber-100'
              }`}>
                {completedOrder.status === 'COMPLETED' ? (
                  <HiOutlineCheck className="w-7 h-7 text-green-600" />
                ) : completedOrder.status === 'FAILED' ? (
                  <span className="text-xl">✕</span>
                ) : (
                  <HiOutlineRefresh className="w-7 h-7 text-amber-600 animate-spin" />
                )}
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                {completedOrder.status === 'COMPLETED' ? 'Voucher Ready! 🎉'  :
                 completedOrder.status === 'FAILED'    ? 'Redemption Failed'   :
                                                         'Processing…'}
              </h2>
              <p className="text-sm text-gray-500 mt-1">{completedOrder.item_name}</p>
            </div>

            <div className="p-6 space-y-4">
              {/* Voucher code */}
              {completedOrder.voucher_code && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Your Voucher Code</p>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-2xl font-mono font-bold text-gray-900 tracking-widest">
                      {completedOrder.voucher_code}
                    </p>
                    <button
                      onClick={() => copyCode(completedOrder.voucher_code)}
                      className="text-gray-400 hover:text-perksu-purple transition-colors"
                      title="Copy code"
                    >
                      <HiOutlineClipboardCopy className="w-5 h-5" />
                    </button>
                  </div>
                  {completedOrder.redeem_url && (
                    <a
                      href={completedOrder.redeem_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-perksu-purple mt-2 hover:underline"
                    >
                      <HiOutlineExternalLink className="w-3 h-3" />
                      Redeem online
                    </a>
                  )}
                </div>
              )}

              {/* PENDING state */}
              {completedOrder.status === 'PENDING' && (
                <div className="text-center space-y-2">
                  <p className="text-sm text-gray-600">
                    {completedOrder.message || 'Your voucher is being generated. This usually takes a few seconds.'}
                  </p>
                  <p className="text-xs text-gray-400">
                    Check <strong>My Orders</strong> if you close this window.
                  </p>
                </div>
              )}

              {/* FAILED state */}
              {completedOrder.status === 'FAILED' && (
                <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
                  {completedOrder.failed_reason || 'Something went wrong. Your points have been refunded.'}
                </div>
              )}

              {/* Points spent summary */}
              <div className="flex justify-between text-sm border-t pt-3">
                <span className="text-gray-500">Points spent</span>
                <span className="font-semibold flex items-center gap-1 text-perksu-purple">
                  <HiOutlineSparkles className="w-4 h-4" />
                  {completedOrder.points_spent}
                </span>
              </div>
              {completedOrder.wallet_balance_after !== undefined && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Remaining balance</span>
                  <span className="font-bold text-gray-900">{completedOrder.wallet_balance_after} pts</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => {
                    setCompletedOrder(null)
                    setActiveTab('history')
                  }}
                  className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  View My Orders
                </button>
                <button
                  onClick={() => setCompletedOrder(null)}
                  className="flex-1 py-2.5 rounded-xl bg-perksu-purple text-white text-sm font-medium hover:bg-perksu-purple/90 transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
