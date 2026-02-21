import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { redemptionAPI, walletsAPI } from '../lib/api'
import toast from 'react-hot-toast'
import { HiOutlineGift, HiOutlineCheck, HiOutlineClock, HiOutlineShoppingBag } from 'react-icons/hi'
import RewardsCatalog from '../components/RewardsCatalog'
import RedemptionHistory from '../components/RedemptionHistory'

export default function Redeem() {
  const [activeTab, setActiveTab] = useState('catalog')
  const [selectedVoucher, setSelectedVoucher] = useState(null)
  const queryClient = useQueryClient()

  const { data: wallet } = useQuery({
    queryKey: ['myWallet'],
    queryFn: () => walletsAPI.getMyWallet(),
  })

  const { data: vouchers, isLoading: loadingVouchers } = useQuery({
    queryKey: ['vouchers'],
    queryFn: () => redemptionAPI.getVouchers(),
  })

  const { data: redemptions } = useQuery({
    queryKey: ['myRedemptions'],
    queryFn: () => redemptionAPI.getMyRedemptions(),
  })

  const redeemMutation = useMutation({
    mutationFn: (data) => redemptionAPI.create(data),
    onSuccess: (response) => {
      toast.success('Redemption successful! 🎉')
      queryClient.invalidateQueries(['myWallet'])
      queryClient.invalidateQueries(['myRedemptions'])
      setSelectedVoucher(response)
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Redemption failed')
    },
  })

  const handleRedeem = (voucher) => {
    if (parseFloat(wallet?.balance) < parseFloat(voucher.points_required)) {
      toast.error('Insufficient points balance')
      return
    }
    
    if (confirm(`Redeem ${voucher.name} for ${voucher.points_required} points?`)) {
      redeemMutation.mutate({ voucher_id: voucher.id })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with balance */}
      <div className="bg-gradient-to-r from-perksu-purple to-perksu-blue rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/80 text-sm">Available Points</p>
            <p className="text-4xl font-bold">{wallet?.balance || 0}</p>
          </div>
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
            <HiOutlineGift className="w-8 h-8" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`pb-4 px-2 font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'catalog'
              ? 'text-perksu-purple border-b-2 border-perksu-purple'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <HiOutlineShoppingBag className="w-5 h-5" />
          Rewards Catalog
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-4 px-2 font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'history'
              ? 'text-perksu-purple border-b-2 border-perksu-purple'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <HiOutlineClock className="w-5 h-5" />
          My Redemptions
        </button>
      </div>

      {activeTab === 'catalog' ? (
        <>
          {/* Catalog */}
          <RewardsCatalog
            vouchers={vouchers || []}
            walletBalance={wallet?.balance || 0}
            onRedeem={handleRedeem}
            isRedeeming={redeemMutation.isPending}
          />
        </>
      ) : (
        <RedemptionHistory redemptions={redemptions || []} />
      )}

      {/* Success modal */}
      {selectedVoucher && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <HiOutlineCheck className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Redemption Successful!</h2>
            <p className="text-gray-500 mb-6">{selectedVoucher.voucher_name}</p>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-500 mb-1">Your Voucher Code</p>
              <p className="text-2xl font-mono font-bold text-gray-900">{selectedVoucher.voucher_code}</p>
              {selectedVoucher.voucher_pin && (
                <>
                  <p className="text-sm text-gray-500 mt-3 mb-1">PIN</p>
                  <p className="text-xl font-mono font-bold text-gray-900">{selectedVoucher.voucher_pin}</p>
                </>
              )}
            </div>

            <button
              onClick={() => setSelectedVoucher(null)}
              className="btn-primary w-full"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
