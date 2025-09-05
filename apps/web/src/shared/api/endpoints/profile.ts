import { api } from '../core/httpClient'

export const profile = {
  update: (profileData: any) => api.put('/users/me', profileData),
  uploadAvatar: (formData: FormData) => api.post('/users/me/avatar', formData),
}
