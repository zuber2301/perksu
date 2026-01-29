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
  (response) => response,
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
  create: (data) => api.post('/redemptions', data),
  getMyRedemptions: (params) => api.get('/redemptions', { params }),
  getById: (id) => api.get(`/redemptions/${id}`),
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
}

// Audit API
export const auditAPI = {
  getLogs: (params) => api.get('/audit', { params }),
  getActions: () => api.get('/audit/actions'),
  getEntityTypes: () => api.get('/audit/entity-types'),
}

// Alias exports for component compatibility
export const recognitionApi = recognitionAPI
export const usersApi = usersAPI
export const walletsApi = walletsAPI
export const budgetsApi = budgetsAPI
export const redemptionApi = redemptionAPI
export const feedApi = feedAPI
export const notificationsApi = notificationsAPI
export const tenantsApi = tenantsAPI
export const auditApi = auditAPI
export const authApi = authAPI

export default api
