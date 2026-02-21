import { format } from 'date-fns'
import {
  HiOutlineGift,
  HiOutlineCheck,
  HiOutlineClock,
  HiOutlineX,
  HiOutlineRefresh,
  HiOutlineSparkles,
  HiOutlineClipboardCopy,
  HiOutlineExternalLink,
  HiOutlineTruck,
} from 'react-icons/hi'
import toast from 'react-hot-toast'
import { formatCurrency } from '../lib/currency'

const STATUS_CONFIG = {
  PENDING:      { label: 'Pending',      color: 'bg-amber-100 text-amber-800',   icon: HiOutlineClock    },
  OTP_VERIFIED: { label: 'Confirmed',    color: 'bg-blue-100 text-blue-800',     icon: HiOutlineCheck    },
  PROCESSING:   { label: 'Processing',   color: 'bg-indigo-100 text-indigo-800', icon: HiOutlineRefresh  },
  COMPLETED:    { label: 'Completed',    color: 'bg-green-100 text-green-800',   icon: HiOutlineCheck    },
  SHIPPED:      { label: 'Shipped',      color: 'bg-teal-100 text-teal-800',     icon: HiOutlineTruck    },
  FAILED:       { label: 'Failed',       color: 'bg-red-100 text-red-800',       icon: HiOutlineX        },
  CANCELLED:    { label: 'Cancelled',    color: 'bg-gray-100 text-gray-600',     icon: HiOutlineX        },
}

const CATEGORY_ICONS = {
  'Gift Cards':   '🎁',
  'Food & Dining':'🍔',
  'Shopping':     '🛍️',
  'Merchandise':  '👕',
  'Experiences':  '🎬',
  'Social Good':  '❤️',
}

function copyCode(code) {
  navigator.clipboard.writeText(code).then(() => toast.success('Copied!'))
}

export default function RedemptionHistory({ orders = [], isLoading = false }) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card animate-pulse h-20" />
        ))}
      </div>
    )
  }

  if (!orders.length) {
    return (
      <div className="text-center py-16">
        <HiOutlineGift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 font-medium">No orders yet</p>
        <p className="text-sm text-gray-400 mt-1">Redeem rewards to see your order history here</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {orders.map(order => {
        const cfg       = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.PENDING
        const StatusIcon = cfg.icon
        const emoji     = CATEGORY_ICONS[order.category] || '🎁'

        return (
          <div key={order.id} className="bg-white border border-gray-200 rounded-2xl p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-start gap-4">
              {/* Category icon */}
              <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-xl flex-shrink-0">
                {order.image_url ? (
                  <img src={order.image_url} alt="" className="h-7 object-contain" onError={e => { e.target.style.display='none' }} />
                ) : (
                  emoji
                )}
              </div>

              {/* Main content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900 text-sm truncate">{order.item_name}</h3>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {cfg.label}
                  </span>
                </div>

                <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
                  <span className="flex items-center gap-0.5">
                    <HiOutlineSparkles className="w-3 h-3 text-perksu-purple" />
                    {formatCurrency(order.points_spent)}
                  </span>
                  <span>{format(new Date(order.created_at), 'dd MMM yyyy')}</span>
                  {order.category && <span>{emoji} {order.category}</span>}
                </div>

                {/* Voucher code */}
                {order.voucher_code && (
                  <div className="mt-2 flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-1.5 w-fit">
                    <code className="text-xs font-mono text-gray-800 tracking-wider">{order.voucher_code}</code>
                    <button
                      onClick={() => copyCode(order.voucher_code)}
                      className="text-gray-400 hover:text-perksu-purple transition-colors"
                      title="Copy code"
                    >
                      <HiOutlineClipboardCopy className="w-4 h-4" />
                    </button>
                    {order.redeem_url && (
                      <a
                        href={order.redeem_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-perksu-purple hover:underline"
                        title="Redeem online"
                      >
                        <HiOutlineExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                )}

                {/* Tracking number for shipped items */}
                {order.tracking_number && (
                  <div className="mt-2 text-xs text-teal-700 flex items-center gap-1">
                    <HiOutlineTruck className="w-3 h-3" />
                    Tracking: <span className="font-mono">{order.tracking_number}</span>
                  </div>
                )}

                {/* Failure reason */}
                {order.status === 'FAILED' && order.failed_reason && (
                  <p className="mt-1 text-xs text-red-500">{order.failed_reason}</p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
