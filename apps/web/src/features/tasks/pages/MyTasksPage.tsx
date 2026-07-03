// src/features/tasks/pages/MyTasksPage.tsx
import React from 'react'
import { Card, Space, Input, Select, DatePicker, Button, App } from 'antd'
import { useNavigate } from 'react-router-dom'
import { TasksTable } from '../components/TasksTable'
import { useTasksQuery, type TaskFilters } from '../hooks/useTasksQuery'
import dayjs from '@/shared/utils/dayjs'
import { tasksApi } from '@/shared/api/endpoints/tasks'
import { isSuccess } from '@/shared/api/http'
import GlobalPagination from '@/shared/components/GlobalPagination'
import { translate } from '@/shared/utils/i18n'

const { RangePicker } = DatePicker

const MyTasksPage: React.FC = () => {
  const nav = useNavigate()
  const { message } = App.useApp()

  const { rows, total, page, pageSize, setPage, setPageSize, loading, filters, search, reset } = useTasksQuery(10, {
    scope: 'mine',
  })

  const [kw, setKw] = React.useState(filters.keyword || '')
  const [st, setSt] = React.useState(filters.status || 'all')
  const [rg, setRg] = React.useState<any>(filters.range || null)

  const applySearch = () => {
    const next: TaskFilters = {
      keyword: kw || undefined,
      status: st || 'all',
      range: rg && rg.length === 2 ? rg : null,
    }
    search(next)
  }

  const handleStart = async (r: any) => {
    try {
      if (r.type !== 'exam') {
        nav(`/learning/practice/${r.id}`)
        return
      }
      const res: any = await tasksApi.startExam(r.id)
      if (!isSuccess(res)) throw new Error(res?.message || '开始考试失败')
      const payload = res.data
      nav(`/exam/${payload.examId}`, { state: { ...payload, taskId: r.id } })
    } catch (e: any) {
      message.error(e?.message || translate('auto.3ff424111a'))
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card title={translate('menus.tasks-my')} variant="outlined">
        <Space wrap>
          <Input
            placeholder={translate('aiLogs.keyword')}
            allowClear
            value={kw}
            onChange={e => setKw(e.target.value)}
            onPressEnter={applySearch}
            style={{ width: 240 }}
          />
          <Select
            style={{ width: 160 }}
            value={st}
            onChange={setSt}
            options={[
              { value: 'all', label: translate('auto.1a4c26d92d') },
              { value: 'not_started', label: translate('auto.5349eb3e57') },
              { value: 'published', label: translate('auto.176a2eb4eb') },
              { value: 'in_progress', label: translate('dashboard.status_in_progress') },
              { value: 'completed', label: translate('dashboard.status_completed') },
              { value: 'expired', label: translate('dashboard.status_expired') },
            ]}
          />
          <RangePicker
            value={rg}
            onChange={v => setRg(v || null)}
            showTime
          />
          <Button type="primary" onClick={applySearch}>
            {translate('auto.711363c424')}</Button>
          <Button
            onClick={() => {
              setKw('')
              setSt('all')
              setRg(null)
              reset()
            }}
          >
            {translate('app.reset')}</Button>
        </Space>
      </Card>

      <Card variant="outlined">
        <TasksTable
          data={rows as any}
          loading={loading}
          showPublishActions={false}
          showStartAction
          onStart={handleStart}
        />

        <GlobalPagination
          total={total}
          current={page}
          pageSize={pageSize}
          onChange={(p, size) => {
            setPage(p)
            setPageSize(size)
          }}
        />
      </Card>
    </Space>
  )
}

export default MyTasksPage
