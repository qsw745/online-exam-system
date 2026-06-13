/** format: 2025-09-06 00:00:00 */
export function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`
}
export function formatDate(d: Date | number | string): string {
  const dt = d instanceof Date ? d : new Date(d)
  const y = dt.getFullYear()
  const m = pad2(dt.getMonth() + 1)
  const day = pad2(dt.getDate())
  const hh = pad2(dt.getHours())
  const mm = pad2(dt.getMinutes())
  const ss = pad2(dt.getSeconds())
  return `${y}-${m}-${day} ${hh}:${mm}:${ss}`
}
