import axios from 'axios'
import { useAuthStore } from '../store/authStore'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// Auth API
export const authAPI = {
  login: (email, password) => api.post('/auth/login', { email, password }),
  requestOTP: (identifier, isEmail = true) => 
    api.post('/auth/request-otp', isEmail ? { email: identifier } : { mobile_phone: identifier }),
  verifyOTP: (identifier, otp_code, isEmail = true) => 
    api.post('/auth/verify-otp', isEmail ? { email: identifier, otp_code } : { mobile_phone: identifier, otp_code }),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
}

// Users API
export const usersAPI = {
  getAll: (params) => api.get('/users', { params }),
  getById: (id) => api.get(`/users/${id}`),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  search: (q) => api.get('/users/search', { params: { q } }),
  getDirectReports: (id) => api.get(`/users/${id}/direct-reports`),
  downloadTemplate: () => api.get('/users/template', { responseType: 'blob' }),
  upload: (formData) => api.post('/users/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  getStaging: (batchId) => api.get(`/users/staging/${batchId}`),
  confirmImport: (batchId) => api.post(`/users/staging/${batchId}/confirm`),
  bulkAction: (data) => api.post('/users/bulk-action', data),
}

// Wallets API
export const walletsAPI = {
  getMyWallet: () => api.get('/wallets/me'),
  getMyLedger: (params) => api.get('/wallets/me/ledger', { params }),
  getUserWallet: (userId) => api.get(`/wallets/${userId}`),
  allocatePoints: (data) => api.post('/wallets/allocate', data),
  bulkAllocate: (data) => api.post('/wallets/allocate/bulk', data),
  adjustBalance: (userId, data) => api.post(`/wallets/${userId}/adjust`, data),
}

// Budgets API
export const budgetsAPI = {
  getAll: (params) => api.get('/budgets', { params }),
  getById: (id) => api.get(`/budgets/${id}`),
  create: (data) => api.post('/budgets', data),
  update: (id, data) => api.put(`/budgets/${id}`, data),
  allocate: (id, data) => api.post(`/budgets/${id}/allocate`, data),
  getDepartmentBudgets: (id) => api.get(`/budgets/${id}/departments`),
  activate: (id) => api.put(`/budgets/${id}/activate`),
  getAllLeadAllocations: (params) => api.get('/budgets/leads/all', { params }),
  allocateToLead: (data) => api.post('/budgets/leads/allocate', data),
  allocateToEmployee: (budgetId, departmentId, data) => api.post(`/budgets/${budgetId}/departments/${departmentId}/allocate_employee`, data),
  getMyAvailablePoints: () => api.get('/budgets/my-available-points'),
  distributePerEmployee: (data) => api.post('/budgets/distribute/per-employee', data),
  distributeToAllUsers: (data) => api.post('/budgets/distribute/all-users', data),
}

// Recognition API
export const recognitionAPI = {
  getAll: (params) => api.get('/recognitions', { params }),
  getById: (id) => api.get(`/recognitions/${id}`),
  create: (data) => api.post('/recognitions', data),
  getBadges: () => api.get('/recognitions/badges'),
  toggleReaction: (id) => api.post(`/recognitions/${id}/react`),
  getComments: (id) => api.get(`/recognitions/${id}/comments`),
  addComment: (id, data) => api.post(`/recognitions/${id}/comments`, data),
  getMyStats: () => api.get('/recognitions/stats/me'),
}

// Redemption API
export const redemptionAPI = {
  getBrands: (params) => api.get('/redemptions/brands', { params }),
  getCategories: () => api.get('/redemptions/brands/categories'),
  getVouchers: (params) => api.get('/redemptions/vouchers', { params }),
  getVoucherById: (id) => api.get(`/redemptions/vouchers/${id}`),
  // Legacy single-step (not used by new Redeem page)
  create: (data) => api.post('/redemptions', data),
  getMyRedemptions: (params) => api.get('/redemptions/history', { params }),
  getById: (id) => api.get(`/redemptions/${id}`),
}

// Unified Rewards Catalog + Redemption Engine (new)
export const rewardsAPI = {
  getCatalog: (params) => api.get('/rewards/catalog', { params }),
  getCatalogItem: (id) => api.get(`/rewards/catalog/${id}`),
  getCategories: () => api.get('/rewards/categories'),
  redeem: (data) => api.post('/rewards/redeem', data),
  getMyOrders: (params) => api.get('/rewards/redemptions', { params }),
  getOrder: (id) => api.get(`/rewards/redemptions/${id}`),
  getWallet: () => api.get('/rewards/wallet'),
  // Admin catalog management
  createCatalogItem: (data) => api.post('/rewards/catalog', data),
  updateCatalogItem: (id, data) => api.put(`/rewards/catalog/${id}`, data),
  deleteCatalogItem: (id) => api.delete(`/rewards/catalog/${id}`),
}

// Feed API
export const feedAPI = {
  getAll: (params) => api.get('/feed', { params }),
  getMyFeed: (params) => api.get('/feed/my', { params }),
  getDepartmentFeed: (params) => api.get('/feed/department', { params }),
}

// Notifications API
export const notificationsAPI = {
  getAll: (params) => api.get('/notifications', { params }),
  getCount: () => api.get('/notifications/count'),
  markAsRead: (id) => api.put(`/notifications/${id}/read`),
  markAllAsRead: () => api.put('/notifications/read-all'),
  delete: (id) => api.delete(`/notifications/${id}`),
}

// Tenants API
export const tenantsAPI = {
  getCurrent: () => api.get('/tenants/current'),
  getAll: () => api.get('/tenants'),
  getById: (id) => api.get(`/tenants/${id}`),
  updateCurrent: (data) => api.put('/tenants/current', data),
  provision: (data) => api.post('/tenants', data),
  toggleStatus: (id) => api.post(`/tenants/${id}/toggle-status`),
  loadBudget: (id, data) => api.post(`/tenants/${id}/load-budget`, data),
  getDepartments: () => api.get('/tenants/departments'),
  createDepartment: (data) => api.post('/tenants/departments', data),
  updateDepartment: (id, data) => api.put(`/tenants/departments/${id}`, data),
  deleteDepartment: (id) => api.delete(`/tenants/departments/${id}`),
  getOverview: (id) => api.get(`/tenants/admin/tenants/${id}/overview-stats`),
  getDepartmentManagement: () => api.get('/tenants/management/departments'),
  allocateDepartmentBudget: (deptId, amount) => api.post(`/tenants/departments/${deptId}/add-points`, { amount, description: 'Points allocation' }),
  assignDepartmentLead: (deptId, userId) => api.post(`/tenants/departments/${deptId}/assign-lead`, { user_id: userId }),
}

// Audit API
export const auditAPI = {
  getLogs: (params) => api.get('/audit', { params }),
  getActions: () => api.get('/audit/actions'),
  getEntityTypes: () => api.get('/audit/entity-types'),
}

// Departments API
export const departmentsAPI = {
  getAll: () => api.get('/tenants/departments'),
  getById: (id) => api.get(`/tenants/departments/${id}`),
  create: (data) => api.post('/tenants/departments', data),
  update: (id, data) => api.put(`/tenants/departments/${id}`, data),
  delete: (id) => api.delete(`/tenants/departments/${id}`),
  getManagementList: () => api.get('/tenants/management/departments'),
  addPoints: (departmentId, data) => api.post(`/tenants/departments/${departmentId}/add-points`, data),
  assignLead: (departmentId, data) => api.post(`/tenants/departments/${departmentId}/assign-lead`, data),
  getMasterPool: () => api.get('/tenants/master-pool'),
  allocateBudget: (id, data) => api.post(`/tenants/departments/${id}/add-points`, data),
}

// Marketplace API
export const marketplaceAPI = {
  getAll: (params) => api.get('/marketplace/items', { params }),
  getById: (id) => api.get(`/marketplace/items/${id}`),
  createItem: (data) => api.post('/marketplace/items', data),
  updateItem: (id, data) => api.put(`/marketplace/items/${id}`, data),
  deleteItem: (id) => api.delete(`/marketplace/items/${id}`),
  getBrands: () => api.get('/marketplace/brands'),
  getMarkupSettings: () => api.get('/marketplace/markup-settings'),
  updateMarkupSettings: (data) => api.put('/marketplace/markup-settings', data),
}

// Analytics API
export const analyticsAPI = {
  getAnalytics: (params) => api.get('/analytics', { params }),
  getDepartments: () => api.get('/analytics/departments'),
  getRedemptionTrends: (params) => api.get('/analytics/redemption-trends', { params }),
  getDepartmentPerformance: (params) => api.get('/analytics/department-performance', { params }),
  getPopularCategories: (params) => api.get('/analytics/popular-categories', { params }),
  getUserEngagement: (params) => api.get('/analytics/user-engagement', { params }),
  exportReport: (params) => api.get('/analytics/export', { params, responseType: 'blob' }),
}

// Dashboard API
export const dashboardAPI = {
  getSummary: () => api.get('/dashboard/summary'),
  delegatePoints: (data) => api.post('/dashboard/delegate-points', data),
  submitTopup: (data) => api.post('/dashboard/topup-request', data),
}

// Alias exports for component compatibility
export const recognitionApi = recognitionAPI
export const usersApi = usersAPI
export const walletsApi = walletsAPI
export const budgetsApi = budgetsAPI
export const redemptionApi = redemptionAPI
export const rewardsApi = rewardsAPI
export const feedApi = feedAPI
export const notificationsApi = notificationsAPI
export const tenantsApi = tenantsAPI
export const auditApi = auditAPI
export const authApi = authAPI
export const departmentsApi = departmentsAPI
export const marketplaceApi = marketplaceAPI
export const analyticsApi = analyticsAPI
export const dashboardApi = dashboardAPI

export { api }

export default api
