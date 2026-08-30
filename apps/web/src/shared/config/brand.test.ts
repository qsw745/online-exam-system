import { describe, expect, it } from 'vitest'
import { brand, formatDocumentTitle } from './brand'

describe('问衡品牌配置', () => {
  it('没有页面标题时返回品牌名', () => {
    expect(formatDocumentTitle()).toBe('问衡')
  })

  it('页面标题去除空白后与品牌名组合', () => {
    expect(formatDocumentTitle('  我的考试  ')).toBe('我的考试｜问衡')
  })

  it('暴露已确认的副标题和口号', () => {
    expect(brand.subtitle).toBe('AI 智能测评与学习平台')
    expect(brand.slogan).toBe('以问见知，以衡见长')
  })
})
