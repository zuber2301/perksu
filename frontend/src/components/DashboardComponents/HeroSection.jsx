import { HiOutlineBanknotes, HiOutlineUsers, HiOutlineWallet } from 'react-icons/hi2'

/**
 * HeroSection Component
 * Displays the three high-impact value cards at the top of the dashboard
 */
export default function HeroSection({ stats, currency = 'INR' }) {
  if (!stats) return null

  const cards = [
    {
      title: 'Company Pool (Master)',
      value: stats.master_pool?.toLocaleString() || 0,
      subtitle: 'Points available for you to distribute or delegate',
      icon: HiOutlineBanknotes,
      gradient: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
    },
    {
      title: 'Total Delegated',
      value: stats.total_delegated?.toLocaleString() || 0,
      subtitle: 'Budget currently in the hands of your Department Leads',
      icon: HiOutlineUsers,
      gradient: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
    },
    {
      title: 'Wallet Circulation',
      value: stats.total_in_wallets?.toLocaleString() || 0,
      subtitle: 'Points earned by employees and ready for redemption',
      icon: HiOutlineWallet,
      gradient: 'from-emerald-500 to-emerald-600',
      bgColor: 'bg-emerald-50',
      textColor: 'text-emerald-600',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {cards.map((card, index) => {
        const Icon = card.icon
        return (
          <div
            key={index}
            className={`${card.bgColor} rounded-lg border-2 border-gray-200 p-6 hover:shadow-lg transition`}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-gray-600 uppercase tracking-wider mb-1">
                  {card.title}
                </p>
                <p className={`text-3xl font-bold ${card.textColor}`}>
                  {card.value}
                </p>
              </div>
              <div
                className={`p-3 rounded-lg bg-gradient-to-br ${card.gradient} text-white`}
              >
                <Icon className="w-6 h-6" />
              </div>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              {card.subtitle}
            </p>
            {/* Progress indicator */}
            <div className="mt-4 pt-4 border-t border-gray-300">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-600 mb-2">
                <span>Utilization</span>
                <span>
                  {card.title === 'Company Pool (Master)'
                    ? Math.round(((stats.total_delegated + stats.total_in_wallets) / stats.master_pool) * 100) || 0
                    : card.title === 'Total Delegated'
                    ? Math.round((stats.total_in_wallets / stats.total_delegated) * 100) || 0
                    : 'Active'}
                  %
                </span>
              </div>
              <div className="w-full bg-gray-300 rounded-full h-2">
                <div
                  className={`h-2 rounded-full bg-gradient-to-r ${card.gradient}`}
                  style={{
                    width: `${
                      card.title === 'Company Pool (Master)'
                        ? Math.round(((stats.total_delegated + stats.total_in_wallets) / stats.master_pool) * 100) || 0
                        : card.title === 'Total Delegated'
                        ? Math.round((stats.total_in_wallets / stats.total_delegated) * 100) || 0
                        : 100
                    }%`,
                  }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
