import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { marketplaceAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import {
  HiOutlineShoppingBag,
  HiOutlinePlus,
  HiOutlinePencil,
  HiOutlineTrash,
  HiOutlineTag,
  HiOutlineCurrencyRupee,
  HiOutlineFilter,
  HiOutlineSearch
} from 'react-icons/hi'
import { formatCurrency } from '../lib/currency'

export default function Marketplace() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [selectedBrand, setSelectedBrand] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    base_price: 0,
    markup_percentage: 0,
    brand_id: '',
    image_url: '',
    category: ''
  })

  // Fetch marketplace items
  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ['marketplace-items'],
    queryFn: () => marketplaceAPI.getAll(),
  })

  // Fetch brands for filtering
  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: () => marketplaceAPI.getBrands(),
  })

  // Fetch markup settings
  const { data: markupSettings } = useQuery({
    queryKey: ['markup-settings'],
    queryFn: () => marketplaceAPI.getMarkupSettings(),
  })

  const createMutation = useMutation({
    mutationFn: (data) => marketplaceAPI.createItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['marketplace-items'])
      toast.success('Item added to marketplace successfully')
      setShowCreateModal(false)
      resetForm()
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to add item')
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => marketplaceAPI.updateItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['marketplace-items'])
      toast.success('Item updated successfully')
      setEditingItem(null)
      resetForm()
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to update item')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => marketplaceAPI.deleteItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['marketplace-items'])
      toast.success('Item removed from marketplace')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to remove item')
    }
  })

  const updateMarkupMutation = useMutation({
    mutationFn: (data) => marketplaceAPI.updateMarkupSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['markup-settings'])
      toast.success('Markup settings updated')
    },
    onError: (error) => {
      toast.error(error.response?.data?.detail || 'Failed to update markup settings')
    }
  })

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      base_price: 0,
      markup_percentage: 0,
      brand_id: '',
      image_url: '',
      category: ''
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData })
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleEdit = (item) => {
    setEditingItem(item)
    setFormData({
      name: item.name,
      description: item.description || '',
      base_price: item.base_price,
      markup_percentage: item.markup_percentage || 0,
      brand_id: item.brand_id || '',
      image_url: item.image_url || '',
      category: item.category || ''
    })
  }

  const handleDelete = (itemId) => {
    if (window.confirm('Are you sure you want to remove this item from the marketplace?')) {
      deleteMutation.mutate(itemId)
    }
  }

  const handleMarkupUpdate = (brandId, percentage) => {
    updateMarkupMutation.mutate({ brand_id: brandId, markup_percentage: percentage })
  }

  // Filter items based on brand and search
  const filteredItems = items?.filter(item => {
    const matchesBrand = selectedBrand === 'all' || item.brand_id === selectedBrand
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesBrand && matchesSearch
  })

  if (itemsLoading) {
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
          <h1 className="text-2xl font-bold text-gray-900">Marketplace & Rewards</h1>
          <p className="text-gray-600 mt-1">
            Manage reward items and set markup percentages by brand
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn-primary flex items-center gap-2"
        >
          <HiOutlinePlus className="w-5 h-5" />
          Add Item
        </button>
      </div>

      {/* Markup Settings */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Brand Markup Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {brands?.map((brand) => {
            const currentMarkup = markupSettings?.find(s => s.brand_id === brand.id)?.markup_percentage || 0
            return (
              <div key={brand.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-900">{brand.name}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={currentMarkup}
                    onChange={(e) => handleMarkupUpdate(brand.id, parseFloat(e.target.value) || 0)}
                    className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                    min="0"
                    step="0.1"
                  />
                  <span className="text-sm text-gray-600">%</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <HiOutlineSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search items..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-perksu-purple focus:border-transparent"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-perksu-purple focus:border-transparent"
            >
              <option value="all">All Brands</option>
              {brands?.map((brand) => (
                <option key={brand.id} value={brand.id}>{brand.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Items Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems?.map((item) => {
          const brand = brands?.find(b => b.id === item.brand_id)
          const markup = markupSettings?.find(s => s.brand_id === item.brand_id)?.markup_percentage || 0
          const finalPrice = item.base_price * (1 + markup / 100)

          return (
            <div key={item.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              {item.image_url && (
                <img
                  src={item.image_url}
                  alt={item.name}
                  className="w-full h-48 object-cover"
                />
              )}
              <div className="p-6">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{item.name}</h3>
                    {brand && (
                      <p className="text-sm text-gray-500">{brand.name}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(item)}
                      className="p-2 text-gray-400 hover:text-gray-600"
                    >
                      <HiOutlinePencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="p-2 text-gray-400 hover:text-red-600"
                    >
                      <HiOutlineTrash className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {item.description && (
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">{item.description}</p>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-lg font-bold text-gray-900">{formatCurrency(finalPrice)}</div>
                    <div className="text-sm text-gray-500">
                      Base: {formatCurrency(item.base_price)} (+{markup}%)
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Category</div>
                    <div className="text-sm font-medium">{item.category || 'General'}</div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Create/Edit Modal */}
      {(showCreateModal || editingItem) && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">
              {editingItem ? 'Edit Item' : 'Add Marketplace Item'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Item Name *
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
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-perksu-purple focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Base Price (₹) *
                  </label>
                  <input
                    type="number"
                    value={formData.base_price}
                    onChange={(e) => setFormData({ ...formData, base_price: parseInt(e.target.value, 10) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-perksu-purple focus:border-transparent"
                    min="0"
                    step="1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Brand
                  </label>
                  <select
                    value={formData.brand_id}
                    onChange={(e) => setFormData({ ...formData, brand_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-perksu-purple focus:border-transparent"
                  >
                    <option value="">Select Brand</option>
                    {brands?.map((brand) => (
                      <option key={brand.id} value={brand.id}>{brand.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-perksu-purple focus:border-transparent"
                  placeholder="e.g., Electronics, Food, Gift Cards"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Image URL
                </label>
                <input
                  type="url"
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-perksu-purple focus:border-transparent"
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setEditingItem(null)
                    resetForm()
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