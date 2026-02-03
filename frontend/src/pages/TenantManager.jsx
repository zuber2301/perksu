import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import TenantGrid from '../components/TenantGrid';
import TenantControlPanel from '../components/TenantControlPanel';
import '../../styles/admin.css';

export default function TenantManager() {
  const [tenants, setTenants] = useState([]);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [pageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [total, setTotal] = useState(0);

  // Fetch tenants list
  useEffect(() => {
    fetchTenants();
  }, [page, searchTerm, statusFilter]);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        skip: page * pageSize,
        limit: pageSize,
        search: searchTerm,
        status_filter: statusFilter,
      });

      const response = await api.get(`/tenants/admin/tenants?${params}`);
      setTenants(response.data.items);
      setTotal(response.data.total);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to fetch tenants');
      console.error('Error fetching tenants:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTenantSelect = (tenant) => {
    setSelectedTenant(tenant);
  };

  const handleClosePanel = () => {
    setSelectedTenant(null);
  };

  const handleTenantUpdate = () => {
    fetchTenants();
    setSelectedTenant(null);
  };

  const totalPages = Math.ceil(total / pageSize);

  if (selectedTenant) {
    return (
      <TenantControlPanel
        tenant={selectedTenant}
        onClose={handleClosePanel}
        onUpdate={handleTenantUpdate}
      />
    );
  }

  return (
    <div className="tenant-admin-container">
      <div className="admin-header">
        <h1>Tenant Manager</h1>
        <p className="subtitle">Manage all organizations on the Perksu platform</p>
      </div>

      {/* Search & Filter Bar */}
      <div className="search-filter-bar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by tenant name or slug..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(0);
            }}
            className="search-input"
          />
        </div>

        <div className="filter-controls">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
            className="filter-select"
          >
            <option value="">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="close-btn">×</button>
        </div>
      )}

      {/* Tenants Grid */}
      {loading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading tenants...</p>
        </div>
      ) : tenants.length === 0 ? (
        <div className="empty-state">
          <p>No tenants found</p>
        </div>
      ) : (
        <>
          <TenantGrid
            tenants={tenants}
            onTenantSelect={handleTenantSelect}
          />

          {/* Pagination */}
          <div className="pagination">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="pagination-btn"
            >
              ← Previous
            </button>

            <span className="pagination-info">
              Page {page + 1} of {totalPages} ({total} total)
            </span>

            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="pagination-btn"
            >
              Next →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
