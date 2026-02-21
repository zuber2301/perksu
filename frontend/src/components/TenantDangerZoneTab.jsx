import React, { useState } from 'react';
import { api } from '../lib/api';
import './TenantTabs.css';

export default function TenantDangerZoneTab({
  tenant,
  onUpdate,
  setMessage,
  onClose,
}) {
  const [suspending, setSuspending] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleSuspendTenant = async () => {
    if (
      !window.confirm(
        'Are you sure you want to suspend this tenant? All users will lose access.'
      )
    ) {
      return;
    }

    setSuspending(true);

    try {
      await api.post(`/tenants/admin/tenants/${tenant.tenant_id}/suspend`);
      setMessage({
        type: 'success',
        text: 'Tenant suspended successfully',
      });
      onUpdate();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to suspend tenant',
      });
    } finally {
      setSuspending(false);
    }
  };

  const handleResumeTenant = async () => {
    if (!window.confirm('Resume this tenant and restore user access?')) {
      return;
    }

    setResuming(true);

    try {
      await api.post(`/tenants/admin/tenants/${tenant.tenant_id}/resume`);
      setMessage({
        type: 'success',
        text: 'Tenant resumed successfully',
      });
      onUpdate();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to resume tenant',
      });
    } finally {
      setResuming(false);
    }
  };

  const handleArchiveTenant = async () => {
    if (
      !window.confirm(
        'Archive this tenant? It will be converted to read-only mode and cannot be undone.'
      )
    ) {
      return;
    }

    setArchiving(true);

    try {
      await api.post(`/tenants/admin/tenants/${tenant.tenant_id}/archive`);
      setMessage({
        type: 'success',
        text: 'Tenant archived successfully',
      });
      setTimeout(() => onClose(), 2000);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to archive tenant',
      });
    } finally {
      setArchiving(false);
    }
  };

  const handleExportData = async () => {
    if (!window.confirm('Export all tenant data as CSV?')) {
      return;
    }

    setExporting(true);

    try {
      // In a real implementation, this would trigger a download
      const response = await api.get(
        `/tenants/admin/tenants/${tenant.tenant_id}/export`,
        { responseType: 'blob' }
      );

      const url = window.URL.createObjectURL(new Blob([response]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${tenant.slug}-export.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);

      setMessage({
        type: 'success',
        text: 'Data export started',
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to export data',
      });
    } finally {
      setExporting(false);
    }
  };

  const isSuspended = tenant.status === 'SUSPENDED';
  const isArchived = tenant.status === 'ARCHIVED';

  return (
    <div className="tab-danger-zone">
      <div className="danger-zone-header">
        <h1>⚠️ Danger Zone</h1>
        <p className="subtitle">
          Use these actions with caution. They can have significant impact on the tenant.
        </p>
      </div>

      {/* Status Alert */}
      {(isSuspended || isArchived) && (
        <div className="status-alert">
          <p>
            ⚠️ This tenant is currently <strong>{tenant.status.toLowerCase()}</strong>.
          </p>
        </div>
      )}

      {/* Suspend/Resume Section */}
      <div className="danger-action-card">
        <div className="action-header">
          <h2>{isSuspended ? '⏸️ Resume Tenant' : '🛑 Suspend Tenant'}</h2>
          <p className="action-description">
            {isSuspended
              ? 'Restore access for all users in this tenant'
              : 'Temporarily lock this tenant. Users will lose access immediately.'}
          </p>
        </div>

        {!isArchived && (
          <button
            onClick={isSuspended ? handleResumeTenant : handleSuspendTenant}
            className={`btn-danger ${isSuspended ? 'resume' : ''}`}
            disabled={isSuspended ? resuming : suspending}
          >
            {isSuspended
              ? resuming
                ? 'Resuming...'
                : 'Resume Tenant'
              : suspending
                ? 'Suspending...'
                : 'Suspend Tenant'}
          </button>
        )}
      </div>

      {/* Archive Section */}
      <div className="danger-action-card">
        <div className="action-header">
          <h2>📦 Archive Tenant</h2>
          <p className="action-description">
            Convert this tenant to read-only mode. No changes can be made after archiving.
            This action is permanent and cannot be undone.
          </p>
        </div>

        {!isArchived && (
          <button
            onClick={handleArchiveTenant}
            className="btn-danger archive"
            disabled={archiving}
          >
            {archiving ? 'Archiving...' : 'Archive Tenant'}
          </button>
        )}

        {isArchived && (
          <div className="archived-badge">
            ✓ This tenant is archived and read-only
          </div>
        )}
      </div>

      {/* Export Data Section */}
      <div className="danger-action-card">
        <div className="action-header">
          <h2>📤 Export All Data</h2>
          <p className="action-description">
            Download a complete backup of all tenant data including users, transactions,
            and recognition history in CSV format.
          </p>
        </div>

        <button
          onClick={handleExportData}
          className="btn-secondary"
          disabled={exporting}
        >
          {exporting ? 'Exporting...' : 'Export Data'}
        </button>
      </div>

      {/* Danger Zone Notes */}
      <div className="danger-notes">
        <h3>Important Notes</h3>
        <ul>
          <li>
            <strong>Suspend:</strong> Temporary measure. Users cannot access the platform,
            but all data is preserved.
          </li>
          <li>
            <strong>Archive:</strong> Permanent action. Tenant becomes read-only. Perfect
            for offboarded companies.
          </li>
          <li>
            <strong>Export:</strong> Create a backup of all tenant data before archiving.
          </li>
          <li>
            Contact support before performing these actions if unsure.
          </li>
        </ul>
      </div>
    </div>
  );
}
