import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import './TenantTabs.css';

export default function TenantUserManagementTab({ tenant, setMessage }) {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resettingId, setResettingId] = useState(null);

  useEffect(() => {
    fetchTenantAdmins();
  }, [tenant.tenant_id]);

  const fetchTenantAdmins = async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/tenants/admin/tenants/${tenant.tenant_id}/users`
      );
      setAdmins(response.data);
    } catch (err) {
      setMessage({
        type: 'error',
        text: 'Failed to load admins',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPermissions = async (adminId) => {
    if (!window.confirm('Reset permissions for this admin?')) {
      return;
    }

    setResettingId(adminId);

    try {
      await api.post(
        `/tenants/admin/tenants/${tenant.tenant_id}/reset-admin-permissions?admin_id=${adminId}`
      );

      setMessage({
        type: 'success',
        text: 'Admin permissions reset successfully',
      });

      fetchTenantAdmins();
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
        <h2>Tenant Admins & Permissions</h2>
        <p className="subtitle">
          Manage administrative access and permissions for this tenant
        </p>
      </div>

      {loading ? (
        <div className="loading-state">Loading admins...</div>
      ) : admins.length === 0 ? (
        <div className="empty-state">
          <p>No admins found for this tenant</p>
        </div>
      ) : (
        <div className="admins-table-wrapper">
          <table className="admins-table">
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
              {admins.map((admin) => (
                <tr key={admin.id} className="admin-row">
                  <td className="email">
                    <code>{admin.email}</code>
                  </td>
                  <td className="name">{admin.name}</td>
                  <td className="role">
                    <span className="role-badge">{admin.role}</span>
                  </td>
                  <td className="status">
                    <span className={`badge ${getStatusBadgeClass(admin.status)}`}>
                      {admin.status}
                    </span>
                  </td>
                  <td className="super-admin">
                    <span className={admin.is_super_admin ? 'badge-success' : 'badge-gray'}>
                      {admin.is_super_admin ? '✓ Yes' : '✗ No'}
                    </span>
                  </td>
                  <td className="action">
                    <button
                      onClick={() => handleResetPermissions(admin.id)}
                      className="btn-reset"
                      disabled={resettingId === admin.id}
                      title="Reset this admin to default permissions"
                    >
                      {resettingId === admin.id ? 'Resetting...' : 'Reset'}
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
            <p>Full access to user management, recognition, and reporting</p>
          </div>
          <div className="policy-item">
            <strong>Manager:</strong>
            <p>Can recognize team members and view team wallets</p>
          </div>
          <div className="policy-item">
            <strong>Super Admin:</strong>
            <p>Complete access including budget control and settings</p>
          </div>
        </div>
      </div>

      {/* Invite New Admin */}
      <div className="invite-admin-section">
        <h3>Add New Admin</h3>
        <p className="note">
          To add a new admin, invite them through the user management system.
          They will be created with manager role and can be elevated by a Super Admin.
        </p>
        <button className="btn-secondary" disabled>
          Invite New Admin (Coming Soon)
        </button>
      </div>
    </div>
  );
}
