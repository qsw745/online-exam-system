// src/shared/hooks/index.ts

// —— 业务域 Hooks ——（都在 shared 下统一出口）
export * from './useAnalytics'
export { default as useAnalytics } from './useAnalytics'

export * from './useDashboard'
export { default as useDashboard } from './useDashboard'

export * from './useDataAnalytics'
export { default as useDataAnalytics } from './useDataAnalytics'

export * from './useLeaderboard'
export { default as useLeaderboard } from './useLeaderboard'

export * from './useLearningProgress'
export { default as useLearningProgress } from './useLearningProgress'

export * from '../../features/logs/hooks/useLogs'
export { default as useLogs } from '../../features/logs/hooks/useLogs'

export * from '../../features/exams/hooks/useResults'
export { default as useResults } from '../../features/exams/hooks/useResults'

// —— 通用/基础 Hooks ——
export * from './useDebounce'
export { default as useDebounce, default as useDebounced } from './useDebounce'

export * from './useFavorites'
export { default as useFavorites } from './useFavorites'

export * from './useMobile'
export { default as useMobile } from './useMobile'

export * from './useOrgTree'
export { useOrgTree } from './useOrgTree'

export * from './useTheme'
export { default as useTheme } from './useTheme'

// —— 题目浏览相关 ——
// 直接使用 shared 版本，不从 features 再导出，避免循环依赖
export * from '../../features/questions/hooks/useQuestionsQuery'
export { default as useQuestionsQuery } from '../../features/questions/hooks/useQuestionsQuery'

// —— 用户组织相关 ——
// 修复：转发到 features 下实际实现，避免找不到本地文件
export * from '@/features/users/hooks/useOrgUsersQuery'
export { default as useOrgUsersQuery } from '@/features/users/hooks/useOrgUsersQuery'
