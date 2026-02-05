import { useState } from 'react'
import { HiOutlineHandRaised, HiOutlineHeart } from 'react-icons/hi2'

/**
 * RecentRecognitionFeed Component
 * Displays recent awards with social interaction features
 */
export default function RecentRecognitionFeed({ recognitions, onRefresh }) {
  const [likes, setLikes] = useState({})

  const toggleLike = (id) => {
    setLikes(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  }

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Company Culture Feed</h2>
          <p className="text-sm text-gray-600 mt-1">
            Recent recognitions from your team
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
        >
          Refresh
        </button>
      </div>

      {recognitions && recognitions.length > 0 ? (
        <div className="divide-y divide-gray-200">
          {recognitions.map((recognition, index) => (
            <div
              key={index}
              className="px-6 py-4 hover:bg-gray-50 transition"
            >
              <div className="flex gap-4">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold">
                    {recognition.given_by_name?.charAt(0) || 'U'}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">
                        <span>{recognition.given_by_name}</span>
                        <span className="text-gray-600 font-normal">
                          {' '}recognized{' '}
                        </span>
                        <span>{recognition.received_by_name}</span>
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDate(recognition.created_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-blue-600">
                        +{recognition.points} pts
                      </p>
                    </div>
                  </div>

                  {/* Recognition Message */}
                  {recognition.message && (
                    <p className="text-sm text-gray-700 mt-2 line-clamp-2">
                      "{recognition.message}"
                    </p>
                  )}

                  {/* Tags */}
                  {recognition.tags && recognition.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {recognition.tags.map((tag, tagIndex) => (
                        <span
                          key={tagIndex}
                          className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      onClick={() => toggleLike(recognition.id)}
                      className={`flex items-center gap-1 px-3 py-1 rounded-lg transition text-sm font-medium ${
                        likes[recognition.id]
                          ? 'bg-red-100 text-red-600'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <HiOutlineHeart
                        className={`w-4 h-4 ${
                          likes[recognition.id] ? 'fill-current' : ''
                        }`}
                      />
                      High Five
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-6 py-12 text-center text-gray-500">
          <HiOutlineHandRaised className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No recent recognitions yet. Encourage your team to celebrate wins!</p>
        </div>
      )}
    </div>
  )
}
