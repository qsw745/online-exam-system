import { api } from '../core/httpClient'

export const users = {
  getCurrentUser: () => api.get('/users/me'),
  updateProfile: (userData: any) => api.put('/users/me', userData),
  getAll: (params: { page: number; limit: number; search?: string; role?: string }) => api.get('/users', { params }),
  getById: (id: number) => api.get(`/users/${id}`),
  update: (id: string, userData: any) => api.put(`/users/${id}`, userData),
  delete: (id: string) => api.delete(`/users/${id}`),
  updateStatus: (id: string, status: 'active' | 'disabled') => api.put(`/users/${id}/status`, { status }),
  resetPassword: (id: string) => api.put(`/users/${id}/reset-password`),
}
