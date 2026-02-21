import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { HiX, HiOutlineStar, HiOutlineGift, HiOutlineUsers, HiOutlineSparkles, HiOutlineNewspaper, HiOutlineSearch } from 'react-icons/hi'
import toast from 'react-hot-toast'
import { recognitionApi, usersApi, tenantsApi, budgetsAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'

const RECOGNITION_TYPES = [
  { id: 'standard', name: 'Standard', icon: HiOutlineStar },
  { id: 'individual_award', name: 'Individual Award', icon: HiOutlineSparkles },
  { id: 'group_award', name: 'Group Award', icon: HiOutlineUsers },
  { id: 'ecard', name: 'E-Card', icon: HiOutlineNewspaper },
]

const ECARD_TEMPLATES = [
  { id: 'appreciation', name: 'Appreciation', color: 'blue' },
  { id: 'welcome', name: 'Welcome', color: 'green' },
  { id: 'anniversary', name: 'Work Anniversary', color: 'purple' },
  { id: 'birthday', name: 'Birthday', color: 'pink' },
  { id: 'festive', name: 'Festive', color: 'orange' },
]

export default function RecognitionModal({ isOpen, onClose, initialSelectedUser, defaultType = 'standard' }) {
  const { user: currentUser, activeRole } = useAuthStore()
  const [recognitionType, setRecognitionType] = useState(defaultType)
  
  // Filter recognition types based on persona
  const availableTypes = RECOGNITION_TYPES.filter(type => {
    if (activeRole === 'user') {
      return ['standard', 'ecard'].includes(type.id)
    }
    return true // Admins and Leads can see all
  })
  
  const [recipients, setRecipients] = useState([])

  useEffect(() => {
    if (defaultType) {
      setRecognitionType(defaultType)
    }
  }, [defaultType, isOpen])

  const [message, setMessage] = useState('')
  const [points, setPoints] = useState(100)
  const [badgeId, setBadgeId] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [isEqualSplit, setIsEqualSplit] = useState(false)
  const [ecardTemplate, setEcardTemplate] = useState('appreciation')
  const [selectedTier, setSelectedTier] = useState('Bronze')
  
  const queryClient = useQueryClient()

  const { data: tenantData } = useQuery({
    queryKey: ['currentTenant'],
    queryFn: () => tenantsApi.getCurrent(),
    enabled: isOpen
  })

  const { data: budgetData } = useQuery({
    queryKey: ['myAvailablePoints'],
    queryFn: () => budgetsAPI.getMyAvailablePoints(),
    enabled: isOpen
  })

  // Get tiers from tenant branding_config or use defaults
  const tiers = tenantData?.branding_config?.award_tiers || {
    Gold: 5000,
    Silver: 2500,
    Bronze: 1000
  }

  useEffect(() => {
    if (initialSelectedUser) {
      setRecipients([initialSelectedUser])
    }
  }, [initialSelectedUser])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  useEffect(() => {
    if (recognitionType === 'individual_award') {
      setPoints(tiers[selectedTier])
    } else if (recognitionType === 'ecard') {
      setPoints(0)
    }
  }, [recognitionType, selectedTier, tiers])

  const { data: usersData } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.getAll(),
    enabled: isOpen
  })

  const users = usersData || []

  const { data: badgesData } = useQuery({
    queryKey: ['badges'],
    queryFn: () => recognitionApi.getBadges(),
    enabled: isOpen
  })

  const badges = badgesData || []

  const recognitionMutation = useMutation({
    mutationFn: (data) => recognitionApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['feed'])
      queryClient.invalidateQueries(['wallet'])
      toast.success('Recognition sent successfully! 🎉')
      handleClose()
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to send recognition')
    }
  })

  const handleClose = () => {
    setRecipients([])
    setMessage('')
    setPoints(100)
    setBadgeId('')
    setIsPrivate(false)
    setSearchTerm('')
    setRecognitionType('standard')
    onClose()
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (recipients.length === 0) {
      toast.error('Please select at least one recipient')
      return
    }
    if ((recognitionType === 'individual_award' || recognitionType === 'group_award') && message.trim().length < 50) {
      toast.error('Citation must be at least 50 characters for High Impact awards')
      return
    }
    if (!message.trim()) {
      toast.error('Please enter a message')
      return
    }

    const payload = {
      message: message.trim(),
      points: Number(points),
      recognition_type: recognitionType,
      badge_id: badgeId || undefined,
      visibility: isPrivate ? 'private' : 'public',
    }

    if (recognitionType === 'group_award') {
      payload.to_user_ids = recipients.map(r => r.id)
      payload.is_equal_split = isEqualSplit
    } else {
      payload.to_user_id = recipients[0].id
    }

    if (recognitionType === 'ecard') {
      payload.ecard_template = ecardTemplate
    }

    recognitionMutation.mutate(payload)
  }

  const filteredUsers = users?.filter(u => 
    u.id !== currentUser.id &&
    !recipients.some(r => r.id === u.id) &&
    (u.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     u.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
     u.email.toLowerCase().includes(searchTerm.toLowerCase()))
  ) || []

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
        
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-0 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-perksu-purple to-perksu-blue p-3 px-6 text-white">
            <button
              onClick={handleClose}
              className="absolute top-3 right-4 text-white/80 hover:text-white"
            >
              <HiX className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2">
              <HiOutlineSparkles className="w-5 h-5" />
              <h2 className="text-lg font-bold">New Recognition</h2>
            </div>
            <p className="text-[10px] text-white/80">Recognize contribution and build culture</p>
          </div>

          <div className="p-5">
            {/* Workflow Selection */}
            <div className="grid grid-cols-4 gap-2 mb-6">
              {availableTypes.map(type => (
                <button
                  key={type.id}
                  onClick={() => {
                    setRecognitionType(type.id)
                    if (type.id !== 'group_award' && recipients.length > 1) {
                      setRecipients([recipients[0]])
                    }
                  }}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
                    recognitionType === type.id
                      ? 'border-perksu-purple bg-perksu-purple/5 text-perksu-purple'
                      : 'border-gray-100 hover:border-gray-200 text-gray-400'
                  }`}
                >
                  <type.icon className="w-6 h-6" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">{type.name}</span>
                </button>
              ))}
            </div>

            {/* Budget Summary Bar */}
            {budgetData && (
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 rounded-xl mb-6 border border-gray-100">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">Available Budget</span>
                    <div className="flex items-center gap-3">
                      {budgetData.lead_points > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-perksu-purple"></div>
                          <span className="text-sm font-bold text-gray-700">{budgetData.lead_points.toLocaleString()} <small className="text-[10px] text-gray-400">Personal</small></span>
                        </div>
                      )}
                      {budgetData.department_points > 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                          <span className="text-sm font-bold text-gray-700">{budgetData.department_points.toLocaleString()} <small className="text-[10px] text-gray-400">Dept</small></span>
                        </div>
                      )}
                      {budgetData.lead_points === 0 && budgetData.department_points === 0 && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-500"></div>
                          <span className="text-sm font-bold text-gray-700">{budgetData.wallet_balance.toLocaleString()} <small className="text-[10px] text-gray-400">Wallet</small></span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {!budgetData.has_active_budget && (
                  <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded-lg border border-orange-100">
                    No Active Budget Period
                  </span>
                )}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Recipients */}
              <div className="relative">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Recipients
                </label>
                <div className="flex flex-wrap gap-2 p-3 border-2 border-gray-100 rounded-xl bg-gray-50 focus-within:border-perksu-purple transition-all">
                  {recipients.map(recipient => (
                    <div key={recipient.id} className="flex items-center gap-2 bg-white px-2 py-1 rounded-lg border border-gray-200 shadow-sm">
                      <div className="w-6 h-6 rounded-full bg-perksu-purple/10 flex items-center justify-center text-[10px] font-bold text-perksu-purple">
                        {recipient.first_name[0]}{recipient.last_name[0]}
                      </div>
                      <span className="text-sm font-medium">{recipient.first_name} {recipient.last_name}</span>
                      <button 
                        type="button" 
                        onClick={() => setRecipients(recipients.filter(r => r.id !== recipient.id))}
                        className="text-gray-400 hover:text-red-500"
                      >
                        <HiX className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value)
                      setShowUserDropdown(true)
                    }}
                    onFocus={() => setShowUserDropdown(true)}
                    placeholder={recipients.length === 0 ? "Search for a colleague..." : ""}
                    className="flex-1 min-w-[150px] bg-transparent outline-none text-sm"
                    disabled={recognitionType !== 'group_award' && recipients.length >= 1}
                  />
                </div>
                
                {showUserDropdown && searchTerm && filteredUsers.length > 0 && (
                  <div className="absolute z-10 w-full mt-2 bg-white border-2 border-gray-100 rounded-xl shadow-xl max-h-60 overflow-y-auto ring-4 ring-black/5">
                    {filteredUsers.map(user => (
                      <button
                        key={user.id}
                        type="button"
                        onClick={() => {
                          if (recognitionType === 'group_award') {
                            setRecipients([...recipients, user])
                          } else {
                            setRecipients([user])
                          }
                          setSearchTerm('')
                          setShowUserDropdown(false)
                        }}
                        className="w-full flex items-center gap-3 p-4 hover:bg-perksu-purple/5 transition-colors text-left border-b border-gray-50 last:border-0"
                      >
                        <div className="w-10 h-10 bg-gradient-to-br from-perksu-purple to-perksu-blue rounded-full flex items-center justify-center text-white font-bold">
                          {user.first_name[0]}{user.last_name[0]}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{user.first_name} {user.last_name}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Award Specific Content */}
              {recognitionType === 'individual_award' && (
                <div className="bg-gray-50 p-4 rounded-xl space-y-4 border-2 border-gray-100">
                  <header className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-700 uppercase tracking-widest">Select Tier</span>
                    <span className="text-xs text-orange-600 font-bold bg-orange-100 px-2 py-0.5 rounded-full">Manager Reward</span>
                  </header>
                  <div className="grid grid-cols-3 gap-3">
                    {Object.entries(tiers).map(([name, val]) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setSelectedTier(name)}
                        className={`flex flex-col items-center p-3 rounded-lg border-2 transition-all ${
                          selectedTier === name
                            ? 'border-perksu-orange bg-perksu-orange/5 text-perksu-orange'
                            : 'border-white bg-white text-gray-400 hover:border-gray-200'
                        }`}
                      >
                        <span className="text-xs font-bold">{name}</span>
                        <span className="text-lg font-black">{val}</span>
                        <span className="text-[10px] uppercase">pts</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {recognitionType === 'group_award' && (
                <div className="bg-gray-50 p-4 rounded-xl space-y-4 border-2 border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-gray-900">Allocation Logic</h4>
                      <p className="text-xs text-gray-500">Determine how points are distributed</p>
                    </div>
                    <div className="flex bg-white p-1 rounded-lg border border-gray-200">
                      <button
                        type="button"
                        onClick={() => setIsEqualSplit(false)}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition ${!isEqualSplit ? 'bg-perksu-purple text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                      >
                        FLAT
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEqualSplit(true)}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition ${isEqualSplit ? 'bg-perksu-purple text-white' : 'text-gray-500 hover:bg-gray-50'}`}
                      >
                        EQUAL SPLIT
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-1">
                        {isEqualSplit ? 'Total Pot' : 'Points Per User'}
                      </label>
                      <input
                        type="number"
                        value={points}
                        onChange={(e) => setPoints(Number(e.target.value))}
                        min="100"
                        step="100"
                        className="w-full bg-white border-2 border-gray-100 rounded-lg p-2 font-bold outline-none focus:border-perksu-purple"
                      />
                    </div>
                    <div className="text-center bg-white px-4 py-2 rounded-lg border-2 border-gray-100">
                      <span className="block text-xs font-bold text-gray-400 uppercase">Total Cost</span>
                      <span className="text-lg font-black text-perksu-purple">
                        {isEqualSplit ? points : points * recipients.length} pts
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {recognitionType === 'ecard' && (
                <div className="bg-gray-50 p-4 rounded-xl space-y-4 border-2 border-gray-100">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest block">Choose Template</span>
                  <div className="flex flex-wrap gap-2">
                    {ECARD_TEMPLATES.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setEcardTemplate(t.id)}
                        className={`px-4 py-2 rounded-full border-2 text-sm font-bold transition-all ${
                          ecardTemplate === t.id
                            ? 'border-perksu-purple bg-perksu-purple text-white'
                            : 'border-white bg-white text-gray-500 hover:border-gray-200'
                        }`}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Standard Points */}
              {recognitionType === 'standard' && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Points</label>
                  <div className="flex items-center gap-2">
                    {[100, 200, 500, 1000].map(p => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPoints(p)}
                        className={`flex-1 py-3 rounded-xl border-2 font-bold transition-all ${
                          points === p
                            ? 'border-perksu-purple bg-perksu-purple/5 text-perksu-purple'
                            : 'border-gray-100 hover:border-gray-200 text-gray-400'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                    <input
                      type="number"
                      value={points}
                      onChange={(e) => setPoints(Number(e.target.value))}
                      min="100"
                      step="100"
                      className="w-24 py-3 rounded-xl border-2 border-gray-100 text-center font-bold outline-none focus:border-perksu-purple"
                    />
                  </div>
                </div>
              )}

              {/* Message */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Citation / Message
                  {(recognitionType === 'individual_award' || recognitionType === 'group_award') && (
                    <span className="text-[10px] ml-2 font-bold text-perksu-purple uppercase bg-perksu-purple/10 px-2 py-0.5 rounded">High Impact (Min 50 chars)</span>
                  )}
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={recognitionType === 'ecard' ? "Add a personal note..." : "Describe the achievement and core values displayed..."}
                  rows={4}
                  className="w-full border-2 border-gray-100 rounded-xl p-4 resize-none outline-none focus:border-perksu-purple bg-gray-50 transition-all font-medium"
                  required
                />
                {(recognitionType === 'individual_award' || recognitionType === 'group_award') && (
                  <div className="mt-1 flex justify-between items-center">
                    <div className="flex-1 bg-gray-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${message.length >= 50 ? 'bg-green-500' : 'bg-perksu-orange'}`}
                        style={{ width: `${Math.min(100, (message.length / 50) * 100)}%` }}
                      />
                    </div>
                    <span className="ml-3 text-[10px] font-bold text-gray-400">{message.length}/50</span>
                  </div>
                )}
              </div>

              {/* Badges & Privacy */}
              <div className="flex gap-4">
                <div className="flex-1">
                   <label className="block text-sm font-semibold text-gray-700 mb-2">Badge (Optional)</label>
                   <select 
                    value={badgeId} 
                    onChange={(e) => setBadgeId(e.target.value)}
                    className="w-full border-2 border-gray-100 rounded-xl p-3 outline-none focus:border-perksu-purple bg-gray-50"
                  >
                    <option value="">No Badge</option>
                    {badges.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>
                <div className="w-1/3">
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Visibility</label>
                  <button
                    type="button"
                    onClick={() => setIsPrivate(!isPrivate)}
                    className={`w-full flex items-center justify-center h-[52px] rounded-xl border-2 font-bold transition-all ${
                      isPrivate 
                        ? 'border-gray-800 bg-gray-800 text-white' 
                        : 'border-gray-100 text-gray-500 hover:border-gray-200'
                    }`}
                  >
                    {isPrivate ? 'PRIVATE' : 'PUBLIC'}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-6 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleClose}
                  className="flex-1 py-4 text-sm font-bold text-gray-500 hover:bg-gray-50 rounded-2xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recognitionMutation.isPending}
                  className="flex-[2] py-4 bg-gradient-to-r from-perksu-purple to-perksu-blue text-white rounded-2xl font-bold shadow-lg shadow-perksu-purple/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {recognitionMutation.isPending ? (
                    'Processing...'
                  ) : (
                    <>
                      <HiOutlineGift className="w-6 h-6" />
                      <span>{recognitionType === 'ecard' ? 'Send E-Card' : 'Confirm Recognition'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
