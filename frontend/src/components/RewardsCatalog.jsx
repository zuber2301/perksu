import { useState } from 'react'
import {
  HiOutlineGift,
  HiOutlineSearch,
  HiOutlineShoppingBag,
  HiOutlineSparkles,
  HiOutlineX,
  HiOutlineCheck,
} from 'react-icons/hi'

const CATEGORY_ICONS = {
  'Gift Cards':   '🎁',
  'Food & Dining':'🍔',
  'Shopping':     '🛍️',
  'Merchandise':  '👕',
  'Experiences':  '🎬',
  'Social Good':  '❤️',
}

const CATEGORY_COLORS = {
  'Gift Cards':   'from-amber-400 to-orange-500',
  'Food & Dining':'from-red-400 to-pink-500',
  'Shopping':     'from-blue-400 to-indigo-500',
  'Merchandise':  'from-purple-400 to-violet-500',
  'Experiences':  'from-emerald-400 to-teal-500',
  'Social Good':  'from-rose-400 to-pink-500',
}

export default function RewardsCatalog({ items = [], categories = [], walletBalance = 0, onRedeem, isRedeeming }) {
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState(null)
  const [selectedPoints, setSelectedPoints] = useState(null)

  // ── Filter ──────────────────────────────────────────────────────
  const filtered = items.filter(item => {
    const matchCat  = activeCategory === 'All' || item.category === activeCategory
    const matchSearch = !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.brand || '').toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  // ── Denomination picker modal ───────────────────────────────────
  const openModal = (item) => {
    setSelectedItem(item)
    setSelectedPoints(item.denominations?.[0] ?? item.min_denomination_points)
  }

  const closeModal = () => {
    setSelectedItem(null)
    setSelectedPoints(null)
  }

  const confirmRedeem = () => {
    if (!selectedItem || !selectedPoints) return
    onRedeem(selectedItem, selectedPoints)
    closeModal()
  }

  const canAfford = (item) => walletBalance >= item.min_denomination_points

  return (
    <div className="space-y-6">

      {/* ── Search ──────────────────────────────────────────────── */}
      <div className="relative">
        <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search rewards, brands…"
          className="input-field w-full pl-10"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <HiOutlineX className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* ── Category tabs ───────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {['All', ...categories].map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeCategory === cat
                ? 'bg-perksu-purple text-white shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat !== 'All' && <span className="mr-1">{CATEGORY_ICONS[cat] || '🎁'}</span>}
            {cat}
          </button>
        ))}
      </div>

      {/* ── Item grid ───────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <HiOutlineGift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No rewards found</p>
          <p className="text-sm text-gray-400">Try a different category or search term</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(item => {
            const affordable  = canAfford(item)
            const colorClass  = CATEGORY_COLORS[item.category] || 'from-gray-300 to-gray-400'
            const minDenom    = item.denominations?.[0] ?? item.min_denomination_points
            const maxDenom    = item.denominations?.[item.denominations.length - 1] ?? item.max_denomination_points

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col ${
                  !affordable ? 'opacity-60' : 'cursor-pointer'
                }`}
              >
                {/* Brand hero */}
                <div className={`h-28 bg-gradient-to-br ${colorClass} flex items-center justify-center relative`}>
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.brand}
                      className="h-14 max-w-[80%] object-contain drop-shadow"
                      onError={e => { e.target.style.display = 'none' }}
                    />
                  ) : (
                    <span className="text-5xl">{CATEGORY_ICONS[item.category] || '🎁'}</span>
                  )}
                  {item.fulfillment_type === 'INVENTORY_ITEM' && item.inventory_count !== null && (
                    <span className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full font-medium ${
                      item.inventory_count > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {item.inventory_count > 0 ? `${item.inventory_count} left` : 'Out of stock'}
                    </span>
                  )}
                </div>

                {/* Details */}
                <div className="p-4 flex flex-col flex-1 gap-2">
                  <div>
                    {item.brand && <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{item.brand}</p>}
                    <h3 className="font-semibold text-gray-900 text-sm leading-tight">{item.name}</h3>
                  </div>

                  {item.description && (
                    <p className="text-xs text-gray-500 line-clamp-2">{item.description}</p>
                  )}

                  {/* Points range */}
                  <div className="flex items-center gap-1 mt-auto">
                    <HiOutlineSparkles className="w-4 h-4 text-perksu-purple flex-shrink-0" />
                    <span className="text-sm font-semibold text-perksu-purple">
                      {minDenom === maxDenom ? minDenom : `${minDenom} – ${maxDenom}`}
                    </span>
                    <span className="text-xs text-gray-400">pts</span>
                  </div>

                  {/* CTA */}
                  <button
                    onClick={() => affordable && openModal(item)}
                    disabled={!affordable || isRedeeming || (item.inventory_count !== null && item.inventory_count <= 0)}
                    className={`w-full py-2 rounded-xl text-sm font-medium transition-all mt-1 ${
                      affordable && (item.inventory_count === null || item.inventory_count > 0)
                        ? 'bg-perksu-purple text-white hover:bg-perksu-purple/90'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {!affordable
                      ? `Need ${minDenom - walletBalance} more pts`
                      : item.inventory_count === 0
                      ? 'Out of stock'
                      : 'Redeem'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Denomination picker modal ────────────────────────────── */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div
            className="bg-white rounded-2xl w-full max-w-md shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className={`rounded-t-2xl bg-gradient-to-r ${CATEGORY_COLORS[selectedItem.category] || 'from-perksu-purple to-perksu-blue'} p-6 text-white`}>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {selectedItem.image_url ? (
                    <img src={selectedItem.image_url} alt={selectedItem.brand} className="h-10 object-contain drop-shadow" onError={e => { e.target.style.display = 'none' }} />
                  ) : (
                    <span className="text-3xl">{CATEGORY_ICONS[selectedItem.category] || '🎁'}</span>
                  )}
                  <div>
                    {selectedItem.brand && <p className="text-white/80 text-xs uppercase tracking-wide">{selectedItem.brand}</p>}
                    <h3 className="font-bold text-lg leading-tight">{selectedItem.name}</h3>
                  </div>
                </div>
                <button onClick={closeModal} className="text-white/70 hover:text-white ml-2 flex-shrink-0">
                  <HiOutlineX className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {selectedItem.description && (
                <p className="text-sm text-gray-600">{selectedItem.description}</p>
              )}

              {/* Denomination chips */}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">Select denomination</p>
                <div className="flex flex-wrap gap-2">
                  {selectedItem.denominations?.map(pts => {
                    const canPick = walletBalance >= pts
                    return (
                      <button
                        key={pts}
                        onClick={() => canPick && setSelectedPoints(pts)}
                        disabled={!canPick}
                        className={`px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all ${
                          selectedPoints === pts
                            ? 'border-perksu-purple bg-perksu-purple text-white'
                            : canPick
                            ? 'border-gray-200 text-gray-700 hover:border-perksu-purple/50'
                            : 'border-gray-100 text-gray-300 cursor-not-allowed'
                        }`}
                      >
                        {pts} pts
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Balance preview */}
              <div className="bg-gray-50 rounded-xl p-4 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Current balance</span>
                  <span className="font-semibold text-gray-800">{walletBalance} pts</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Redeeming</span>
                  <span className="font-semibold text-red-500">-{selectedPoints || 0} pts</span>
                </div>
                <div className="border-t pt-1 flex justify-between text-sm">
                  <span className="text-gray-700 font-medium">Balance after</span>
                  <span className={`font-bold ${walletBalance - (selectedPoints || 0) < 0 ? 'text-red-600' : 'text-gray-900'}`}>
                    {walletBalance - (selectedPoints || 0)} pts
                  </span>
                </div>
              </div>

              {/* Delivery address notice for merch */}
              {selectedItem.fulfillment_type === 'INVENTORY_ITEM' && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-3">
                  📦 This is a physical item. Your registered address will be used for delivery. Please ensure it is up to date in your profile.
                </p>
              )}

              {selectedItem.fulfillment_type === 'MANUAL' && (
                <p className="text-xs text-blue-600 bg-blue-50 rounded-lg p-3">
                  ❤️ Your donation will be processed by our team within 3 business days.
                </p>
              )}

              {/* CTA */}
              <button
                onClick={confirmRedeem}
                disabled={!selectedPoints || walletBalance < selectedPoints || isRedeeming}
                className="w-full py-3 rounded-xl bg-perksu-purple text-white font-semibold hover:bg-perksu-purple/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
              >
                {isRedeeming ? (
                  <><span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />Processing…</>
                ) : (
                  <><HiOutlineCheck className="w-5 h-5" />Confirm – {selectedPoints} pts</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
