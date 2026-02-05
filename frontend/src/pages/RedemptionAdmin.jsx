/**
 * Redemption Admin Dashboard
 * Platform admin panel for managing redemption requests, vendors, and analytics
 */

import React, { useState, useEffect } from 'react';
import {
  Package, TrendingUp, Clock, CheckCircle,
  AlertCircle, Settings, BarChart3, Truck,
  DollarSign, Users, FileText
} from 'lucide-react';
import api from '../lib/api';
import { formatNumber } from '../lib/currency';

export default function RedemptionAdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [analytics, setAnalytics] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [vendorBalances, setVendorBalances] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [analyticsRes, requestsRes, vendorsRes] = await Promise.all([
        api.get('/api/redemption/admin/analytics'),
        api.get('/api/redemption/admin/requests?status=PROCESSING'),
        api.get('/api/redemption/admin/vendor-balance')
      ]);

      setAnalytics(analyticsRes.data);
      setPendingRequests(requestsRes.data);
      setVendorBalances(vendorsRes.data);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Redemption Center</h1>
              <p className="text-sm text-slate-400">Manage points redemption system</p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-slate-700">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'requests', label: 'Pending Requests', icon: FileText },
              { id: 'vendors', label: 'Vendor Management', icon: Settings }
            ].map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 font-medium flex items-center gap-2 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-slate-400 hover:text-slate-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <OverviewTab analytics={analytics} />
        )}
        {activeTab === 'requests' && (
          <RequestsTab requests={pendingRequests} onUpdate={fetchDashboardData} />
        )}
        {activeTab === 'vendors' && (
          <VendorsTab vendorBalances={vendorBalances} />
        )}
      </div>
    </div>
  );
}

function OverviewTab({ analytics }) {
  if (!analytics) return null;

  const stats = [
    {
      label: 'Total Redemptions',
      value: analytics.total_redemptions,
      icon: Package,
      color: 'from-blue-500 to-blue-600'
    },
    {
      label: 'Points Redeemed',
      value: formatNumber(analytics.total_points_redeemed),
      icon: TrendingUp,
      color: 'from-green-500 to-green-600'
    },
    {
      label: 'Revenue Generated',
      value: `₹${Math.round(analytics.total_revenue)}`,
      icon: DollarSign,
      color: 'from-purple-500 to-purple-600'
    },
    {
      label: 'Pending Orders',
      value: analytics.pending_requests,
      icon: Clock,
      color: 'from-yellow-500 to-yellow-600'
    },
    {
      label: 'Fulfilled Orders',
      value: analytics.fulfilled_orders,
      icon: CheckCircle,
      color: 'from-emerald-500 to-emerald-600'
    }
  ];

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div
              key={idx}
              className="bg-gradient-to-br from-slate-800 to-slate-700 border border-slate-700 rounded-lg p-6"
            >
              <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center mb-4`}>
                <Icon className="h-6 w-6 text-white" />
              </div>
              <p className="text-slate-400 text-sm mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Top Items */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-700 border border-slate-700 rounded-lg p-6">
        <h3 className="text-xl font-bold text-white mb-4">Top Redeemed Items</h3>
        <div className="space-y-3">
          {analytics.top_items.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-sm font-bold text-slate-400 w-8">#{idx + 1}</span>
                <span className="text-white">{item[0]}</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="w-48 h-2 bg-slate-600 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                    style={{
                      width: `${(item[1] / Math.max(...analytics.top_items.map(i => i[1]))) * 100}%`
                    }}
                  ></div>
                </div>
                <span className="text-white font-bold w-12 text-right">{item[1]}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RequestsTab({ requests, onUpdate }) {
  const [selectedStatus, setSelectedStatus] = useState('PROCESSING');
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [updateStatus, setUpdateStatus] = useState('');
  const [tracking, setTracking] = useState('');

  const handleUpdateRequest = async () => {
    try {
      await api.put(`/api/redemption/admin/requests/${selectedRequest.id}`, {
        status: updateStatus,
        tracking_number: tracking
      });
      onUpdate();
      setShowUpdateModal(false);
      setSelectedRequest(null);
    } catch (error) {
      console.error('Failed to update request:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status Filter */}
      <div className="flex gap-2">
        {['PROCESSING', 'SHIPPED', 'COMPLETED', 'FAILED'].map(status => (
          <button
            key={status}
            onClick={() => setSelectedStatus(status)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedStatus === status
                ? 'bg-blue-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Requests Table */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-700 border border-slate-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-900 border-b border-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">User</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Item</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Type</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Date</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-slate-300">Status</th>
                <th className="px-6 py-3 text-right text-sm font-semibold text-slate-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {requests.filter(r => r.status === selectedStatus).map(request => (
                <tr key={request.id} className="hover:bg-slate-700 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-medium text-white">{request.user_name}</p>
                      <p className="text-sm text-slate-400">{request.user_email}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-white">{request.item_name}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 text-sm font-medium rounded-full bg-slate-600 text-slate-100">
                      {request.delivery_details?.type || 'N/A'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-300">
                    {new Date(request.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                      request.status === 'PROCESSING'
                        ? 'bg-yellow-900 text-yellow-200'
                        : request.status === 'SHIPPED'
                        ? 'bg-blue-900 text-blue-200'
                        : request.status === 'COMPLETED'
                        ? 'bg-green-900 text-green-200'
                        : 'bg-red-900 text-red-200'
                    }`}>
                      {request.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => {
                        setSelectedRequest(request);
                        setShowUpdateModal(true);
                      }}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
                    >
                      Update
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Update Modal */}
      {showUpdateModal && selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">Update Request</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                <select
                  value={updateStatus}
                  onChange={(e) => setUpdateStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select status</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="SHIPPED">Shipped</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="FAILED">Failed</option>
                </select>
              </div>

              {updateStatus === 'SHIPPED' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Tracking Number</label>
                  <input
                    type="text"
                    value={tracking}
                    onChange={(e) => setTracking(e.target.value)}
                    placeholder="Enter tracking number"
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 text-white rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowUpdateModal(false)}
                  className="flex-1 px-4 py-2 border border-slate-600 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateRequest}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function VendorsTab({ vendorBalances }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {vendorBalances.map(vendor => (
        <div key={vendor.vendor_name} className="bg-gradient-to-br from-slate-800 to-slate-700 border border-slate-700 rounded-lg p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm text-slate-400">{vendor.api_partner}</p>
              <h3 className="text-xl font-bold text-white">{vendor.vendor_name}</h3>
            </div>
            <AlertCircle className="h-5 w-5 text-yellow-400" />
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm text-slate-400">Current Balance</p>
              <p className="text-2xl font-bold text-green-400">₹{Math.round(vendor.current_balance)}</p>
            </div>

            <div>
              <p className="text-sm text-slate-400">Synced</p>
              <p className="text-sm text-slate-300">
                {vendor.last_synced_at
                  ? new Date(vendor.last_synced_at).toLocaleString()
                  : 'Never'}
              </p>
            </div>

            <button className="w-full mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors">
              Sync Balance
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
