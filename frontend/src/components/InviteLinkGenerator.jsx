import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import axios from 'axios'
import toast from 'react-hot-toast'
import { 
  HiOutlineLink, 
  HiOutlineClipboard,
  HiOutlineClipboardCheck,
  HiOutlineShare,
  HiOutlineCalendar,
  HiOutlineQrcode,
  HiOutlineMail
} from 'react-icons/hi'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: `${API_URL}/api`,
})

// Add auth token interceptor
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

export default function InviteLinkGenerator() {
  const [generatedLink, setGeneratedLink] = useState(null)
  const [copiedToClipboard, setCopiedToClipboard] = useState(false)
  const [expiryHours, setExpiryHours] = useState(168) // 7 days default
  const [showAdvanced, setShowAdvanced] = useState(false)
  const copyTimeoutRef = useRef(null)

  // Generate invite link mutation
  const generateMutation = useMutation({
    mutationFn: (hours) => api.post(`/tenants/invite-link?hours=${hours}`),
    onSuccess: (response) => {
      setGeneratedLink(response.data)
      toast.success('Invite link generated successfully!')
    },
    onError: (error) => {
      const message = error.response?.data?.detail || 'Failed to generate invite link'
      toast.error(message)
    },
  })

  const handleGenerateLink = () => {
    if (expiryHours < 1 || expiryHours > 8760) {
      toast.error('Expiry time must be between 1 hour and 1 year (8760 hours)')
      return
    }
    generateMutation.mutate(expiryHours)
  }

  const handleCopyLink = async () => {
    if (!generatedLink?.invite_url) return

    try {
      await navigator.clipboard.writeText(generatedLink.invite_url)
      setCopiedToClipboard(true)
      toast.success('Link copied to clipboard!')

      // Reset after 2 seconds
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current)
      }
      copyTimeoutRef.current = setTimeout(() => {
        setCopiedToClipboard(false)
      }, 2000)
    } catch (err) {
      toast.error('Failed to copy link')
    }
  }

  const handleCopyToken = async () => {
    if (!generatedLink?.invite_token) return

    try {
      await navigator.clipboard.writeText(generatedLink.invite_token)
      toast.success('Token copied to clipboard!')
    } catch (err) {
      toast.error('Failed to copy token')
    }
  }

  const formatExpiryTime = (hours) => {
    if (hours === 1) return '1 hour'
    if (hours === 24) return '1 day'
    if (hours === 168) return '7 days'
    if (hours === 720) return '30 days'
    if (hours === 8760) return '1 year'
    if (hours % 24 === 0) return `${hours / 24} days`
    return `${hours} hours`
  }

  const getExpiryDate = (token) => {
    try {
      const parts = token.split('.')
      if (parts.length !== 3) return null
      const decoded = JSON.parse(atob(parts[1]))
      return new Date(decoded.exp * 1000)
    } catch (err) {
      return null
    }
  }

  const expiryDate = generatedLink && getExpiryDate(generatedLink.invite_token)
  const isExpired = expiryDate && expiryDate < new Date()

  return (
    <div className="bg-white rounded-lg shadow-lg">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-2 mb-6 pb-4 border-b border-gray-200">
          <HiOutlineLink className="h-6 w-6 text-indigo-600" />
          <h2 className="text-2xl font-bold text-gray-800">Invite New Team Members</h2>
        </div>

        {!generatedLink ? (
          // Link Generator Form
          <div className="space-y-6">
            <p className="text-gray-600">
              Generate a secure invite link to share with new team members. They'll be automatically 
              added to your organization when they sign up.
            </p>

            {/* Expiry Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Link Expiry Time
              </label>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
                {[
                  { label: '1 day', value: 24 },
                  { label: '7 days', value: 168 },
                  { label: '30 days', value: 720 },
                  { label: '90 days', value: 2160 },
                  { label: '1 year', value: 8760 },
                ].map(option => (
                  <button
                    key={option.value}
                    onClick={() => setExpiryHours(option.value)}
                    className={`px-3 py-2 rounded-lg border-2 font-medium transition-all ${
                      expiryHours === option.value
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-600'
                        : 'border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {/* Custom Expiry */}
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-indigo-600 hover:text-indigo-700 text-sm font-medium"
              >
                {showAdvanced ? '- Hide' : '+ Custom'} expiry time
              </button>

              {showAdvanced && (
                <div className="mt-3">
                  <input
                    type="number"
                    value={expiryHours}
                    onChange={(e) => setExpiryHours(Math.max(1, Math.min(8760, parseInt(e.target.value) || 1)))}
                    min="1"
                    max="8760"
                    className="w-full md:w-32 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-gray-600 mt-1">Enter hours (1-8760)</p>
                </div>
              )}
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <h4 className="font-semibold text-blue-900 mb-2">How it works:</h4>
              <ul className="text-blue-800 text-sm space-y-1">
                <li>✓ Share the link with your team members</li>
                <li>✓ They'll be taken to a sign-up form and automatically assigned to your organization</li>
                <li>✓ Links expire after the selected time for security</li>
              </ul>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerateLink}
              disabled={generateMutation.isPending}
              className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 font-semibold flex items-center justify-center gap-2"
            >
              <HiOutlineLink className="h-5 w-5" />
              Generate Invite Link ({formatExpiryTime(expiryHours)})
            </button>
          </div>
        ) : (
          // Generated Link Display
          <div className="space-y-6">
            {/* Success Message */}
            <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
              <p className="text-green-800 font-semibold">✓ Invite link generated successfully!</p>
              {expiryDate && !isExpired && (
                <p className="text-green-700 text-sm mt-1">
                  Expires: {expiryDate.toLocaleDateString()} at {expiryDate.toLocaleTimeString()}
                </p>
              )}
            </div>

            {/* Link Display */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <HiOutlineLink className="inline-block h-4 w-4 mr-1" />
                Invite URL
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={generatedLink.invite_url}
                  readOnly
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm focus:outline-none"
                />
                <button
                  onClick={handleCopyLink}
                  className={`px-4 py-2 rounded-lg transition-colors font-medium flex items-center gap-2 ${
                    copiedToClipboard
                      ? 'bg-green-100 text-green-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {copiedToClipboard ? (
                    <>
                      <HiOutlineClipboardCheck className="h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <HiOutlineClipboard className="h-4 w-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Token Display */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Token (for API/Mobile)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={generatedLink.invite_token}
                  readOnly
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-xs focus:outline-none break-all"
                />
                <button
                  onClick={handleCopyToken}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  title="Copy token"
                >
                  <HiOutlineClipboard className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Sharing Options */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-gray-700">Share via:</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    const subject = 'Join us on Perksu!'
                    const body = `I'd like to invite you to join our team on Perksu. Click the link below to sign up:\n\n${generatedLink.invite_url}`
                    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  <HiOutlineMail className="h-4 w-4" />
                  Email
                </button>
                <button
                  onClick={() => {
                    const text = `Join us on Perksu! ${generatedLink.invite_url}`
                    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, '_blank')
                  }}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  <HiOutlineShare className="h-4 w-4" />
                  Share
                </button>
              </div>
            </div>

            {/* Expiry Info */}
            <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
              <div className="flex gap-2">
                <HiOutlineCalendar className="h-5 w-5 text-yellow-700 flex-shrink-0 mt-0.5" />
                <div className="text-yellow-800 text-sm">
                  <p className="font-semibold">Link Expiry</p>
                  <p>This link expires {expiryDate ? expiryDate.toLocaleDateString() + ' at ' + expiryDate.toLocaleTimeString() : 'in ' + formatExpiryTime(expiryHours)}</p>
                  <p className="mt-1">After expiration, a new link must be generated for additional invites.</p>
                </div>
              </div>
            </div>

            {/* Generate Another Button */}
            <button
              onClick={() => setGeneratedLink(null)}
              className="w-full px-4 py-3 border-2 border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors font-semibold"
            >
              Generate Another Link
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
