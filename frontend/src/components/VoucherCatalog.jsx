/**
 * Voucher Catalog Component
 * Displays digital gift vouchers from various vendors
 */

import React, { useState, useEffect } from 'react';
import { Zap, Shield, Clock } from 'lucide-react';
import api from '../lib/api';

export default function VoucherCatalog({ searchQuery, onRedeem, userBalance }) {
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchVouchers();
  }, []);

  const fetchVouchers = async () => {
    try {
      const response = await api.get('/api/redemption/vouchers', {
        params: { status: 'active' }
      });
      setVouchers(response);
      setError(null);
    } catch (err) {
      setError('Failed to load vouchers');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredVouchers = vouchers.filter(v =>
    v.vendor_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-80 bg-slate-200 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Category Badges */}
      <div className="mb-8 flex flex-wrap gap-2">
        {['Amazon', 'Food', 'Movies', 'Travel'].map(cat => (
          <button
            key={cat}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-full text-sm font-medium text-slate-700 transition-colors"
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Vouchers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVouchers.length > 0 ? (
          filteredVouchers.map(voucher => (
            <VoucherCard
              key={voucher.id}
              voucher={voucher}
              userBalance={userBalance}
              onRedeem={onRedeem}
            />
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <p className="text-slate-500">No vouchers found</p>
          </div>
        )}
      </div>
    </div>
  );
}

function VoucherCard({ voucher, userBalance, onRedeem }) {
  const canAfford = userBalance >= voucher.point_cost;

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all border border-slate-200 overflow-hidden">
      {/* Image Container */}
      <div className="h-48 bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center relative">
        {voucher.image_url ? (
          <img
            src={voucher.image_url}
            alt={voucher.vendor_name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="text-4xl">{getVendorEmoji(voucher.vendor_name)}</div>
        )}
        
        {/* Status Badge */}
        <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-lg px-3 py-1">
          <span className="text-xs font-bold text-green-600">IN STOCK</span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-lg font-bold text-slate-900 mb-1">
          {voucher.vendor_name}
        </h3>
        <p className="text-sm text-slate-600 mb-4">
          ₹{voucher.voucher_denomination}
        </p>

        {/* Features */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Zap className="h-4 w-4 text-yellow-500" />
            <span>Instant delivery</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Shield className="h-4 w-4 text-blue-500" />
            <span>Verified vendor</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Clock className="h-4 w-4 text-slate-400" />
            <span>365 days valid</span>
          </div>
        </div>

        {/* Point Cost */}
        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-slate-600 mb-1">Points needed</p>
          <p className="text-2xl font-bold text-blue-600">{voucher.point_cost}</p>
        </div>

        {/* Markup Info */}
        {voucher.markup_percentage > 0 && (
          <div className="mb-4 text-xs text-slate-500">
            Convenience fee: {voucher.markup_percentage}%
          </div>
        )}

        {/* Redeem Button */}
        <button
          onClick={() => onRedeem(voucher)}
          disabled={!canAfford}
          className={`w-full py-2 rounded-lg font-medium transition-all ${
            canAfford
              ? 'bg-blue-500 hover:bg-blue-600 text-white'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          {canAfford ? 'Redeem Now' : 'Insufficient Points'}
        </button>

        {!canAfford && (
          <p className="text-xs text-slate-500 mt-2 text-center">
            Need {voucher.point_cost - userBalance} more points
          </p>
        )}
      </div>
    </div>
  );
}

function getVendorEmoji(vendor) {
  const emojiMap = {
    'Amazon': '🛍️',
    'Swiggy': '🍔',
    'Zomato': '🍕',
    'Flipkart': '📱',
    'BookMyShow': '🎬'
  };
  return emojiMap[vendor] || '💳';
}
