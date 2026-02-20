import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { walletsAPI, recognitionAPI, feedAPI } from '../lib/api'
import { format } from 'date-fns'
import { HiOutlineSparkles, HiOutlineGift, HiOutlineTrendingUp, HiOutlineUsers } from 'react-icons/hi'
import { formatCurrency } from '../lib/currency'
import WalletBalance from '../components/WalletBalance'
import StatCard from '../components/StatCard'
import FeedCard from '../components/FeedCard'

export default function Dashboard() {
  const { user, activeRole } = useAuthStore()

  const { data: wallet } = useQuery({
    queryKey: ['myWallet'],
    queryFn: () => walletsAPI.getMyWallet(),
    enabled: !['platform_admin'].includes(activeRole),
  })

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['myRecognitionStats'],
    queryFn: () => recognitionAPI.getMyStats(),
    enabled: !['platform_admin'].includes(activeRole),
  })

  const { data: feed } = useQuery({
    queryKey: ['feed', { limit: 5 }],
    queryFn: () => feedAPI.getAll({ limit: 5 }),
  })

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div className="bg-gradient-to-r from-perksu-purple to-perksu-blue rounded-2xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">
          Welcome back, {user?.first_name}! 👋
        </h1>
        <p className="text-white/80">
          Ready to recognize your colleagues today?
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <WalletBalance wallet={wallet?.data} />
        
        <StatCard
          title="Recognitions Given"
          value={stats?.data?.total_given || 0}
          icon={<HiOutlineSparkles className="w-6 h-6 text-white" />}
          gradient
          loading={statsLoading}
          footerLeft={
            <span className="text-white/80 font-medium">
              Current Quarter: {formatCurrency(stats?.data?.points_given || 0)}
            </span>
          }
        />

        <StatCard
          title="Recognitions Received"
          value={stats?.data?.total_received || 0}
          icon={<HiOutlineTrendingUp className="w-6 h-6 text-white" />}
          gradient
          loading={statsLoading}
          footerLeft={
            <span className="text-white/80 font-medium">
              Total Rewards: {formatCurrency(stats?.data?.points_received || 0)}
            </span>
          }
        />

        <StatCard
          title="Top Badge"
          value={stats?.data?.top_badges?.[0]?.name || 'None yet'}
          icon={<HiOutlineGift className="w-6 h-6 text-white" />}
          gradient
          loading={statsLoading}
          footerLeft={
            <span className="text-white/80">
              {stats?.data?.top_badges?.[0]?.count || 0} times received
            </span>
          }
        />
      </div>

      {/* Recent activity */}
      <div className="card">
        <h2 className="text-xl font-semibold mb-6">Recent Activity</h2>
        {feed?.data?.length > 0 ? (
          <div className="space-y-4">
            {feed.data.map((item) => (
              <FeedCard key={item.id} item={item} compact />
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <HiOutlineUsers className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No recent activity</p>
            <p className="text-sm">Be the first to recognize someone!</p>
          </div>
        )}
      </div>
    </div>
  )
}
