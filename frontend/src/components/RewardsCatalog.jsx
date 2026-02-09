import { useState } from 'react'
import { HiOutlineGift, HiOutlineSearch, HiOutlineFilter, HiOutlineSparkles } from 'react-icons/hi'
import { formatCurrency } from '../lib/currency'

export default function RewardsCatalog({ vouchers, onRedeem, isRedeeming, walletBalance = 0 }) {
  const [search, setSearch] = useState('')
  const [selectedBrand, setSelectedBrand] = useState('')
  const [sortBy, setSortBy] = useState('points_asc')
  const [imageErrors, setImageErrors] = useState({})

  const handleImageError = (id) => {
    setImageErrors(prev => ({ ...prev, [id]: true }))
  }

  const normalizedVouchers = (vouchers || []).map(v => ({
    ...v,
    id: v.id || v.utid,
    name: v.name || v.rewardName,
    brand_name: v.brand_name || v.brandName,
    brand_logo: v.brand_logo || v.imageUrl,
    points_cost: v.points_cost || v.pointsRequired,
    points_required: v.points_required || v.pointsRequired || v.points_cost,
    denomination: v.denomination || v.value || v.face_value
  }))

  const brands = [...new Set(normalizedVouchers.map(v => v.brand_name).filter(Boolean))]

  const filteredVouchers = normalizedVouchers.filter(v => {
    const matchesSearch = (v.name?.toLowerCase() || '').includes(search.toLowerCase()) ||
                          (v.brand_name?.toLowerCase() || '').includes(search.toLowerCase())
    const matchesBrand = !selectedBrand || v.brand_name === selectedBrand
    return matchesSearch && matchesBrand
  }).sort((a, b) => {
    switch (sortBy) {
      case 'points_asc':
        return (a.points_cost || 0) - (b.points_cost || 0)
      case 'points_desc':
        return (b.points_cost || 0) - (a.points_cost || 0)
      case 'name':
        return (a.name || '').localeCompare(b.name || '')
      default:
        return 0
    }
  })

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rewards..."
            className="input-field w-full pl-10"
          />
        </div>

        <div className="flex gap-2">
          <div className="relative">
            <HiOutlineFilter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="input-field pl-9"
            >
              <option value="">All Brands</option>
              {brands.map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="input-field"
          >
            <option key="points_asc" value="points_asc">Points: Low to High</option>
            <option key="points_desc" value="points_desc">Points: High to Low</option>
            <option key="name" value="name">Name</option>
          </select>
        </div>
      </div>

      {/* Rewards Grid */}
      {filteredVouchers.length === 0 ? (
        <div className="text-center py-12">
          <HiOutlineGift className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No rewards found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVouchers.map((voucher, index) => (
            <div key={voucher.id || `voucher-${index}`} className="card hover:shadow-lg transition">
              {/* Brand Logo / Image */}
              <div className="h-32 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center mb-4 overflow-hidden">
                {voucher.brand_logo && !imageErrors[voucher.id] ? (
                  <img 
                    src={voucher.brand_logo} 
                    alt={voucher.brand_name}
                    className="h-16 object-contain"
                    onError={() => handleImageError(voucher.id)}
                  />
                ) : (
                  <div className="text-4xl font-bold text-gray-300 uppercase">
                    {voucher.brand_name?.charAt(0)}
                  </div>
                )}
              </div>

              {/* Voucher Info */}
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-gray-500">{voucher.brand_name}</p>
                    <h3 className="font-semibold text-gray-900">{voucher.name}</h3>
                  </div>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-perksu-purple/10 text-perksu-purple">
                    {formatCurrency(voucher.denomination || voucher.face_value)}
                  </span>
                </div>

                {voucher.description && (
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {voucher.description}
                  </p>
                )}

                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-perksu-purple flex items-center gap-1">
                      <HiOutlineSparkles className="w-5 h-5" />
                      {voucher.points_cost}
                    </span>
                    <span className="text-sm text-gray-500">points</span>
                  </div>

                  <button
                    onClick={() => onRedeem(voucher)}
                    disabled={isRedeeming || walletBalance < voucher.points_cost}
                    className={`btn-primary text-sm ${
                      walletBalance < voucher.points_cost 
                        ? 'opacity-50 cursor-not-allowed' 
                        : ''
                    }`}
                  >
                    {walletBalance < voucher.points_cost ? 'Not Enough Points' : 'Redeem'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
