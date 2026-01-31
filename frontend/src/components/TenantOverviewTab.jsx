import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import './TenantTabs.css';

export default function TenantOverviewTab({ tenant, onUpdate }) {
  const [burnRate, setBurnRate] = useState(null);
  const [engagementData, setEngagementData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching burn rate and engagement metrics
    // In a real app, this would come from an API endpoint
    simulateBurnRateData();
  }, [tenant.tenant_id]);

  const simulateBurnRateData = () => {
    setLoading(true);
    // Simulated data - replace with actual API call
    setBurnRate({
      dailyRate: 450.00,
      weeklyRate: 2850.00,
      monthlyProjection: 12500.00,
      daysUntilRefill: 8,
    });

    setEngagementData({
      recognitionsThisMonth: 123,
      redemptionsThisMonth: 45,
      activeUsersThisWeek: 87,
      avgPointsPerEmployee: 2500,
    });

    setLoading(false);
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getHealthStatus = () => {
    const { daysUntilRefill } = burnRate;
    if (daysUntilRefill > 30) return { status: 'healthy', color: '#10b981' };
    if (daysUntilRefill > 10) return { status: 'warning', color: '#f59e0b' };
    return { status: 'critical', color: '#ef4444' };
  };

  if (loading) {
    return <div className="loading-state">Loading overview...</div>;
  }

  const health = getHealthStatus();

  return (
    <div className="tab-overview">
      {/* Quick Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>Master Balance</h3>
          <p className="stat-value">
            {formatCurrency(tenant.master_balance)}
          </p>
          <p className="stat-label">Available Points</p>
        </div>

        <div className="stat-card">
          <h3>Daily Burn Rate</h3>
          <p className="stat-value">
            {formatCurrency(burnRate.dailyRate)}
          </p>
          <p className="stat-label">Daily Points Used</p>
        </div>

        <div className="stat-card">
          <h3>Days Until Refill</h3>
          <p className={`stat-value ${health.status}`} style={{ color: health.color }}>
            {burnRate.daysUntilRefill} days
          </p>
          <p className="stat-label">Projected Runout</p>
        </div>

        <div className="stat-card">
          <h3>Monthly Projection</h3>
          <p className="stat-value">
            {formatCurrency(burnRate.monthlyProjection)}
          </p>
          <p className="stat-label">Estimated Usage</p>
        </div>
      </div>

      {/* Engagement Metrics */}
      <div className="engagement-section">
        <h2>Engagement Metrics</h2>
        <div className="metrics-grid">
          <div className="metric-card">
            <span className="metric-icon">🎉</span>
            <div className="metric-info">
              <p className="metric-label">Recognitions This Month</p>
              <p className="metric-value">{engagementData.recognitionsThisMonth}</p>
            </div>
          </div>

          <div className="metric-card">
            <span className="metric-icon">🎁</span>
            <div className="metric-info">
              <p className="metric-label">Redemptions This Month</p>
              <p className="metric-value">{engagementData.redemptionsThisMonth}</p>
            </div>
          </div>

          <div className="metric-card">
            <span className="metric-icon">👥</span>
            <div className="metric-info">
              <p className="metric-label">Active Users This Week</p>
              <p className="metric-value">{engagementData.activeUsersThisWeek}</p>
            </div>
          </div>

          <div className="metric-card">
            <span className="metric-icon">⭐</span>
            <div className="metric-info">
              <p className="metric-label">Avg Points Per Employee</p>
              <p className="metric-value">
                {formatCurrency(engagementData.avgPointsPerEmployee)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Burn Rate Chart Placeholder */}
      <div className="chart-section">
        <h2>Burn Rate Trend (Last 30 Days)</h2>
        <div className="chart-placeholder">
          <p>📈 Chart visualization would go here</p>
          <p className="chart-note">Connect to analytics data for actual burn rate trends</p>
        </div>
      </div>

      {/* Health Status */}
      <div className="health-status">
        <div className={`status-indicator ${health.status}`}>
          <div className="status-dot" style={{ backgroundColor: health.color }}></div>
          <span>System Status: </span>
          <strong>{health.status.toUpperCase()}</strong>
        </div>
      </div>
    </div>
  );
}
