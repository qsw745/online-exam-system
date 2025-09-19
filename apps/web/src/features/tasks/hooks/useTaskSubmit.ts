// apps/web/src/features/tasks/hooks/useTaskSubmit.ts
import { App } from 'antd'
import { useCallback, useState } from 'react'
import { tasksApi } from '@/shared/api/endpoints/tasks'

export type UseTaskSubmitOptions = {
  mode: 'create' | 'edit' | 'view'
  id?: string
  onSuccess?: () => void
}

/**
 * 把创建/更新任务的业务逻辑从页面中抽离出来。
 * 页面只负责拿到表单数据然后调用 submit(payload) 即可。
 */
export function useTaskSubmit(opts: UseTaskSubmitOptions) {
  const { message } = App.useApp()
  const [submitting, setSubmitting] = useState(false)

  const submit = useCallback(
    async (payload: any) => {
      try {
        setSubmitting(true)

        if (opts.mode === 'edit' && opts.id) {
          await tasksApi.update(opts.id, payload)
          message.success('更新成功')
        } else {
          await tasksApi.create(payload)
          message.success('创建成功')
        }

        opts.onSuccess?.()
      } catch (e: any) {
        message.error(e?.message || '保存失败')
      } finally {
        setSubmitting(false)
      }
    },
    [opts.mode, opts.id, opts.onSuccess, message]
  )

  return { submitting, submit }
}

export default useTaskSubmit
