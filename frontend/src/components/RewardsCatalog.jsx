import { useState } from 'react'
import {
  HiOutlineGift,
  HiOutlineSearch,
  HiOutlineSparkles,
  HiOutlineX,
  HiOutlineCheck,
} from 'react-icons/hi'
import { formatCurrency, formatNumber } from '../lib/currency'

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

  const filtered = items.filter(item => {
    const matchCat  = activeCategory === 'All' || item.category === activeCategory
    const matchSearch = !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.brand || '').toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const openModal = (item) => {
    setSelectedItem(item)
    if (item.source_type === 'CUSTOM') {
      setSelectedPoints(item.points_cost)
    } else {
      setSelectedPoints(item.denominations?.[0] || item.min_points)
    }
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

  const canAfford = (item) => {
    const cost = item.source_type === 'CUSTOM' ? item.points_cost : item.min_points
    return walletBalance >= cost
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="relative">
        <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search rewards, brands…"
          className="input-field w-full pl-10 h-12 rounded-xl border-gray-200 focus:border-perksu-purple focus:ring-perksu-purple"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <HiOutlineX className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Categories */}
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

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <HiOutlineGift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No rewards found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filtered.map(item => {
            const affordable = canAfford(item)
            const colorClass = CATEGORY_COLORS[item.category] || 'from-gray-300 to-gray-400'
            const minP = item.source_type === 'CUSTOM' ? item.points_cost : item.min_points
            const maxP = item.source_type === 'CUSTOM' ? item.points_cost : item.max_points

            return (
              <div
                key={item.id}
                className={`bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col ${
                  !affordable ? 'opacity-75' : 'cursor-pointer'
                }`}
              >
                <div className={`h-28 bg-gradient-to-br ${colorClass} flex items-center justify-center relative`}>
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="h-14 max-w-[80%] object-contain drop-shadow" />
                  ) : (
                    <span className="text-5xl">{CATEGORY_ICONS[item.category] || '🎁'}</span>
                  )}
                  {item.source_type === 'CUSTOM' && (
                    <span className="absolute top-2 left-2 bg-white/20 backdrop-blur-sm text-white text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                      Exclusive
                    </span>
                  )}
                  {item.fulfillment_type === 'INVENTORY_ITEM' && item.inventory_count !== null && (
                    <span className={`absolute top-2 right-2 text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      item.inventory_count > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {item.inventory_count > 0 ? `${item.inventory_count} left` : 'Out of stock'}
                    </span>
                  )}
                </div>

                <div className="p-4 flex flex-col flex-1 gap-2">
                  <div>
                    {item.brand && <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{item.brand}</p>}
                    <h3 className="font-bold text-gray-900 text-sm leading-tight line-clamp-1">{item.name}</h3>
                  </div>

                  <div className="flex items-center gap-1 mt-auto">
                    <HiOutlineSparkles className="w-4 h-4 text-perksu-purple flex-shrink-0" />
                    <span className="text-sm font-bold text-perksu-purple">
                      {minP === maxP ? formatCurrency(minP) : `${formatCurrency(minP)} - ${formatCurrency(maxP)}`}
                    </span>
                  </div>

                  <button
                    onClick={() => affordable && openModal(item)}
                    disabled={!affordable || isRedeeming || (item.fulfillment_type === 'INVENTORY_ITEM' && item.inventory_count === 0)}
                    className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all mt-1 uppercase tracking-wider ${
                      affordable && (item.inventory_count === null || item.inventory_count > 0)
                        ? 'bg-perksu-purple text-white hover:shadow-lg hover:shadow-perksu-purple/20'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {!affordable ? `Need ${formatCurrency(minP - walletBalance)} more` : 
                     (item.inventory_count === 0 ? 'Out of stock' : 'Redeem')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={closeModal}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className={`p-8 text-white bg-gradient-to-r ${CATEGORY_COLORS[selectedItem.category] || 'from-perksu-purple to-indigo-600'}`}>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-black leading-tight mb-1">{selectedItem.name}</h3>
                  <p className="text-white/80 text-xs font-bold uppercase tracking-widest">{selectedItem.brand || selectedItem.category}</p>
                </div>
                <button onClick={closeModal} className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors">
                  <HiOutlineX className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-8 space-y-6">
              {selectedItem.description && <p className="text-gray-600 text-sm leading-relaxed">{selectedItem.description}</p>}

              {selectedItem.source_type === 'MASTER' ? (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Select Amount</p>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedItem.denominations?.map(pts => {
                      const canPick = walletBalance >= pts
                      return (
                        <button
                          key={pts}
                          onClick={() => canPick && setSelectedPoints(pts)}
                          disabled={!canPick}
                          className={`py-3 rounded-xl text-xs font-bold border-2 transition-all ${
                            selectedPoints === pts
                              ? 'border-perksu-purple bg-perksu-purple text-white shadow-md'
                              : canPick
                              ? 'border-gray-100 bg-gray-50 text-gray-600 hover:border-perksu-purple/30'
                              : 'border-transparent bg-gray-50 text-gray-300 opacity-50 cursor-not-allowed'
                          }`}
                        >
                          {formatCurrency(pts)}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="bg-perksu-purple/5 border border-perksu-purple/10 rounded-2xl p-4 flex items-center justify-between">
                  <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Fixed Points Cost</span>
                  <div className="flex items-center gap-1.5 text-perksu-purple">
                    <HiOutlineSparkles className="w-5 h-5" />
                    <span className="text-xl font-black">{formatCurrency(selectedItem.points_cost)}</span>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                  <span className="text-gray-400">Your Balance</span>
                  <span className="text-gray-900">{formatCurrency(walletBalance)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold uppercase tracking-wider">
                   <span className="text-gray-400">Order Total</span>
                   <span className="text-red-500">-{formatCurrency(selectedPoints || 0)}</span>
                </div>
                <div className="h-px bg-gray-100" />
                <div className="flex justify-between">
                   <span className="text-sm font-black text-gray-900 uppercase">Balance After</span>
                   <span className={`text-sm font-black ${walletBalance - (selectedPoints || 0) < 0 ? 'text-red-600' : 'text-perksu-purple'}`}>
                     {formatCurrency(walletBalance - (selectedPoints || 0))}
                   </span>
                </div>
              </div>

              <button
                onClick={confirmRedeem}
                disabled={!selectedPoints || walletBalance < selectedPoints || isRedeeming}
                className="w-full py-4 rounded-2xl bg-perksu-purple text-white text-sm font-black uppercase tracking-widest hover:bg-perksu-purple/90 shadow-lg shadow-perksu-purple/25 disabled:opacity-50 disabled:shadow-none transition-all flex items-center justify-center gap-2"
              >
                {isRedeeming ? (
                  <span className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                ) : (
                  <><HiOutlineCheck className="w-5 h-5" /> Confirm Redemption</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
