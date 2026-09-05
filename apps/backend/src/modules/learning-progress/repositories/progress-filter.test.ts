import assert from 'node:assert/strict'
import test from 'node:test'
import { buildProgressFilter } from './progress-filter.js'

test('日期和科目筛选使用同一组绑定参数，日期不进入 SQL 文本', () => {
  const filter = buildProgressFilter(21, 7, { start: '2026-09-01', end: '2026-09-05', days: 7 })
  assert.equal(filter.sql, 'user_id = ? AND subject_id = ? AND study_date >= ? AND study_date <= ?')
  assert.deepEqual(filter.params, [21, 7, '2026-09-01', '2026-09-05'])
  assert.equal(filter.sql.includes('2026-09-01'), false)
})
test('清除单个日期仍保留另一侧限制；全部日期不暗中限制为 7 天', () => {
  assert.deepEqual(buildProgressFilter(21, undefined, { end: '2026-09-05' }, 'lp'), { sql: 'lp.user_id = ? AND lp.study_date <= ?', params: [21, '2026-09-05'] })
  assert.deepEqual(buildProgressFilter(21), { sql: 'user_id = ?', params: [21] })
})
test('未指定日期时仍兼容旧版 period 查询', () => {
  assert.deepEqual(buildProgressFilter(21, undefined, { days: 30 }), { sql: 'user_id = ? AND study_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)', params: [21, 30] })
})
