// utils/labelMaps.ts
export const typeLabelKey: Record<string, string> = {
  all: 'questions.all_types',
  single: 'questions.single_choice',
  multiple: 'questions.multiple_choice',
  judge: 'questions.judge',
  fill: 'questions.fill_blank',
  essay: 'questions.essay',
  single_choice: 'questions.single_choice',
  multiple_choice: 'questions.multiple_choice',
  true_false: 'questions.judge',
  short_answer: 'questions.type_short',
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
export const diffLabelKey: Record<string, string> = {
  all: 'questions.all_difficulties',
  easy: 'questions.easy',
  medium: 'questions.medium',
  hard: 'questions.hard',
}
export const diffColor: Record<string, 'success' | 'warning' | 'error' | 'default'> = {
  easy: 'success',
  medium: 'warning',
  hard: 'error',
}
