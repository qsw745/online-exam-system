import { describe, expect, it } from 'vitest'
import { getExamResultPath } from './examResultNavigation'

describe('交卷后的成绩位置', () => {
  it('使用成绩记录 ID', () => expect(getExamResultPath(700)).toBe('/results/700'))
  it.each([undefined, null, '', 0, -1, 1.5, '8/other', {}, Number.MAX_SAFE_INTEGER + 1])('缺少有效记录 ID 时回成绩列表：%s', id => {
    expect(getExamResultPath(id)).toBe('/results')
  })
})
