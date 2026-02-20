import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { recognitionAPI, usersAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { HiOutlineSparkles, HiOutlineStar, HiOutlineUsers } from 'react-icons/hi'
import RecognitionModal from '../components/RecognitionModal'
import FeedCard from '../components/FeedCard'

export default function Recognize() {
  const [selectedUser, setSelectedUser] = useState(null)
  const [showModal, setShowModal] = useState(false)
  const [defaultType, setDefaultType] = useState('standard')
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  useEffect(() => {
    const type = searchParams.get('type')
    if (type) {
      handleOpenWorkflow(type)
      // Clear the param after opening to avoid re-opening on back navigation
      setSearchParams({}, { replace: true })
    }
  }, [searchParams])

  const { data: badges } = useQuery({
    queryKey: ['badges'],
    queryFn: () => recognitionAPI.getBadges(),
  })

  const { data: recentRecognitions } = useQuery({
    queryKey: ['recognitions', { user_id: user?.id }],
    queryFn: () => recognitionAPI.getAll({ limit: 10 }),
  })

  const handleOpenWorkflow = (type) => {
    setDefaultType(type)
    setSelectedUser(null)
    setShowModal(true)
  }

  const pathways = [
    { 
      id: 'standard', 
      name: 'Standard', 
      description: 'Peer-to-peer appreciation & badges', 
      icon: HiOutlineStar, 
      gradient: 'from-perksu-purple to-perksu-blue' 
    },
    { 
      id: 'individual_award', 
      name: 'Individual Award', 
      description: 'Manager-to-employee high impact awards', 
      icon: HiOutlineSparkles, 
      gradient: 'from-orange-500 to-red-500', 
      roles: ['manager', 'hr_admin', 'tenant_manager', 'platform_admin'] 
    },
    { 
      id: 'group_award', 
      name: 'Group Award', 
      description: 'Celebrate team-wide wins & milestones', 
      icon: HiOutlineUsers, 
      gradient: 'from-blue-600 to-indigo-600', 
      roles: ['manager', 'hr_admin', 'tenant_manager', 'platform_admin'] 
    },
    { 
      id: 'ecard', 
      name: 'E-Card', 
      description: 'Personalized cards for milestones', 
      icon: HiOutlineStar, 
      gradient: 'from-purple-500 to-pink-500' 
    },
  ]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <RecognitionModal 
        isOpen={showModal} 
        onClose={() => {
          setShowModal(false)
          setSelectedUser(null)
          setDefaultType('standard')
        }}
        initialSelectedUser={selectedUser}
        defaultType={defaultType}
      />
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-r from-perksu-purple to-perksu-blue rounded-2xl mb-3">
          <HiOutlineSparkles className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Recognize Someone</h1>
        <p className="text-sm text-gray-500">
          Show appreciation for your colleagues' great work
        </p>
      </div>

      {/* Pathways */}
      <div className="grid grid-cols-4 gap-3">
        {pathways.map(path => (
          (!path.roles || path.roles.includes(user?.role)) && (
            <button
              key={path.id}
              onClick={() => handleOpenWorkflow(path.id)}
              className={`flex flex-col items-start p-3 rounded-2xl bg-gradient-to-br ${path.gradient} text-white shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all text-left group relative overflow-hidden`}
            >
              <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:scale-110 transition-transform">
                <path.icon className="w-12 h-12" />
              </div>
              <div className="w-10 h-10 rounded-lg mb-2 flex items-center justify-center bg-white/20 backdrop-blur-sm">
                <path.icon className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-base font-bold mb-0.5 line-clamp-1">{path.name}</h3>
              <p className="text-xs text-white/80 line-clamp-2">{path.description}</p>
              
              <div className="mt-2 flex items-center text-xs font-semibold uppercase tracking-wider bg-white/10 px-2 py-1 rounded-lg backdrop-blur-sm">
                Start Now
                <svg className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          )
        ))}
      </div>

      {/* Quick recognize - badges */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Available Badges</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {badges?.data?.map((badge) => (
            <div
              key={badge.id}
              className="p-4 rounded-lg border border-gray-200 text-center hover:border-perksu-purple hover:bg-perksu-purple/5 transition-colors"
            >
              <div className="w-12 h-12 mx-auto mb-2 bg-gradient-to-r from-perksu-orange to-perksu-pink rounded-full flex items-center justify-center text-white">
                <HiOutlineStar className="w-6 h-6" />
              </div>
              <p className="font-medium text-gray-900 text-sm">{badge.name}</p>
              <p className="text-xs text-gray-500">{badge.points_value} pts</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent recognitions */}
      {recentRecognitions?.data?.length > 0 && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Recent Recognitions</h2>
          <div className="space-y-4">
            {recentRecognitions.data.slice(0, 5).map((rec) => (
              <FeedCard key={rec.id} item={{
                id: rec.id,
                event_type: 'recognition',
                actor_name: rec.from_user_name,
                target_name: rec.to_user_name,
                metadata: { message: rec.message, points: rec.points },
                created_at: rec.created_at
              }} compact />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
