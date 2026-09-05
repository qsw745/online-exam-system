export type ProgressRange = { start?: string; end?: string; days?: number }

/** 统计和记录共用筛选条件，日期与科目使用绑定参数。 */
export function buildProgressFilter(userId: number, subjectId?: number, range: ProgressRange = {}, alias = '') {
  const prefix = alias ? `${alias}.` : ''
  const conditions = [`${prefix}user_id = ?`]
  const params: (number | string)[] = [userId]
  if (subjectId != null) { conditions.push(`${prefix}subject_id = ?`); params.push(subjectId) }
  if (range.start) { conditions.push(`${prefix}study_date >= ?`); params.push(range.start) }
  if (range.end) { conditions.push(`${prefix}study_date <= ?`); params.push(range.end) }
  if (!range.start && !range.end && range.days != null) {
    conditions.push(`${prefix}study_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)`)
    params.push(range.days)
  }
  return { sql: conditions.join(' AND '), params }
}
