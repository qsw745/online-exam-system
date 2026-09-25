import { useEffect, useState } from 'react'

function hasTextInputFocus() {
  const element = document.activeElement
  if (element instanceof HTMLTextAreaElement) return true
  if (element instanceof HTMLInputElement) {
    return !['button', 'checkbox', 'color', 'file', 'hidden', 'radio', 'range', 'reset', 'submit'].includes(element.type)
  }
  return element instanceof HTMLElement && element.isContentEditable
}

/** 只在文本输入聚焦且可视区域明显缩小时隐藏底栏，避免将普通窗口缩放误判成键盘。 */
export function useKeyboardVisible(enabled = true) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!enabled) return
    const viewport = window.visualViewport
    const height = () => viewport?.height ?? window.innerHeight
    let restingHeight = height()
    let restingWidth = window.innerWidth
    const update = () => {
      const currentHeight = height()
      const focused = hasTextInputFocus()
      if (window.innerWidth !== restingWidth) {
        restingWidth = window.innerWidth
        restingHeight = currentHeight
      }
      if (!focused) restingHeight = Math.max(restingHeight, currentHeight)
      setVisible(focused && restingHeight - currentHeight > 140)
    }
    viewport?.addEventListener('resize', update)
    window.addEventListener('resize', update)
    document.addEventListener('focusin', update)
    document.addEventListener('focusout', update)
    return () => {
      viewport?.removeEventListener('resize', update)
      window.removeEventListener('resize', update)
      document.removeEventListener('focusin', update)
      document.removeEventListener('focusout', update)
    }
  }, [enabled])

  return enabled && visible
}
