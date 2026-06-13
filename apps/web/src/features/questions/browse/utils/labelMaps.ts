// utils/labelMaps.ts
export const typeLabel: Record<string, string> = {
  single: '单选题',
  multiple: '多选题',
  judge: '判断题',
  fill: '填空题',
  essay: '问答题',
  single_choice: '单选题',
  multiple_choice: '多选题',
  true_false: '判断题',
  short_answer: '简答题',
}
export const typeColor: Record<string, string> = {
  single: 'blue',
  multiple: 'purple',
  judge: 'green',
  fill: 'orange',
  essay: 'red',
  single_choice: 'blue',
  multiple_choice: 'purple',
  true_false: 'green',
  short_answer: 'orange',
}
export const diffLabel: Record<string, string> = { easy: '简单', medium: '中等', hard: '困难' }
export const diffColor: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  easy: 'success',
  medium: 'warning',
  hard: 'error',
}
