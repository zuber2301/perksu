import { useAuthStore } from '../store/authStore'
import { useQuery } from '@tanstack/react-query'
import { walletsAPI, recognitionAPI } from '../lib/api'
import StatCard from '../components/StatCard'
import { HiOutlineUser, HiOutlineMail, HiOutlineBriefcase, HiOutlineSparkles, HiOutlineCash, HiOutlineTrendingUp, HiOutlineEmojiHappy } from 'react-icons/hi'

const ROLE_DISPLAY_NAMES = {
  platform_admin: 'Perksu Admin',
  hr_admin: 'HR Admin',
  dept_lead: 'Department Lead',
  user: 'User'
}

export default function Profile() {
  const { user, activeRole } = useAuthStore()

  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ['myWallet'],
    queryFn: () => walletsAPI.getMyWallet(),
    enabled: activeRole !== 'platform_admin',
  })

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['myRecognitionStats'],
    queryFn: () => recognitionAPI.getMyStats(),
    enabled: activeRole !== 'platform_admin',
  })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Header */}
      <div className="card text-center">
        <div className="w-24 h-24 mx-auto rounded-full bg-gradient-to-r from-perksu-purple to-perksu-blue flex items-center justify-center text-white text-3xl font-bold mb-4">
          {user?.first_name?.[0]}{user?.last_name?.[0]}
        </div>
        <h1 className="text-2xl font-bold text-gray-900">
          {user?.first_name} {user?.last_name}
        </h1>
        <p className="text-gray-500">{ROLE_DISPLAY_NAMES[activeRole] || activeRole?.replace('_', ' ')} Persona</p>
      </div>

      {/* Contact Info */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4 text-gray-400 uppercase tracking-widest text-[10px]">Role Information</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <HiOutlineBriefcase className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-gray-400">System Role</p>
              <p className="font-medium text-gray-900">{ROLE_DISPLAY_NAMES[user?.role] || user?.role?.replace('_', ' ')}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <HiOutlineOfficeBuilding className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-xs text-gray-400">Org Role</p>
              <p className="font-medium text-gray-900">{ROLE_DISPLAY_NAMES[user?.org_role] || user?.org_role?.replace('_', ' ')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Info */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Contact Information</h2>
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <HiOutlineMail className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Email</p>
              <p className="font-medium">{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
              <HiOutlineUser className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <p className="font-medium capitalize">{user?.status}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Recognition Stats</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <StatCard
            title="Points Balance"
            value={wallet?.data?.balance || 0}
            icon={<HiOutlineCash className="w-6 h-6 text-white" />}
            gradient
            loading={walletLoading}
          />
          <StatCard
            title="Lifetime Earned"
            value={wallet?.data?.lifetime_earned || 0}
            icon={<HiOutlineTrendingUp className="w-6 h-6 text-white" />}
            gradient
            loading={walletLoading}
          />
          <StatCard
            title="Recognitions Given"
            value={stats?.data?.total_given || 0}
            icon={<HiOutlineSparkles className="w-6 h-6 text-white" />}
            gradient
            loading={statsLoading}
          />
          <StatCard
            title="Recognitions Received"
            value={stats?.data?.total_received || 0}
            icon={<HiOutlineEmojiHappy className="w-6 h-6 text-white" />}
            gradient
            loading={statsLoading}
          />
        </div>
      </div>

      {/* Top Badges */}
      {stats?.data?.top_badges?.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Top Badges</h2>
          <div className="space-y-3">
            {stats.data.top_badges.map((badge, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-perksu-orange to-perksu-pink flex items-center justify-center text-white text-sm font-bold">
                    {index + 1}
                  </div>
                  <span className="font-medium">{badge.name}</span>
                </div>
                <span className="text-gray-500">{badge.count}x received</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
