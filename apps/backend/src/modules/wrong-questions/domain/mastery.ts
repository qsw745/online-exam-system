import type { MasteryLevel } from './wq.model'

/** 最新记录在前；不足三次练习不能判为部分掌握。 */
export function masteryFromRecentPractice(flags: boolean[]): MasteryLevel {
  if (flags.length >= 5 && flags.slice(0, 5).every(Boolean)) return 'mastered'
  if (flags.length >= 3 && flags.slice(0, 3).every(Boolean)) return 'partially_mastered'
  return 'not_mastered'
}
