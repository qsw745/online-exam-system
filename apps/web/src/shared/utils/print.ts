// 通用打印：隐藏 iframe 写入带打印样式的文档后调用系统打印，不影响当前页面

export const escapeHtml = (s: unknown): string =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const PRINT_STYLES = `
  * { box-sizing: border-box; }
  body { font-family: "Songti SC", "SimSun", "Noto Serif CJK SC", serif; color: #111; margin: 0; padding: 24px 32px; font-size: 14px; line-height: 1.7; }
  h1 { font-size: 22px; text-align: center; margin: 0 0 4px; }
  .meta { text-align: center; color: #444; font-size: 13px; margin-bottom: 18px; padding-bottom: 12px; border-bottom: 1.5px solid #111; }
  .meta span { margin: 0 10px; }
  .q { margin-bottom: 14px; break-inside: avoid; }
  .q-head { font-weight: 600; }
  .q-type { font-weight: normal; color: #555; font-size: 12px; margin-left: 6px; }
  .q-opts { margin: 4px 0 0 1.5em; padding: 0; list-style: none; }
  .q-opts li { margin: 2px 0; }
  .q-ans { margin: 4px 0 0 1.5em; color: #b45309; font-size: 13px; }
  .q-exp { margin: 2px 0 0 1.5em; color: #555; font-size: 12px; }
  .sec-title { font-size: 15px; font-weight: 700; margin: 18px 0 10px; border-left: 4px solid #111; padding-left: 8px; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #999; padding: 6px 10px; font-size: 13px; text-align: left; }
  th { background: #f2f2f2; }
  .ok { color: #15803d; }
  .bad { color: #b91c1c; }
  .footer { margin-top: 24px; color: #888; font-size: 11px; text-align: right; }
  @page { margin: 14mm 12mm; }
`

export function printHtml(title: string, bodyHtml: string): void {
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  if (!doc) {
    iframe.remove()
    return
  }
  doc.open()
  doc.write(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${PRINT_STYLES}</style></head><body>${bodyHtml}</body></html>`
  )
  doc.close()

  const doPrint = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } finally {
      // 打印对话框关闭后清理；延迟以免部分浏览器取消打印
      window.setTimeout(() => iframe.remove(), 60_000)
    }
  }
  // 等待 iframe 渲染完成
  if (doc.readyState === 'complete') window.setTimeout(doPrint, 50)
  else iframe.onload = doPrint
}

/** 解析选项 JSON：兼容 [{content,is_correct}] / ["文本"] / JSON 字符串 */
export function parseOptionContents(raw: unknown): string[] {
  let val: any = raw
  if (typeof val === 'string') {
    try {
      val = JSON.parse(val)
    } catch {
      return []
    }
  }
  if (!Array.isArray(val)) return []
  return val
    .map((item: any) => (typeof item === 'string' ? item : String(item?.content ?? item?.label ?? '')))
    .map(s => s.trim())
    .filter(Boolean)
}

export const optionLetter = (i: number) => String.fromCharCode(65 + i)
