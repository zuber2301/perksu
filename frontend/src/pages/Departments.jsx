import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { departmentsAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import {
  HiOutlineOfficeBuilding,
  HiOutlinePlus,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineCurrencyRupee,
  HiOutlineUsers,
  HiOutlineChartBar
} from 'react-icons/hi'
import { formatCurrency } from '../lib/currency'

export default function Departments() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingDepartment, setEditingDepartment] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    allocated_budget: 0
  })

  // Fetch departments and their budget data
  const { data: departments, isLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsAPI.getAll(),
  })

  // Fetch master pool balance
  const { data: masterPool } = useQuery({
    queryKey: ['master-pool'],
    queryFn: () => departmentsAPI.getMasterPool(),
  })

  const createMutation = useMutation({
    mutationFn: (data) => departmentsAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['departments'])
      toast.success('Department created successfully')
      setShowCreateModal(false)
      setFormData({ name: '', allocated_budget: 0 })
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to create department')
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => departmentsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['departments'])
      toast.success('Department updated successfully')
      setEditingDepartment(null)
      setFormData({ name: '', allocated_budget: 0 })
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to update department')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => departmentsAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['departments'])
      toast.success('Department deleted successfully')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to delete department')
    }
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    if (editingDepartment) {
      updateMutation.mutate({ id: editingDepartment.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleEdit = (department) => {
    setEditingDepartment(department)
    setFormData({
      name: department.name,
      allocated_budget: department.allocated_budget || 0
    })
  }

  const handleDelete = (departmentId) => {
    if (window.confirm('Are you sure you want to delete this department?')) {
      deleteMutation.mutate(departmentId)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-perksu-purple"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Departments</h1>
          <p className="text-gray-600 mt-1">
            Create departments and allocate budget from your master pool
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <HiOutlinePlus className="w-5 h-5" />
          Create Department
        </button>
      </div>

      {/* Master Pool Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Master Pool Balance</h3>
            <p className="text-gray-600">Available for department allocation</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-green-600">
              {formatCurrency(masterPool?.balance) || '₹0'}
            </div>
            <p className="text-sm text-gray-500">Total allocated: {formatCurrency(masterPool?.allocated) || '₹0'}</p>
          </div>
        </div>
      </div>

      {/* Departments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments?.map((department) => (
          <div key={department.id} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-perksu-purple/10 rounded-lg flex items-center justify-center">
                  <HiOutlineOfficeBuilding className="w-6 h-6 text-perksu-purple" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{department.name}</h3>
                  <p className="text-sm text-gray-500">{department.employee_count || 0} employees</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(department)}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <HiOutlinePencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(department.id)}
                  className="p-2 text-gray-400 hover:text-red-600"
                >
                  <HiOutlineTrash className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Budget Allocated</span>
                  <span className="font-medium">{formatCurrency(department.allocated_budget) || '₹0'}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-perksu-purple h-2 rounded-full"
                    style={{
                      width: `${department.allocated_budget && masterPool?.balance ?
                        Math.min((department.allocated_budget / masterPool.balance) * 100, 100) : 0}%`
                    }}
                  ></div>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">Budget Used</span>
                  <span className="font-medium">{formatCurrency(department.spent_budget) || '₹0'}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{
                      width: `${department.allocated_budget && department.spent_budget ?
                        Math.min((department.spent_budget / department.allocated_budget) * 100, 100) : 0}%`
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingDepartment) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">
              {editingDepartment ? 'Edit Department' : 'Create Department'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-perksu-purple focus:border-transparent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Initial Budget Allocation (₹)
                </label>
                <input
                  type="number"
                  value={formData.allocated_budget}
                  onChange={(e) => setFormData({ ...formData, allocated_budget: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-perksu-purple focus:border-transparent"
                  min="0"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setEditingDepartment(null)
                    setFormData({ name: '', allocated_budget: 0 })
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="flex-1 px-4 py-2 bg-perksu-purple text-white rounded-lg hover:bg-perksu-purple/90 disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}