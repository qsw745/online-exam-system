// src/shared/api/endpoints/index.ts
export * from './auth'
export * from './dashboard'
export * from './discussions'
export * from './favorites'
export * from './leaderboard'
export * from './learningProgress'
export * from './logs'
export * from './menu'
export * from './notifications'
export * from './orgs'
export * from './papers'
export * from './profile'
export * from './results'
export * from './roles'
export * from './settings'
export * from './smartPaper'
export * from './tasks'
export * from './users'
export * from './wrongQuestions'

// —— exams 与 questions 显式导出，避免类型重名冲突 ——

// exams：端点别名 + 类型重命名
export { exams as examsApi } from './exams'
export type { Question as ExamQuestion, QuestionType as ExamQuestionType } from './exams'

// questions：端点别名 + 类型原名
export { questions as questionsApi } from './questions'
export type { Question, QuestionType, Difficulty } from './questions'
