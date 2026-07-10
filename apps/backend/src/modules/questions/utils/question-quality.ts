/* eslint-disable @typescript-eslint/no-explicit-any */

export function normalizeQuestionContent(value: any): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function validateQuestionQuality(input: {
  content?: any
  question_type?: any
}): string[] {
  const issues: string[] = []
  const content = normalizeQuestionContent(input.content)
  const questionType = String(input.question_type || '').trim()

  if (!content) {
    issues.push('题干不能为空')
    return issues
  }

  if (/[，,、；;]$/.test(content)) {
    issues.push('题干疑似未写完整，不能以逗号、顿号或分号结尾')
  }

  if (/^(在|关于|对于|针对).{1,40}(中|里|方面)$/.test(content)) {
    issues.push('题干只有场景或范围，缺少可作答的完整判断或问题')
  }

  if (questionType === 'true_false' && /^(在|关于|对于|针对).{1,40}(中|里|方面)[，,、；;]?$/.test(content)) {
    issues.push('判断题题干必须是可以判断真假的完整陈述')
  }

  return issues
}

export function formatQuestionQualityError(issues: string[]): string {
  return `题目质量校验失败：${issues.join('；')}`
}
