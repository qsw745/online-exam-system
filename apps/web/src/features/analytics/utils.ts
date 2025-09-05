export function getScoreColor(score: number) {
  if (score >= 90) return '#52c41a'
  if (score >= 80) return '#1890ff'
  if (score >= 70) return '#faad14'
  if (score >= 60) return '#fa8c16'
  return '#ff4d4f'
}

export function formatStudyTime(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h${m}m` : `${m}m`
}
