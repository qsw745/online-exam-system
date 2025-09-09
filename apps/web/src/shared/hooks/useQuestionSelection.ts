// src/shared/hooks/useQuestionSelection.ts
import { useEffect, useState } from 'react'
import { message } from 'antd'
import { questionsApi, isSuccess } from '@/shared/api/http'

export function useQuestionSelection(ids: string[], reload: () => void) {
  const [selected, setSelected] = useState<string[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (ids.length === 0) setSelected([])
    else if (selected.length > ids.length) setSelected([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.length])

  const batchDelete = async () => {
    try {
      const QA: any = questionsApi as any
      const callDelete = (id: string) => {
        if (typeof QA.remove === 'function') return QA.remove(id)
        if (typeof QA.delete === 'function') return QA.delete(id)
        if (typeof QA.destroy === 'function') return QA.destroy(id)
        if (typeof QA.del === 'function') return QA.del(id)
        return Promise.reject(new Error('删除接口未实现'))
      }

      const results = await Promise.all(selected.map(id => callDelete(id)))
      const ok = results.filter((r: any) => isSuccess(r)).length
      const fail = results.length - ok

      if (ok) message.success(`成功删除 ${ok} 道题目${fail ? `，失败 ${fail} 条` : ''}`)
      else message.error('批量删除失败')

      setSelected([])
      setVisible(false)
      reload()
    } catch {
      message.error('批量删除失败')
    }
  }

  return {
    selected,
    setSelected,
    deleteModalVisible: visible,
    setDeleteModalVisible: setVisible,
    batchDelete,
  }
}

export default useQuestionSelection
