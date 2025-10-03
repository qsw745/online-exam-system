// 轻量级的“路径 → 标题”注册表，用于给 Tabs 起中文名
const map = new Map<string, string>()

/** 规范化路径：去多斜杠 + 去掉结尾 /index 或 -index */
function clean(p?: string | null) {
  return ('/' + (p || '')).replace(/\/{2,}/g, '/').replace(/(?:\/index|-index)(?=\/?$)/, '')
}

/** 写入 */
export function registerTitle(path: string, title: string) {
  const k = clean(path)
  if (!k) return
  map.set(k, title?.trim() || '')
}

/** 读取（没有就返回空字符串） */
export function getTitle(path: string): string {
  const k = clean(path)
  return map.get(k) || ''
}

/** 手动清理（很少用到） */
export function clearRegisteredTitles() {
  map.clear()
}
