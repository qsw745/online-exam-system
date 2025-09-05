// apps/web/src/shared/api/endpoints/index.ts

import { menuApi } from './menu'

// 如需新增模块，按需引入并挂到 endpoints 里：
// import { roleApi } from './roles'
// import { userApi } from './users'

/** 统一导出，页面只引这个 */
export const endpoints = {
  menu: menuApi,
  // role: roleApi,
  // user: userApi,
}

export * from './menu'
// export * from './roles'
// export * from './users'
