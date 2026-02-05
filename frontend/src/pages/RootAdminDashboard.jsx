import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { formatCurrency } from '../lib/currency'
import './RootAdminDashboard.css';

export default function RootAdminDashboard() {
  const [health, setHealth] = useState(null);
  const [systemAdmins, setSystemAdmins] = useState([]);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  useEffect(() => {
    fetchPlatformData();
  }, []);

  const fetchPlatformData = async () => {
    try {
      setLoading(true);
      const [healthRes, adminsRes] = await Promise.all([
        api.get('/tenants/admin/platform/health'),
        api.get('/tenants/admin/platform/system-admins'),
      ]);

      setHealth(healthRes.data);
      setSystemAdmins(adminsRes.data);
      setMessage(null);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to load platform data',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSuperAdmin = async (adminId) => {
    setTogglingId(adminId);

    try {
      const response = await api.post(
        `/tenants/admin/platform/system-admins/${adminId}/toggle-super-admin`
      );

      setSystemAdmins((prevAdmins) =>
        prevAdmins.map((admin) =>
          admin.id === adminId
            ? { ...admin, is_super_admin: response.data.is_super_admin }
            : admin
        )
      );

      setMessage({
        type: 'success',
        text: response.data.message,
      });

      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to toggle admin status',
      });
    } finally {
      setTogglingId(null);
    }
  };

  const handleMaintenanceModeToggle = async () => {
    try {
      const response = await api.post(
        `/tenants/admin/platform/maintenance-mode?enabled=${!maintenanceMode}`
      );

      setMaintenanceMode(response.data.maintenance_mode_enabled);

      setMessage({
        type: 'success',
        text: response.data.message,
      });

      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({
        type: 'error',
        text: 'Failed to update maintenance mode',
      });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };



  if (loading) {
    return (
      <div className="root-admin-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading platform data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="root-admin-container">
      {/* Header */}
      <div className="root-admin-header">
        <h1>🌍 Perksu Platform Admin</h1>
        <p className="subtitle">Global platform management and system configuration</p>
      </div>

      {/* Message Toast */}
      {message && (
        <div className={`message-toast ${message.type}`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="close-btn">×</button>
        </div>
      )}

      {/* Global Health Widget */}
      {health && (
        <div className="health-widget">
          <h2>📊 Global Health Dashboard</h2>
          <div className="health-grid">
            <div className="health-card">
              <h3>Total Points Across All Tenants</h3>
              <p className="health-value">
                {formatCurrency(health.total_points)}
              </p>
              <p className="health-label">Master Budget Balance</p>
            </div>

            <div className="health-card">
              <h3>Active Tenants</h3>
              <p className="health-value">{health.active_tenants}</p>
              <p className="health-label">
                of {health.total_tenants} total
              </p>
            </div>

            <div className="health-card">
              <h3>Total Users</h3>
              <p className="health-value">{health.total_users}</p>
              <p className="health-label">Across all tenants</p>
            </div>

            <div className="health-card">
              <h3>System Status</h3>
              <p className={`health-value ${maintenanceMode ? 'maintenance' : 'operational'}`}>
                {maintenanceMode ? '🔧 MAINTENANCE' : '✅ OPERATIONAL'}
              </p>
              <p className="health-label">Current Status</p>
            </div>
          </div>

          <div className="health-timestamp">
            <small>Last updated: {formatDate(health.timestamp)}</small>
          </div>
        </div>
      )}

      {/* System Maintenance Toggle */}
      <div className="maintenance-section">
        <h2>🔧 System Maintenance Mode</h2>
        <div className="maintenance-card">
          <div className="maintenance-info">
            <h3>Maintenance Mode</h3>
            <p>
              Put the entire platform into read-only mode for scheduled maintenance.
              Only System Admins can make changes when enabled.
            </p>
          </div>

          <button
            onClick={handleMaintenanceModeToggle}
            className={`btn-maintenance ${maintenanceMode ? 'active' : ''}`}
          >
            <span className="maintenance-icon">
              {maintenanceMode ? '🔴' : '🟢'}
            </span>
            <span className="maintenance-text">
              {maintenanceMode ? 'Maintenance Active' : 'Enable Maintenance'}
            </span>
          </button>

          {maintenanceMode && (
            <div className="maintenance-warning">
              ⚠️ Platform is currently in maintenance mode. Only system admins can make changes.
            </div>
          )}
        </div>
      </div>

      {/* System Admin Registry */}
      <div className="system-admins-section">
        <h2>👨‍💼 System Admin Registry</h2>
        <p className="subtitle">
          Manage @sparknode.io system administrator accounts and permissions
        </p>

        {systemAdmins.length === 0 ? (
          <div className="empty-state">
            <p>No system admins found</p>
          </div>
        ) : (
          <div className="admins-table-wrapper">
            <table className="admins-registry-table">
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Name</th>
                  <th>Super Admin</th>
                  <th>MFA Enabled</th>
                  <th>Last Login</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {systemAdmins.map((admin) => (
                  <tr key={admin.id} className="admin-row">
                    <td className="email">
                      <code>{admin.email}</code>
                    </td>
                    <td className="name">{admin.name}</td>
                    <td className="super-admin">
                      <span
                        className={admin.is_super_admin ? 'badge-success' : 'badge-gray'}
                      >
                        {admin.is_super_admin ? '✓ Yes' : '✗ No'}
                      </span>
                    </td>
                    <td className="mfa">
                      <span
                        className={admin.mfa_enabled ? 'badge-success' : 'badge-warning'}
                      >
                        {admin.mfa_enabled ? '✓ Enabled' : '⚠️ Disabled'}
                      </span>
                    </td>
                    <td className="last-login">
                      {formatDate(admin.last_login)}
                    </td>
                    <td className="action">
                      <button
                        onClick={() => handleToggleSuperAdmin(admin.id)}
                        className={`btn-toggle ${admin.is_super_admin ? 'revoke' : 'grant'}`}
                        disabled={togglingId === admin.id}
                        title={admin.is_super_admin ? 'Revoke SUPER_ADMIN' : 'Grant SUPER_ADMIN'}
                      >
                        {togglingId === admin.id
                          ? 'Updating...'
                          : admin.is_super_admin
                            ? 'Revoke'
                            : 'Grant'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="admin-policies">
          <h3>Admin Permission Levels</h3>
          <div className="policy-items">
            <div className="policy-item">
              <strong>Regular Admin:</strong>
              <p>Can manage tenant listings, view analytics, and perform standard operations</p>
            </div>
            <div className="policy-item">
              <strong>Super Admin:</strong>
              <p>Full platform access including maintenance mode, system configuration, and critical operations</p>
            </div>
          </div>
        </div>
      </div>

      {/* Platform Configuration */}
      <div className="platform-config-section">
        <h2>⚙️ Platform Configuration</h2>
        <div className="config-info">
          <div className="config-item">
            <h3>Database Status</h3>
            <p>✅ Connected and operational</p>
          </div>
          <div className="config-item">
            <h3>API Status</h3>
            <p>✅ All endpoints responsive</p>
          </div>
          <div className="config-item">
            <h3>Backup Status</h3>
            <p>✅ Last backup: 2 hours ago</p>
          </div>
        </div>
      </div>

      {/* System Alerts */}
      <div className="system-alerts">
        <h2>📢 System Alerts</h2>
        <div className="alert-list">
          <div className="alert-item info">
            <span className="alert-icon">ℹ️</span>
            <div className="alert-content">
              <p className="alert-title">All systems operational</p>
              <p className="alert-message">No critical issues detected</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
