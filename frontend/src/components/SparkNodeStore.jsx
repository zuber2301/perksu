/**
 * SparkNode Store - Main Redemption Interface
 * Features:
 * - Digital voucher catalog with instant delivery
 * - Physical merchandise with shipping
 * - Smart filtering and search
 * - OTP-based security
 */

import React, { useState, useEffect } from 'react';
import { Gift, Search, Filter, ShoppingCart, Clock } from 'lucide-react';
import api from '../lib/api';
import VoucherCatalog from './VoucherCatalog';
import MerchandiseCatalog from './MerchandiseCatalog';
import RedemptionFlow from './RedemptionFlow';

export default function SparkNodeStore() {
  const [activeTab, setActiveTab] = useState('vouchers');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [userWallet, setUserWallet] = useState(null);
  const [showRedemptionModal, setShowRedemptionModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserWallet();
  }, []);

  const fetchUserWallet = async () => {
    try {
      const response = await api.get('/api/wallet/balance');
      setUserWallet(response);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch wallet:', error);
      setLoading(false);
    }
  };

  const handleRedeemClick = (item) => {
    setSelectedItem(item);
    setShowRedemptionModal(true);
  };

  const handleRedemptionComplete = () => {
    setShowRedemptionModal(false);
    setSelectedItem(null);
    fetchUserWallet();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
                <Gift className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">SparkNode Store</h1>
                <p className="text-sm text-slate-500">Redeem your points for amazing rewards</p>
              </div>
            </div>
            
            {/* Wallet Balance */}
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-slate-600">Available Points</p>
              <p className="text-3xl font-bold text-green-600">
                {userWallet?.balance || 0}
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('vouchers')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'vouchers'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              💳 Digital Vouchers
            </button>
            <button
              onClick={() => setActiveTab('merchandise')}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'merchandise'
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              📦 Merchandise
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="mb-8 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'vouchers' ? (
          <VoucherCatalog
            searchQuery={searchQuery}
            onRedeem={handleRedeemClick}
            userBalance={userWallet?.balance}
          />
        ) : (
          <MerchandiseCatalog
            searchQuery={searchQuery}
            onRedeem={handleRedeemClick}
            userBalance={userWallet?.balance}
          />
        )}
      </div>

      {/* Redemption Modal */}
      {showRedemptionModal && selectedItem && (
        <RedemptionFlow
          item={selectedItem}
          onClose={() => setShowRedemptionModal(false)}
          onComplete={handleRedemptionComplete}
        />
      )}
    </div>
  );
}
