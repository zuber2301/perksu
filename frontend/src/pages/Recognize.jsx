import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { recognitionAPI, usersAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { HiOutlineSearch, HiOutlineSparkles, HiOutlineStar, HiOutlineUsers } from 'react-icons/hi'
import RecognitionModal from '../components/RecognitionModal'
import FeedCard from '../components/FeedCard'

export default function Recognize() {
  const [searchQuery, setSearchQuery] = useState('')
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

  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['userSearch', searchQuery],
    queryFn: () => usersAPI.search(searchQuery),
    enabled: searchQuery.length >= 2,
  })

  const { data: recentRecognitions } = useQuery({
    queryKey: ['recognitions', { user_id: user?.id }],
    queryFn: () => recognitionAPI.getAll({ limit: 10 }),
  })

  const handleSelectUser = (selectedUser) => {
    setSelectedUser(selectedUser)
    setDefaultType('standard')
    setShowModal(true)
  }

  const handleOpenWorkflow = (type) => {
    setDefaultType(type)
    setSelectedUser(null)
    setShowModal(true)
  }

  const pathways = [
    { id: 'individual_award', name: 'Individual Award', description: 'Manager-to-employee high impact recognition', icon: HiOutlineSparkles, color: 'orange', roles: ['manager', 'hr_admin', 'tenant_manager', 'platform_admin'] },
    { id: 'group_award', name: 'Group Award', description: 'Celebrate team-wide wins and project milestones', icon: HiOutlineUsers, color: 'blue', roles: ['manager', 'hr_admin', 'tenant_manager', 'platform_admin'] },
    { id: 'ecard', name: 'Send E-Card', description: 'Personalized cards for birthdays and milestones', icon: HiOutlineStar, color: 'purple' },
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {pathways.map(path => (
          (!path.roles || path.roles.includes(user?.role)) && (
            <button
              key={path.id}
              onClick={() => handleOpenWorkflow(path.id)}
              className="flex flex-col items-start p-4 bg-white rounded-2xl border-2 border-transparent hover:border-perksu-purple shadow-sm hover:shadow-md transition-all text-left"
            >
              <div className={`w-10 h-10 rounded-xl mb-3 flex items-center justify-center bg-${path.color}-100 text-${path.color}-600`}>
                <path.icon className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-0.5">{path.name}</h3>
              <p className="text-xs text-gray-500">{path.description}</p>
            </button>
          )
        ))}
      </div>

      {/* Search */}
      <div className="card">
        <label className="label font-bold text-gray-700">Quick Recognition</label>
        <p className="text-xs text-gray-500 mb-4">Search for a colleague to give standard recognition</p>
        <div className="relative">
          <HiOutlineSearch className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-12"
            placeholder="Search by name or email..."
          />
        </div>

        {/* Search results */}
        {searchQuery.length >= 2 && (
          <div className="mt-4">
            {isSearching ? (
              <div className="text-center py-4 text-gray-500">Searching...</div>
            ) : searchResults?.data?.length > 0 ? (
              <div className="space-y-2">
                {searchResults.data
                  .filter((u) => u.id !== user.id)
                  .map((searchUser) => (
                    <button
                      key={searchUser.id}
                      onClick={() => handleSelectUser(searchUser)}
                      className="w-full flex items-center gap-4 p-4 rounded-lg border border-gray-200 hover:border-perksu-purple hover:bg-perksu-purple/5 transition-colors text-left"
                    >
                      <div className="w-12 h-12 rounded-full bg-gradient-to-r from-perksu-purple to-perksu-blue flex items-center justify-center text-white font-medium">
                        {searchUser.first_name[0]}{searchUser.last_name[0]}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">
                          {searchUser.first_name} {searchUser.last_name}
                        </p>
                        <p className="text-sm text-gray-500">{searchUser.email}</p>
                      </div>
                      <HiOutlineStar className="w-5 h-5 text-gray-400" />
                    </button>
                  ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">No users found</div>
            )}
          </div>
        )}
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
