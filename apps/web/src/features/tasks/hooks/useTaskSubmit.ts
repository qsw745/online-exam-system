// apps/web/src/features/tasks/hooks/useTaskSubmit.ts
import { App } from 'antd'
import { useCallback, useState } from 'react'
import { tasksApi } from '@/shared/api/endpoints/tasks'
import { translate } from '@/shared/utils/i18n'

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
          message.success(translate('roles.message.update_success'))
        } else {
          await tasksApi.create(payload)
          message.success(translate('orgs.message.create_success'))
        }

        opts.onSuccess?.()
      } catch (e: any) {
        message.error(e?.message || translate('roles.message.save_failed'))
      } finally {
        setSubmitting(false)
      }
    },
    [opts.mode, opts.id, opts.onSuccess, message]
  )

  return { submitting, submit }
}

export default useTaskSubmit
