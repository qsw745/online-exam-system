/** 成绩详情接受成绩记录 ID；旧服务未返回 ID 时回到成绩列表。 */
export function getExamResultPath(resultId: unknown): string {
  const value = typeof resultId === 'number' || typeof resultId === 'string' ? String(resultId) : ''
  return /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value)) ? `/results/${value}` : '/results'
}
