// apps/backend/src/common/middleware/index.ts

// 现有中间件统一出口（都用相对文件名，不带 .js，便于 ts-node/tsx + tsconfig-paths）
export * from './auth'
export * from './http-logger'
export * from './requestId'
export * from './role-auth'
export * from './validation'
export * from './upload'
export * from './jwt-role-hydrator'
export * from './rbac'

// 兼容老路径（有人从 @/modules/common/middleware/validation 引）
// NOTE: 也去掉 .js 后缀，避免解析失败
export * from '@/common/middleware/validation'
