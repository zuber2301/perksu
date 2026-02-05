import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tenantsAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import TenantSettingsTab from '../components/TenantSettingsTab'
import toast from 'react-hot-toast'
import { HiOutlineCog } from 'react-icons/hi'

export default function Settings() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [message, setMessage] = useState('')

  // Fetch current tenant
  const { data: tenant, isLoading } = useQuery({
    queryKey: ['currentTenant'],
    queryFn: () => tenantsAPI.getCurrent(),
  })

  // Update tenant mutation
  const updateMutation = useMutation({
    mutationFn: (data) => tenantsAPI.updateCurrent(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['currentTenant'])
      toast.success('Settings updated successfully')
      setMessage('Settings updated successfully')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to update settings')
      setMessage('Failed to update settings')
    }
  })

  const handleUpdate = (data) => {
    updateMutation.mutate(data)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-perksu-purple"></div>
      </div>
    )
  }

  if (!tenant) {
    return (
      <div className="text-center py-12">
        <HiOutlineCog className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No tenant data</h3>
        <p className="mt-1 text-sm text-gray-500">Unable to load tenant settings.</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-600">
          Manage your organization's settings and configuration
        </p>
      </div>

      {message && (
        <div className={`mb-6 p-4 rounded-lg ${
          message.includes('success') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message}
        </div>
      )}

      <div className="bg-white shadow rounded-lg">
        <TenantSettingsTab
          tenant={tenant}
          onUpdate={handleUpdate}
          setMessage={setMessage}
        />
      </div>
    </div>
  )
}