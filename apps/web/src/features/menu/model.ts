// apps/web/src/lib/menus.ts
import { api } from '@shared/api/http'

export const menus = {
  list: () => api.get('/menu/menus'),
}
