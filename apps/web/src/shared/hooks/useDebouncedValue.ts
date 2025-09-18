import { useEffect, useState } from 'react'

/** 简单防抖 Hook：值在 delay 毫秒内不变才更新 */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), Math.max(0, delay))
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}

export default useDebouncedValue
