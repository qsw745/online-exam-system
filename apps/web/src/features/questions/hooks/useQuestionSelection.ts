import { useEffect, useState } from 'react'
import { message } from 'antd'
import { questionsApi } from '../api'
import { isSuccess } from '../utils/api-result'

export function useQuestionSelection(ids: string[], reload: () => void) {
  const [selected, setSelected] = useState<string[]>([])
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (ids.length === 0) setSelected([])
    else if (selected.length > ids.length) setSelected([])
  }, [ids.length])

  const batchDelete = async () => {
    try {
      const tasks = selected.map(id => questionsApi.delete(id))
      const results = await Promise.all(tasks)
      const ok = results.filter(r => isSuccess(r)).length
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
