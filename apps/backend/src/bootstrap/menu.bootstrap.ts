/* eslint-disable @typescript-eslint/no-explicit-any */
import { syncMenus } from './syncMenus'
import { ensureDefaultMenuGrants } from './defaultMenuGrants'

async function main() {
  await syncMenus({ mode: 'patch', removeOrphans: false })
  await ensureDefaultMenuGrants()
  console.log('[menu-bootstrap] OK: 同步系统菜单并补齐默认角色菜单授权')
}

main().catch(e => {
  console.error('[menu-bootstrap] 失败：', e)
  process.exit(1)
})
