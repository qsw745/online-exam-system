import type { Knex } from 'knex'

export async function seed(knex: Knex): Promise<void> {
  // organizations 根节点
  const orgRoot = await knex('organizations').where({ id: 1 }).first()
  if (!orgRoot) {
    await knex('organizations').insert({
      id: 1,
      parent_id: null,
      name: '默认组织',
      code: 'ROOT',
      sort_order: 0,
      is_disabled: 0,
    })
  }

  // sys_menus 最小可用导航
  // 1) root
  const sysRoot = await knex('sys_menus').where({ id: 1 }).first()
  if (!sysRoot) {
    await knex('sys_menus').insert({
      id: 1,
      parent_id: null,
      name: 'root',
      title: '根目录',
      path: '/',
      component: null,
      icon: 'home',
      sort_order: 0,
      level: 1,
      is_hidden: 0,
      is_disabled: 0,
      is_system: 1,
      menu_type: 'menu',
    })
  }

  // 2) dashboard
  const dash = await knex('sys_menus').where({ name: 'dashboard' }).first()
  if (!dash) {
    await knex('sys_menus').insert({
      parent_id: 1,
      name: 'dashboard',
      title: '仪表盘',
      path: '/dashboard',
      component: 'dashboard',
      icon: 'dashboard',
      sort_order: 10,
      level: 2,
      is_hidden: 0,
      is_disabled: 0,
      is_system: 0,
      menu_type: 'page',
      permission_code: 'dashboard:view',
      meta: JSON.stringify({ keepAlive: false, requireAuth: true }),
    })
  }

  // 3) learning（仅示例，可按你项目裁剪）
  const learning = await knex('sys_menus').where({ name: 'learning' }).first()
  if (!learning) {
    await knex('sys_menus').insert({
      parent_id: 1,
      name: 'learning',
      title: '学习中心',
      path: '/learning',
      component: null,
      icon: 'book',
      sort_order: 20,
      level: 2,
      is_hidden: 0,
      is_disabled: 0,
      is_system: 0,
      menu_type: 'menu',
    })
  }
}
