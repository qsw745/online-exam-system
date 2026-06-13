// apps/web/src/shared/components/RefreshButton.tsx
import { Button, Tooltip } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import React from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useLocation } from 'react-router-dom'

type Props = {
  /** 指定要失效的 queryKey 前缀（默认按当前路由路径作为命名空间） */
  nsPrefix?: string | string[]
  /** 额外执行（比如重新拉取非 React Query 的数据） */
  onAfter?: () => void | Promise<void>
  /** 节流毫秒，避免狂点；默认 800ms */
  throttleMs?: number
  size?: 'small' | 'middle' | 'large'
  type?: 'default' | 'primary' | 'dashed' | 'link' | 'text'
}

export const RefreshButton: React.FC<Props> = ({
  nsPrefix,
  onAfter,
  throttleMs = 800,
  size = 'middle',
  type = 'default',
}) => {
  const qc = useQueryClient()
  const { pathname } = useLocation()
  const [loading, setLoading] = React.useState(false)
  const lastRef = React.useRef(0)

  const invalidate = async () => {
    const now = Date.now()
    if (now - lastRef.current < throttleMs) return
    lastRef.current = now
    setLoading(true)
    try {
      const prefixArr = Array.isArray(nsPrefix) ? nsPrefix : [nsPrefix ?? pathname]
      // 失效以这些前缀开头的 query（命名空间做法）
      await qc.invalidateQueries({
        predicate: q => {
          const k = q.queryKey as unknown[]
          return prefixArr.some(p => {
            if (!p) return false
            // 允许用字符串前缀或完整第一个段匹配
            return k.length && (String(k[0]).startsWith(String(p)) || String(k.join('/')).startsWith(String(p)))
          })
        },
      })
      await onAfter?.()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Tooltip title="刷新当前页面数据">
      <Button icon={<ReloadOutlined />} loading={loading} onClick={invalidate} size={size} type={type}>
        刷新
      </Button>
    </Tooltip>
  )
}
