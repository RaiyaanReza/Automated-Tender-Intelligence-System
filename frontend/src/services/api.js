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
  getAll: () => api.get('/tenders'),
  getById: (id) => api.get(`/tenders/${id}`),
  getSummary: (id) => api.get(`/tenders/${id}/summary`),
  updateStatus: (id, status) => api.patch(`/tenders/${id}/status`, { status }),
};

export const alertAPI = {
  getAll: () => api.get('/alerts'),
  markAsRead: (id) => api.patch(`/alerts/${id}/read`),
};

export const configAPI = {
  getSettings: () => api.get('/settings'),
  updateSettings: (data) => api.put('/settings', data),
};

export default api;