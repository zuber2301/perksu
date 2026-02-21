/**
 * Merchandise Catalog Component
 * Displays physical merchandise items with delivery options
 */

import React, { useState, useEffect } from 'react';
import { Truck, Star, Tag } from 'lucide-react';
import api from '../lib/api';

export default function MerchandiseCatalog({ searchQuery, onRedeem, userBalance }) {
  const [merchandise, setMerchandise] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const categories = ['apparel', 'tech', 'accessories', 'wellness', 'home'];

  useEffect(() => {
    fetchMerchandise();
  }, [selectedCategory]);

  const fetchMerchandise = async () => {
    try {
      const params = { status: 'active' };
      if (selectedCategory) {
        params.category = selectedCategory;
      }
      const response = await api.get('/api/redemption/merchandise', { params });
      setMerchandise(response);
      setError(null);
    } catch (err) {
      setError('Failed to load merchandise');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredMerchandise = merchandise.filter(m =>
    m.name.toLowerCase().includes(searchQuery.toLowerCase())
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
      {/* Category Filter */}
      <div className="mb-8 flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            !selectedCategory
              ? 'bg-blue-500 text-white'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          All Items
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors capitalize ${
              selectedCategory === cat
                ? 'bg-blue-500 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Merchandise Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMerchandise.length > 0 ? (
          filteredMerchandise.map(item => (
            <MerchandiseCard
              key={item.id}
              item={item}
              userBalance={userBalance}
              onRedeem={onRedeem}
            />
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <p className="text-slate-500">No merchandise found</p>
          </div>
        )}
      </div>
    </div>
  );
}

function MerchandiseCard({ item, userBalance, onRedeem }) {
  const canAfford = userBalance >= item.point_cost;
  const stockStatus = item.stock_quantity > 10 ? 'In Stock' : `Only ${item.stock_quantity} left`;
  const lowStock = item.stock_quantity < 10;

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all border border-slate-200 overflow-hidden">
      {/* Image Container */}
      <div className="h-48 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center relative overflow-hidden">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            className="w-full h-full object-cover hover:scale-105 transition-transform"
          />
        ) : (
          <div className="text-5xl">{getCategoryEmoji(item.category)}</div>
        )}

        {/* Stock Badge */}
        <div className={`absolute top-4 right-4 rounded-lg px-3 py-1 text-xs font-bold ${
          lowStock
            ? 'bg-red-100 text-red-600'
            : 'bg-green-100 text-green-600'
        }`}>
          {stockStatus}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-bold text-slate-900 flex-1">
            {item.name}
          </h3>
          <div className="flex gap-1">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${
                  i < 4 ? 'fill-yellow-400 text-yellow-400' : 'text-slate-300'
                }`}
              />
            ))}
          </div>
        </div>

        {item.description && (
          <p className="text-sm text-slate-600 mb-3 line-clamp-2">
            {item.description}
          </p>
        )}

        {/* Category & Delivery */}
        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Tag className="h-4 w-4 text-blue-500" />
            <span className="capitalize">{item.category}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Truck className="h-4 w-4 text-green-500" />
            <span>Free shipping pan-India</span>
          </div>
        </div>

        {/* Point Cost */}
        <div className="mb-4 p-3 bg-purple-50 rounded-lg">
          <p className="text-xs text-slate-600 mb-1">Points needed</p>
          <p className="text-2xl font-bold text-purple-600">{item.point_cost}</p>
        </div>

        {/* Markup Info */}
        {item.markup_percentage > 0 && (
          <div className="mb-4 text-xs text-slate-500">
            Convenience fee: {item.markup_percentage}%
          </div>
        )}

        {/* Redeem Button */}
        <button
          onClick={() => onRedeem(item)}
          disabled={!canAfford || item.stock_quantity === 0}
          className={`w-full py-2 rounded-lg font-medium transition-all ${
            canAfford && item.stock_quantity > 0
              ? 'bg-purple-500 hover:bg-purple-600 text-white'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          {item.stock_quantity === 0
            ? 'Out of Stock'
            : canAfford
            ? 'Order Now'
            : 'Insufficient Points'}
        </button>

        {!canAfford && (
          <p className="text-xs text-slate-500 mt-2 text-center">
            Need {item.point_cost - userBalance} more points
          </p>
        )}
      </div>
    </div>
  );
}

function getCategoryEmoji(category) {
  const emojiMap = {
    'apparel': '👕',
    'tech': '💻',
    'accessories': '⌚',
    'wellness': '🧘',
    'home': '🏠',
    'other': '🎁'
  };
  return emojiMap[category] || '📦';
}
