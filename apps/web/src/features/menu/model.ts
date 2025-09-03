// apps/web/src/lib/menus.ts
import { api } from './api'

export const menus = {
  list: () => api.get('/menu/menus'),
}
