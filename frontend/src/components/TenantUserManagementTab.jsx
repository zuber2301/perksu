import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import './TenantTabs.css';

export default function TenantUserManagementTab({ tenant, setMessage }) {
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resettingId, setResettingId] = useState(null);

  useEffect(() => {
    fetchTenantManagers();
  }, [tenant.tenant_id]);

  const fetchTenantManagers = async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/tenants/admin/tenants/${tenant.tenant_id}/users`
      );
      setManagers(response.data);
    } catch (err) {
      setMessage({
        type: 'error',
        text: 'Failed to load managers',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPermissions = async (managerId) => {
    if (!window.confirm('Reset permissions for this manager?')) {
      return;
    }

    setResettingId(managerId);

    try {
      await api.post(
        `/tenants/admin/tenants/${tenant.tenant_id}/reset-manager-permissions?manager_id=${managerId}`
      );

      setMessage({
        type: 'success',
        text: 'Manager permissions reset successfully',
      });

      fetchTenantManagers();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to reset permissions',
      });
    } finally {
      setResettingId(null);
    }
  };

  const getStatusBadgeClass = (status) => {
    const classes = {
      active: 'badge-success',
      pending_invite: 'badge-warning',
      inactive: 'badge-gray',
      suspended: 'badge-danger',
    };
    return classes[status] || 'badge-default';
  };

  return (
    <div className="tab-user-management">
      <div className="user-management-header">
        <h2>Tenant Managers & Permissions</h2>
        <p className="subtitle">
          Manage administrative access and permissions for this tenant
        </p>
      </div>

      {loading ? (
        <div className="loading-state">Loading managers...</div>
      ) : managers.length === 0 ? (
        <div className="empty-state">
          <p>No managers found for this tenant</p>
        </div>
      ) : (
        <div className="managers-table-wrapper">
          <table className="managers-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Role</th>
                <th>Status</th>
                <th>Super Admin</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {managers.map((manager) => (
                <tr key={manager.id} className="admin-row">
                  <td className="email">
                    <code>{manager.email}</code>
                  </td>
                  <td className="name">{manager.name}</td>
                  <td className="role">
                    <span className="role-badge">{manager.role}</span>
                  </td>
                  <td className="status">
                    <span className={`badge ${getStatusBadgeClass(manager.status)}`}>
                      {manager.status}
                    </span>
                  </td>
                  <td className="super-admin">
                    <span className={manager.is_super_admin ? 'badge-success' : 'badge-gray'}>
                      {manager.is_super_admin ? '✓ Yes' : '✗ No'}
                    </span>
                  </td>
                  <td className="action">
                    <button
                      onClick={() => handleResetPermissions(manager.id)}
                      className="btn-reset"
                      disabled={resettingId === manager.id}
                      title="Reset this manager to default permissions"
                    >
                      {resettingId === manager.id ? 'Resetting...' : 'Reset'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Admin Access Policies */}
      <div className="access-policies">
        <h3>Admin Access Policies</h3>
        <div className="policy-info">
          <div className="policy-item">
            <strong>HR Admin:</strong>
            <p>Full access to user management, recognition, budgets, and reporting</p>
          </div>
          <div className="policy-item">
            <strong>Department Lead:</strong>
            <p>Can recognize team members, manage department, and view team wallets</p>
          </div>
          <div className="policy-item">
            <strong>User:</strong>
            <p>Can participate in recognition and redemption activities</p>
          </div>
        </div>
      </div>

      {/* Invite New Manager */}
      <div className="invite-admin-section">
        <h3>Add New Manager</h3>
        <p className="note">
          To add a new manager, invite them through the user management system.
          They will be created with manager role and can be elevated by a Super Admin.
        </p>
        <button className="btn-secondary" disabled>
          Invite New Manager (Coming Soon)
        </button>
      </div>
    </div>
  );
}
