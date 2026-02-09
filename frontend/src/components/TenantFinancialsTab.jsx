import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { formatCurrency } from '../lib/currency'
import { useAuthStore } from '../store/authStore'
import { useQuery } from '@tanstack/react-query'
import './TenantTabs.css';

export default function TenantFinancialsTab({ tenant, onUpdate, setMessage }) {
  const { user } = useAuthStore()
  const [injectAmount, setInjectAmount] = useState('');
  const [injectDescription, setInjectDescription] = useState('');
  const [injecting, setInjecting] = useState(false);

  // New: load allocated budget form
  const [loadAmount, setLoadAmount] = useState('');
  const [loadDescription, setLoadDescription] = useState('Allocated budget load')
  const [loadingAllocated, setLoadingAllocated] = useState(false);

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageSize] = useState(20);
  const [page, setPage] = useState(0);

  // Fetch up-to-date tenant details (so we can show master balance and allocated_budget reliably)
  const { data: tenantDetails } = useQuery({
    queryKey: ['tenant', tenant.tenant_id],
    queryFn: async () => { const resp = await api.get(`/tenants/${tenant.tenant_id}`); return resp.data },
    enabled: !!tenant?.tenant_id,
  })

  const effectiveTenant = tenantDetails || tenant

  useEffect(() => {
    fetchTransactions();
  }, [tenant.tenant_id, page]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await api.get(
        `/tenants/admin/tenants/${tenant.tenant_id}/transactions?skip=${page * pageSize}&limit=${pageSize}`
      );
      setTransactions(response.data);
    } catch (err) {
      setMessage({
        type: 'error',
        text: 'Failed to load transaction history',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInjectPoints = async (e) => {
    e.preventDefault();

    if (!injectAmount || isNaN(parseFloat(injectAmount)) || parseFloat(injectAmount) <= 0) {
      setMessage({
        type: 'error',
        text: 'Please enter a valid amount',
      });
      return;
    }

    setInjecting(true);

    try {
      const payload = {
        amount: parseFloat(injectAmount),
        description: injectDescription || 'Manual budget injection',
      };

      await api.post(
        `/tenants/admin/tenants/${tenant.tenant_id}/inject-points`,
        payload
      );

      setMessage({
        type: 'success',
        text: `Successfully injected ${injectAmount} points`,
      });

      setInjectAmount('');
      setInjectDescription('');
      fetchTransactions();
      onUpdate();
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.detail || 'Failed to inject points',
      });
    } finally {
      setInjecting(false);
    }
  };

  // Platform Admin: Load Allocated Budget (explicit action)
  const handleLoadAllocatedBudget = async (e) => {
    e.preventDefault();

    if (!loadAmount || isNaN(parseFloat(loadAmount)) || parseFloat(loadAmount) <= 0) {
      setMessage({ type: 'error', text: 'Please enter a valid amount to load' });
      return;
    }

    setLoadingAllocated(true);
    try {
      await api.post(`/tenants/${tenant.tenant_id}/load-budget`, {
        amount: parseFloat(loadAmount),
        description: loadDescription || 'Platform allocated budget load',
      });

      setMessage({ type: 'success', text: `Loaded ${(parseFloat(loadAmount)).toLocaleString()} pts to allocated budget` });
      setLoadAmount('');
      setLoadDescription('Allocated budget load');
      fetchTransactions();
      onUpdate();
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.detail || 'Failed to load allocated budget' });
    } finally {
      setLoadingAllocated(false);
    }
  }

  // Use centralized INR helper (no decimals)
  // imported at top: formatCurrency

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="tab-financials">
      {/* Inject Points Section */}
      <div className="inject-points-section">
        <h2>💰 Inject Points to Master Budget</h2>
        <form onSubmit={handleInjectPoints} className="inject-form">
          <div className="form-row">
            <div className="form-group">
              <label>Amount</label>
              <input
                type="number"
                value={injectAmount}
                onChange={(e) => setInjectAmount(e.target.value)}
                placeholder="Enter amount"
                step="0.01"
                min="0"
                required
              />
            </div>

            <div className="form-group">
              <label>Description (Optional)</label>
              <input
                type="text"
                value={injectDescription}
                onChange={(e) => setInjectDescription(e.target.value)}
                placeholder="e.g., Q3 Annual Budget"
              />
            </div>

            <div className="form-group">
              <button
                type="submit"
                className="btn-primary"
                disabled={injecting}
              >
                {injecting ? 'Processing...' : 'Inject Points'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Platform Admin: Load Allocated Budget */}
      {user?.role === 'platform_admin' && (
        <div className="inject-points-section mt-6">
          <h2>📤 Load Allocated Budget (Platform Admin)</h2>
          <form onSubmit={handleLoadAllocatedBudget} className="inject-form">
            <div className="form-row">
              <div className="form-group">
                <label>Amount</label>
                <input
                  type="number"
                  value={loadAmount}
                  onChange={(e) => setLoadAmount(e.target.value)}
                  placeholder="Enter amount"
                  step="0.01"
                  min="0"
                  required
                />
              </div>

              <div className="form-group">
                <label>Description (Optional)</label>
                <input
                  type="text"
                  value={loadDescription}
                  onChange={(e) => setLoadDescription(e.target.value)}
                  placeholder="e.g., Platform allocation for FY"
                />
              </div>

              <div className="form-group">
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loadingAllocated}
                >
                  {loadingAllocated ? 'Processing...' : 'Load Allocated Budget'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Current Balance */}
      <div className="balance-card">
        <h2>Current Master Balance</h2>
        <p className="balance-amount">{formatCurrency(effectiveTenant.master_budget_balance || effectiveTenant.master_balance)}</p>
        <p className="balance-label">Total Points Available</p>
        <div className="mt-2 text-sm text-gray-600">
          <span className="mr-4">Total Allocated Budget: <strong>{(effectiveTenant.allocated_budget || 0).toLocaleString()} pts</strong></span>
        </div>
      </div>

      {/* Transaction History */}
      <div className="transactions-section">
        <h2>Transaction History</h2>

        {loading ? (
          <div className="loading-state">Loading transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="empty-state">No transactions found</div>
        ) : (
          <>
            <div className="transactions-table-wrapper">
              <table className="transactions-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Balance After</th>
                    <th>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr
                      key={transaction.id}
                      className={`transaction-row ${transaction.transaction_type}`}
                    >
                      <td>{formatDate(transaction.created_at)}</td>
                      <td>
                        <span className={`badge ${transaction.transaction_type}`}>
                          {transaction.transaction_type.toUpperCase()}
                        </span>
                      </td>
                      <td className={transaction.transaction_type}>
                        {transaction.transaction_type === 'credit' ? '+' : '-'}
                        {formatCurrency(transaction.amount)}
                      </td>
                      <td>{formatCurrency(transaction.balance_after)}</td>
                      <td className="description">{transaction.description}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="pagination-mini">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="pagination-btn"
              >
                ← Previous
              </button>
              <span className="page-info">Page {page + 1}</span>
              <button
                onClick={() => setPage(page + 1)}
                disabled={transactions.length < pageSize}
                className="pagination-btn"
              >
                Next →
              </button>
            </div>
          </>
        )}
      </div>

      {/* Invoice Records Placeholder */}
      <div className="invoices-section">
        <h2>Invoice Records</h2>
        <div className="placeholder-box">
          <p>📄 Invoice history would display here</p>
          <p className="note">Integration with billing system pending</p>
        </div>
      </div>
    </div>
  );
}
