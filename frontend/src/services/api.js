import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor (Add auth token later)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor (Handle errors globally)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - redirect to login
      console.warn('Unauthorized access - redirect to login');
    }
    return Promise.reject(error);
  }
);

// API Endpoint Helpers
export const tenderAPI = {
  getAll: (params = {}) => api.get('/tenders', { params }),
  getById: (id) => api.get(`/tenders/${encodeURIComponent(id)}`),
  resolveByRef: (ref) => api.get('/tenders/resolve', { params: { ref } }),
  getSummary: (id) => api.get(`/tenders/${encodeURIComponent(id)}/summary`),
  updateStatus: (id, status) => api.patch(`/tenders/${encodeURIComponent(id)}/status`, { status }),
  getDashboardStats: () => api.get('/dashboard/stats'),
};

export const dashboardAPI = {
  getSidebarCounts: () => api.get('/dashboard/sidebar-counts'),
};

export const alertAPI = {
  getAll: () => api.get('/alerts'),
  markAsRead: (id) => api.patch(`/alerts/${id}/read`),
};

export const configAPI = {
  getSettings: () => api.get('/settings'),
  updateSettings: (data) => api.put('/settings', data),
  runScraperNow: (data) => api.post('/scraper/run', data),
  startScraper: (data) => api.post('/scraper/start', data),
  stopScraper: () => api.post('/scraper/stop'),
  getScraperStatus: () => api.get('/scraper/status'),
  pruneTenders: (data) => api.post('/tenders/prune', data),
  sendTestAlert: (data) => api.post('/alerts/test', data),
};

export const analysisAPI = {
  getAll: () => api.get('/analysis'),
};

export const sourceAPI = {
  getAll: () => api.get('/sources'),
};

export const documentAPI = {
  getAll: () => api.get('/documents'),
};

export default api;