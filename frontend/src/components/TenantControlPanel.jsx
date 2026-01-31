import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import TenantOverviewTab from './TenantOverviewTab';
import TenantSettingsTab from './TenantSettingsTab';
import TenantFinancialsTab from './TenantFinancialsTab';
import TenantUserManagementTab from './TenantUserManagementTab';
import TenantDangerZoneTab from './TenantDangerZoneTab';
import './TenantControlPanel.css';

export default function TenantControlPanel({ tenant, onClose, onUpdate }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  const tabs = [
    { id: 'overview', label: '📊 Overview', icon: 'chart' },
    { id: 'settings', label: '⚙️ Settings', icon: 'gear' },
    { id: 'financials', label: '💰 Financials', icon: 'dollar' },
    { id: 'users', label: '👥 User Management', icon: 'users' },
    { id: 'danger', label: '⚠️ Danger Zone', icon: 'alert' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <TenantOverviewTab
            tenant={tenant}
            onUpdate={handleUpdate}
          />
        );
      case 'settings':
        return (
          <TenantSettingsTab
            tenant={tenant}
            onUpdate={handleUpdate}
            setMessage={setMessage}
          />
        );
      case 'financials':
        return (
          <TenantFinancialsTab
            tenant={tenant}
            onUpdate={handleUpdate}
            setMessage={setMessage}
          />
        );
      case 'users':
        return (
          <TenantUserManagementTab
            tenant={tenant}
            setMessage={setMessage}
          />
        );
      case 'danger':
        return (
          <TenantDangerZoneTab
            tenant={tenant}
            onUpdate={handleUpdate}
            setMessage={setMessage}
            onClose={onClose}
          />
        );
      default:
        return null;
    }
  };

  const handleUpdate = async () => {
    setLoading(true);
    try {
      onUpdate();
      setMessage({ type: 'success', text: 'Updated successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Update failed',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="tenant-control-panel">
      {/* Header */}
      <div className="panel-header">
        <div className="header-content">
          <button onClick={onClose} className="btn-back">
            ← Back to Tenants
          </button>
          <div className="header-title">
            <h1>{tenant.tenant_name}</h1>
            <p className="tenant-slug">{tenant.slug}</p>
          </div>
        </div>
      </div>

      {/* Message Toast */}
      {message && (
        <div className={`message-toast ${message.type}`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="close-btn">×</button>
        </div>
      )}

      {/* Tabs Navigation */}
      <div className="tabs-navigation">
        <div className="tabs-list">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
              disabled={loading}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {renderTabContent()}
      </div>
    </div>
  );
}
