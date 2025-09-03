import { tasks, users } from '@shared/api/http'
import LoadingSpinner from '@shared/components/LoadingSpinner'
import { DatePicker, message, TreeSelect } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { ArrowLeft, Save, Users as UsersIcon } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

type ApiFailure = { success: false; error?: string }
function isFailure(r: any): r is ApiFailure {
  return r && r.success === false
}

const TaskCreatePage: React.FC = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const isEditMode = Boolean(id) && window.location.pathname.includes('/task-edit/')
  const isViewMode = Boolean(id) && window.location.pathname.includes('/task-detail/')

  const [loading, setLoading] = useState(Boolean(id))
  const [submitting, setSubmitting] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [endDate, setEndDate] = useState<Date>(new Date(new Date().setDate(new Date().getDate() + 7)))
  const [status, setStatus] = useState('not_started')
  const [type, setType] = useState('practice')
  const [examId, setExamId] = useState('')
  const [assignedUserIds, setAssignedUserIds] = useState<string[]>([])
  const [usersList, setUsersList] = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)

  useEffect(() => {
    if (id) loadTask(id)
    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const loadUsers = async () => {
    try {
      setLoadingUsers(true)
      const res = await users.getAll({ page: 1, limit: 1000 })
      if (isFailure(res)) throw new Error(res.error || '加载用户列表失败')
      const payload: any = (res as any).data ?? res
      const list = Array.isArray(payload) ? payload : payload?.users ?? payload?.items ?? payload?.list ?? []
      setUsersList(Array.isArray(list) ? list : [])
    } catch (error: any) {
      console.error('加载用户列表错误:', error)
      message.error(error?.message || '加载用户列表失败')
      setUsersList([])
    } finally {
      setLoadingUsers(false)
    }
  }

  const loadTask = async (taskId: string) => {
    try {
      setLoading(true)
      const res = await tasks.getById(taskId)
      if (isFailure(res)) throw new Error(res.error || '加载任务失败')

      const payload: any = (res as any).data ?? res
      const taskData = payload?.task ?? payload?.data ?? payload // 兜底

      if (!taskData) throw new Error('任务数据为空')

      setTitle(taskData.title ?? '')
      setDescription(taskData.description ?? '')
      if (taskData.start_time) setStartDate(new Date(taskData.start_time))
      if (taskData.end_time) setEndDate(new Date(taskData.end_time))
      setStatus(taskData.status ?? 'not_started')
      setType(taskData.type ?? 'practice')
      setExamId(taskData.exam_id ?? '')

      // 分配用户
      if (Array.isArray(taskData.assigned_users)) {
        setAssignedUserIds(taskData.assigned_users.map((u: any) => String(u.id)))
      } else if (taskData.user_id) {
        setAssignedUserIds([String(taskData.user_id)])
      } else {
        setAssignedUserIds([])
      }
    } catch (error: any) {
      console.error('加载任务错误:', error)
      message.error(error?.message || error?.response?.data?.message || '加载任务失败')
      navigate('/admin/tasks')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return message.error('请输入任务标题')
    if (!description.trim()) return message.error('请输入任务描述')
    if (!startDate) return message.error('请选择开始时间')
    if (!endDate) return message.error('请选择结束时间')
    if (startDate >= endDate) return message.error('结束时间必须晚于开始时间')

    try {
      setSubmitting(true)
      const taskData = {
        title,
        description,
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        status,
        type,
        exam_id: examId || undefined,
        assigned_user_ids: assignedUserIds.length > 0 ? assignedUserIds.map(id => parseInt(id, 10)) : undefined,
      }

      if (isEditMode && id) {
        const res = await tasks.update(id, taskData)
        if (isFailure(res)) throw new Error(res.error || '任务更新失败')
        message.success('任务更新成功')
      } else {
        const res = await tasks.create(taskData)
        if (isFailure(res)) throw new Error(res.error || '任务创建失败')
        message.success('任务创建成功')
      }
      navigate('/admin/tasks')
    } catch (error: any) {
      console.error('保存任务错误:', error)
      message.error(error?.message || error?.response?.data?.message || '保存任务失败')
    } finally {
      setSubmitting(false)
    }
  }

  const getPageTitle = () => (isViewMode ? '查看任务' : isEditMode ? '编辑任务' : '创建任务')
  const getPageDescription = () => (isViewMode ? '查看任务详细信息' : isEditMode ? '编辑任务信息' : '创建一个新的任务')

  if (loading) return <LoadingSpinner text="加载中..." />

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{getPageTitle()}</h1>
          <p className="text-gray-600 mt-1">{getPageDescription()}</p>
        </div>
        <button
          onClick={() => navigate('/admin/tasks')}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          返回任务列表
        </button>
      </div>

      {/* 创建/编辑表单 */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="space-y-6">
          {/* 基本信息 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                任务标题 *
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                disabled={isViewMode}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                placeholder="输入任务标题"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="examId" className="block text-sm font-medium text-gray-700">
                考试ID
              </label>
              <input
                id="examId"
                type="text"
                value={examId}
                onChange={e => setExamId(e.target.value)}
                disabled={isViewMode || type !== 'exam'}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
                placeholder="仅考试类型需要填写"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                任务状态 *
              </label>
              <select
                id="status"
                value={status}
                onChange={e => setStatus(e.target.value)}
                disabled={isViewMode}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="not_started">待开始</option>
                <option value="in_progress">进行中</option>
                <option value="completed">已完成</option>
                <option value="expired">已过期</option>
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="type" className="block text-sm font-medium text-gray-700">
                任务类型 *
              </label>
              <select
                id="type"
                value={type}
                onChange={e => setType(e.target.value)}
                disabled={isViewMode}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500"
              >
                <option value="practice">练习</option>
                <option value="exam">考试</option>
              </select>
            </div>
          </div>

          {/* 用户分配 */}
          <div className="space-y-2">
            <label htmlFor="assignedUsers" className="block text-sm font-medium text-gray-700 flex items-center gap-2">
              <UsersIcon className="w-4 h-4" />
              分配给用户（多选）
            </label>
            <TreeSelect
              id="assignedUsers"
              value={assignedUserIds}
              onChange={value => setAssignedUserIds(Array.isArray(value) ? value : [])}
              disabled={isViewMode || loadingUsers}
              placeholder="选择用户（留空则分配给自己）"
              multiple
              treeCheckable
              showCheckedStrategy={TreeSelect.SHOW_PARENT}
              style={{ width: '100%' }}
              className="w-full"
              treeData={[
                {
                  title: '管理员',
                  value: 'admin',
                  key: 'admin',
                  selectable: false,
                  children: usersList
                    .filter(user => user.role === 'admin')
                    .map((user: any) => ({
                      title: `${user.username} (${user.email})`,
                      value: user.id.toString(),
                      key: user.id.toString(),
                    })),
                },
                {
                  title: '教师',
                  value: 'teacher',
                  key: 'teacher',
                  selectable: false,
                  children: usersList
                    .filter(user => user.role === 'teacher')
                    .map((user: any) => ({
                      title: `${user.username} (${user.email})`,
                      value: user.id.toString(),
                      key: user.id.toString(),
                    })),
                },
                {
                  title: '学生',
                  value: 'student',
                  key: 'student',
                  selectable: false,
                  children: usersList
                    .filter(user => user.role === 'student')
                    .map((user: any) => ({
                      title: `${user.username} (${user.email})`,
                      value: user.id.toString(),
                      key: user.id.toString(),
                    })),
                },
              ]}
              treeNodeFilterProp="title"
              showSearch
              // 将 title 安全转换为字符串，避免 toLowerCase 类型报错
              filterTreeNode={(searchValue, treeNode: any) => {
                const titleStr = String(treeNode?.title ?? '')
                return titleStr.toLowerCase().includes(String(searchValue ?? '').toLowerCase())
              }}
            />
            {loadingUsers && <p className="text-sm text-gray-500">正在加载用户列表...</p>}
            {assignedUserIds.length > 0 && (
              <p className="text-sm text-blue-600">已选择 {assignedUserIds.length} 个用户</p>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              任务描述 *
            </label>
            <textarea
              id="description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={isViewMode}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-500 min-h-[120px]"
              placeholder="输入任务描述"
            />
          </div>

          {/* 时间选择 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">开始时间 *</label>
              <DatePicker
                value={dayjs(startDate)}
                onChange={(v: Dayjs | null) => v && setStartDate(v.toDate())}
                disabled={isViewMode}
                placeholder="选择开始日期"
                format="YYYY年MM月DD日"
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">结束时间 *</label>
              <DatePicker
                value={dayjs(endDate)}
                onChange={(v: Dayjs | null) => v && setEndDate(v.toDate())}
                disabled={isViewMode}
                placeholder="选择结束日期"
                format="YYYY年MM月DD日"
                className="w-full"
              />
            </div>
          </div>

          {/* 提交按钮 */}
          <div className="flex justify-end pt-4 border-top border-gray-200">
            <button
              type="button"
              onClick={() => navigate('/admin/tasks')}
              className="mr-4 px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              取消
            </button>

            {!isViewMode && (
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-80 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5" />
                {submitting ? '保存中...' : isEditMode ? '更新任务' : '创建任务'}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}

export default TaskCreatePage
