import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { rewardsAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'
import { 
  HiOutlineGift, 
  HiOutlinePlus, 
  HiOutlineAdjustmentsHorizontal, 
  HiOutlineEye, 
  HiOutlineEyeSlash,
  HiOutlinePencilSquare,
  HiOutlineTrash,
  HiOutlineInboxStack,
  HiOutlineCheckCircle
} from 'react-icons/hi2'
import toast from 'react-hot-toast'
import { formatCurrency } from '../lib/currency'

export default function RewardsAdmin() {
  const { user, activeRole } = useAuthStore()
  const isPlatformAdmin = activeRole === 'platform_admin'
  const isHRAdmin = activeRole === 'hr_admin'
  const queryClient = useQueryClient()
  
  const [activeTab, setActiveTab] = useState(isPlatformAdmin ? 'master' : 'visibility')
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showCreateMasterModal, setShowCreateMasterModal] = useState(false)
  const [showCreateCustomModal, setShowCreateCustomModal] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)

  // Fetch Full Catalog
  const { data: catalog, isLoading } = useQuery({
    queryKey: ['rewards-catalog-admin'],
    queryFn: () => rewardsAPI.getCatalog({ page_size: 200 }),
  })

  // Mutations
  const configMutation = useMutation({
    mutationFn: ({ id, data }) => rewardsAPI.configureMasterItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['rewards-catalog-admin'])
      toast.success('Configuration updated')
      setShowConfigModal(false)
    }
  })

  const createMasterMutation = useMutation({
    mutationFn: (data) => rewardsAPI.createMasterItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['rewards-catalog-admin'])
      toast.success('Master item added')
      setShowCreateMasterModal(false)
    }
  })

  const createCustomMutation = useMutation({
    mutationFn: (data) => rewardsAPI.createCustomItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['rewards-catalog-admin'])
      toast.success('Custom perk added')
      setShowCreateCustomModal(false)
    }
  })

  if (isLoading) return <div className="p-8 text-center">Loading catalog...</div>

  const masterItems = catalog?.items.filter(i => i.source_type === 'MASTER') || []
  const customItems = catalog?.items.filter(i => i.source_type === 'CUSTOM') || []

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Rewards Management</h1>
          <p className="text-gray-500 font-medium">
            {isPlatformAdmin ? 'Global Supply & Catalog Control' : 'Tenant Visibility & Custom Perks'}
          </p>
        </div>
        
        <div className="flex gap-3">
          {isPlatformAdmin && (
            <button 
              onClick={() => setShowCreateMasterModal(true)}
              className="btn btn-primary flex items-center gap-2"
            >
              <HiOutlinePlus className="w-5 h-5" /> Add Global Item
            </button>
          )}
          {isHRAdmin && (
            <button 
              onClick={() => setShowCreateCustomModal(true)}
              className="btn bg-perksu-purple text-white hover:bg-perksu-purple/90 flex items-center gap-2"
            >
              <HiOutlinePlus className="w-5 h-5" /> Add Internal Perk
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6 bg-white rounded-t-xl px-4 pt-4 shadow-sm">
        {isPlatformAdmin && (
          <button 
            className={`px-6 py-3 font-bold text-sm tracking-widest uppercase border-b-2 transition-all ${activeTab === 'master' ? 'border-perksu-purple text-perksu-purple' : 'border-transparent text-gray-400'}`}
            onClick={() => setActiveTab('master')}
          >
            Global Supply
          </button>
        )}
        <button 
          className={`px-6 py-3 font-bold text-sm tracking-widest uppercase border-b-2 transition-all ${activeTab === 'visibility' ? 'border-perksu-purple text-perksu-purple' : 'border-transparent text-gray-400'}`}
          onClick={() => setActiveTab('visibility')}
        >
          Visibility & Policy
        </button>
        <button 
          className={`px-6 py-3 font-bold text-sm tracking-widest uppercase border-b-2 transition-all ${activeTab === 'perks' ? 'border-perksu-purple text-perksu-purple' : 'border-transparent text-gray-400'}`}
          onClick={() => setActiveTab('perks')}
        >
          Internal Perks
        </button>
      </div>

      {/* Content */}
      <div className="card overflow-hidden">
        {activeTab === 'visibility' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Brand / Item</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Global Range</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tenant Limit</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {masterItems.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={item.image_url || 'https://via.placeholder.com/40'} className="w-10 h-10 rounded-lg object-cover bg-gray-100" />
                        <div>
                          <p className="font-bold text-gray-900">{item.name}</p>
                          <p className="text-xs text-gray-500">{item.category}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-gray-600">
                      {formatCurrency(item.min_points)} - {formatCurrency(item.max_points)}
                    </td>
                    <td className="px-6 py-4 font-bold text-gray-900">
                      {formatCurrency(item.min_points)} - {formatCurrency(item.max_points)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {item.is_active ? (
                        <span className="badge badge-success flex items-center gap-1"><HiOutlineCheckCircle className="w-3 h-3"/> Active</span>
                      ) : (
                        <span className="badge badge-gray">Hidden</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => { setSelectedItem(item); setShowConfigModal(true); }}
                        className="p-2 text-gray-400 hover:text-perksu-purple hover:bg-perksu-purple/10 rounded-lg transition-colors"
                      >
                        <HiOutlineAdjustmentsHorizontal className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'perks' && (
          <div className="p-6">
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {customItems.map(item => (
                  <div key={item.id} className="border border-gray-100 rounded-2xl p-4 hover:border-perksu-purple/30 hover:shadow-md transition-all">
                    <div className="aspect-video mb-4 rounded-xl overflow-hidden bg-gray-50">
                      <img src={item.image_url || 'https://via.placeholder.com/150'} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex justify-between items-start mb-2">
                       <h3 className="font-bold text-lg text-gray-900">{item.name}</h3>
                       <span className="text-perksu-purple font-bold">{formatCurrency(item.points_cost)}</span>
                    </div>
                    <p className="text-sm text-gray-500 mb-4 line-clamp-2">{item.description}</p>
                    <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50">
                      <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                        <HiOutlineInboxStack className="w-4 h-4" />
                        {item.inventory_count === null ? 'INFINITE' : `${item.inventory_count} LEFT`}
                      </div>
                      <div className="flex gap-2">
                         <button className="p-2 text-gray-400 hover:text-perksu-purple transition-colors"><HiOutlinePencilSquare className="w-5 h-5"/></button>
                         <button className="p-2 text-gray-400 hover:text-red-500 transition-colors"><HiOutlineTrash className="w-5 h-5"/></button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {customItems.length === 0 && (
                   <div className="col-span-full py-12 text-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                      <HiOutlineGift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 font-medium">No internal perks yet</p>
                      <button onClick={() => setShowCreateCustomModal(true)} className="mt-4 text-perksu-purple font-bold hover:underline">Create your first perk</button>
                   </div>
                )}
             </div>
          </div>
        )}

        {activeTab === 'master' && isPlatformAdmin && (
           <div className="p-8 text-center text-gray-500 uppercase font-black tracking-widest py-24">
              Master Global Catalog Management Panel
              <div className="mt-4 text-sm font-normal normal-case text-gray-400">Manage provider SKUs, API connections and global point ratios.</div>
           </div>
        )}
      </div>

      {/* CONFIG MODAL (Tenant Policy) */}
      {showConfigModal && selectedItem && (
        <div className="modal-overlay">
          <div className="modal-content max-w-lg">
            <h2 className="text-xl font-bold mb-4">Configure Global Item</h2>
            <p className="text-sm text-gray-500 mb-6">Set visibility and override points range for your organization.</p>
            
            <form onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.target)
              configMutation.mutate({
                id: selectedItem.id,
                data: {
                  is_enabled: formData.get('is_enabled') === 'true',
                  custom_min_points: parseInt(formData.get('min')),
                  custom_max_points: parseInt(formData.get('max')),
                }
              })
            }}>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                   <div>
                      <p className="font-bold text-gray-900">Enable in Marketplace</p>
                      <p className="text-xs text-gray-500">Allow employees to see and redeem this item</p>
                   </div>
                   <input type="checkbox" name="is_enabled" defaultChecked={selectedItem.is_active} value="true" className="w-6 h-6 rounded border-gray-300 text-perksu-purple focus:ring-perksu-purple" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Custom Min Points</label>
                    <input type="number" name="min" defaultValue={selectedItem.min_points} className="input" step="1" />
                  </div>
                  <div>
                    <label className="label">Custom Max Points</label>
                    <input type="number" name="max" defaultValue={selectedItem.max_points} className="input" step="1" />
                  </div>
                </div>

                <div className="p-4 bg-blue-50 text-blue-700 text-xs rounded-xl">
                  Points must be within Global Range: {formatCurrency(selectedItem.min_points)} - {formatCurrency(selectedItem.max_points)}
                </div>

                <div className="flex gap-3 pt-4">
                  <button type="button" onClick={() => setShowConfigModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                  <button type="submit" className="btn btn-primary flex-1">Save Configuration</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE MASTER MODAL */}
      {showCreateMasterModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-xl">
            <h2 className="text-xl font-bold mb-6">Add Global Catalog Item</h2>
            <form onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.target)
              createMasterMutation.mutate({
                name: formData.get('name'),
                brand: formData.get('brand'),
                category: formData.get('category'),
                description: formData.get('description'),
                image_url: formData.get('image_url'),
                fulfillment_type: formData.get('fulfillment_type'),
                provider_code: formData.get('provider_code'),
                min_points: parseInt(formData.get('min')),
                max_points: parseInt(formData.get('max')),
                step_points: parseInt(formData.get('step')),
                points_per_rupee: parseInt(formData.get('ppr')),
              })
            }}>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Name</label>
                  <input name="name" className="input" placeholder="Amazon Pay Gift Card" required />
                </div>
                <div>
                  <label className="label">Brand</label>
                  <input name="brand" className="input" placeholder="Amazon" />
                </div>
                <div>
                  <label className="label">Category</label>
                  <input name="category" className="input" placeholder="Gift Card" required />
                </div>
                <div className="col-span-2">
                  <label className="label">Image URL</label>
                  <input name="image_url" className="input" placeholder="https://..." />
                </div>
                <div>
                  <label className="label">Fulfillment Type</label>
                  <select name="fulfillment_type" className="input">
                    <option value="GIFT_CARD_API">API-Integrated (Voucher)</option>
                    <option value="MANUAL">Manual Fulfillment</option>
                  </select>
                </div>
                <div>
                  <label className="label">Provider Code / SKU</label>
                  <input name="provider_code" className="input" placeholder="e.g. AMZ-INR-100" />
                </div>
                <div>
                    <label className="label">Min Points</label>
                    <input type="number" name="min" className="input" defaultValue="500" step="1" />
                  </div>
                  <div>
                    <label className="label">Max Points</label>
                    <input type="number" name="max" className="input" defaultValue="10000" step="1" />
                  </div>
                  <div>
                    <label className="label">Step Points</label>
                    <input type="number" name="step" className="input" defaultValue="500" step="1" />
                  </div>
                  <div>
                    <label className="label">Pts Per Rupee</label>
                    <input type="number" name="ppr" className="input" defaultValue="1" step="1" />
                  </div>
              </div>
              <div className="flex gap-3 pt-8">
                <button type="button" onClick={() => setShowCreateMasterModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn btn-primary flex-1">Create Item</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE CUSTOM MODAL */}
      {showCreateCustomModal && (
        <div className="modal-overlay">
          <div className="modal-content max-w-lg">
            <h2 className="text-xl font-bold mb-6">Create Internal Perk</h2>
            <form onSubmit={(e) => {
              e.preventDefault()
              const formData = new FormData(e.target)
              createCustomMutation.mutate({
                name: formData.get('name'),
                category: formData.get('category'),
                description: formData.get('description'),
                image_url: formData.get('image_url'),
                points_cost: parseInt(formData.get('points')),
                inventory_count: formData.get('inventory') ? parseInt(formData.get('inventory')) : null,
                fulfillment_type: formData.get('fulfillment') || 'INVENTORY_ITEM',
              })
            }}>
              <div className="space-y-4">
                <div>
                  <label className="label">Item Name</label>
                  <input name="name" className="input" placeholder="Pizza Party Voucher" required />
                </div>
                <div>
                  <label className="label">Category</label>
                  <input name="category" className="input" defaultValue="Team Perks" required />
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea name="description" className="input min-h-[100px]" placeholder="Brief description for users..."></textarea>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Point Cost (₹)</label>
                    <input type="number" name="points" className="input" step="1" required />
                  </div>
                  <div>
                    <label className="label">Initial Stock (Optional)</label>
                    <input type="number" name="inventory" className="input" placeholder="Infinite" step="1" />
                  </div>
                </div>
                <div className="flex gap-3 pt-6">
                  <button type="button" onClick={() => setShowCreateCustomModal(false)} className="btn btn-secondary flex-1">Cancel</button>
                  <button type="submit" className="btn btn-primary flex-1">Add to Marketplace</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
