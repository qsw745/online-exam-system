// —— 业务域 Hooks ——（都在 shared 下统一出口）
export { default as useAnalytics } from './useAnalytics'
export * from './useAnalytics'

export { default as useDashboard } from './useDashboard'
export * from './useDashboard'

export { default as useDataAnalytics } from './useDataAnalytics'
export * from './useDataAnalytics'

export { default as useLeaderboard } from './useLeaderboard'
export * from './useLeaderboard'

export { default as useLearningProgress } from './useLearningProgress'
export * from './useLearningProgress'

export { default as useLogs } from './useLogs'
export * from './useLogs'

export { default as useResults } from './useResults'
export * from './useResults'

// —— 通用/基础 Hooks ——
export { default as useDebounce } from './useDebounce'
export * from './useDebounce'
export { default as useDebounced } from './useDebounce' // 兼容别名

export { default as useFavorites } from './useFavorites'
export * from './useFavorites'

export { default as useMenuPermissions } from './useMenuPermissions'
export * from './useMenuPermissions'

export { default as useMobile } from './useMobile'
export * from './useMobile'

export { default as useOrgTree } from './useOrgTree'
export * from './useOrgTree'

export { default as useTheme } from './useTheme'
export * from './useTheme'

// —— 题目浏览相关 ——
// 直接使用 shared 版本，不从 features 再导出，避免循环依赖
export { default as useQuestionsQuery } from './useQuestionsQuery'
export * from './useQuestionsQuery'

// —— 用户组织相关 ——
export { default as useOrgUsersQuery } from './useOrgUsersQuery'
export * from './useOrgUsersQuery'
