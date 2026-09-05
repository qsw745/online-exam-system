import { expect, it, vi } from 'vitest'
import { profileApi } from './profile'
const mocks = vi.hoisted(() => ({ put: vi.fn() }))
vi.mock('../core/httpClient', () => ({ api: mocks }))
it('资料更新保留显式清空的字段，省略未修改字段', async () => {
  await profileApi.update({ nickname: ' 学生 ', bio: '', phone: ' ', school: '', class_name: '', email: undefined })
  expect(mocks.put).toHaveBeenCalledWith('/profile', { nickname: '学生', bio: '', phone: '', school: '', class_name: '' })
})
