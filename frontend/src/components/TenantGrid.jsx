import React from 'react';
import './TenantGrid.css';

export default function TenantGrid({ tenants, onTenantSelect }) {
  const getStatusBadgeClass = (status) => {
    const classes = {
      ACTIVE: 'badge-success',
      SUSPENDED: 'badge-warning',
      ARCHIVED: 'badge-info',
    };
    return classes[status] || 'badge-default';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="tenant-grid-wrapper">
      <table className="tenant-grid">
        <thead>
          <tr>
            <th>Tenant Name</th>
            <th>Slug</th>
            <th>Active Users</th>
            <th>Master Balance</th>
            <th>Status</th>
            <th>Last Activity</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((tenant) => (
            <tr key={tenant.tenant_id} className="tenant-row">
              <td className="tenant-name">
                <button className="tenant-link" onClick={() => onTenantSelect(tenant)}>
                  {tenant.tenant_name}
                </button>
              </td>
              <td className="tenant-slug">
                <code>{tenant.slug}</code>
              </td>
              <td className="active-users">
                <span className="user-count">{tenant.active_users}</span>
              </td>
              <td className="master-balance">
                {formatCurrency(tenant.master_balance)}
              </td>
              <td className="status-cell">
                <span className={`badge ${getStatusBadgeClass(tenant.status)}`}>
                  {tenant.status}
                </span>
              </td>
              <td className="last-activity">
                {tenant.last_activity
                  ? formatDate(tenant.last_activity)
                  : 'N/A'}
              </td>
              <td className="action-cell">
                <button
                  onClick={() => onTenantSelect(tenant)}
                  className="btn-details"
                  title="View/Edit Details"
                >
                  Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
