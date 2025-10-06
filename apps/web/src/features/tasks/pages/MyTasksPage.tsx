// src/features/tasks/pages/MyTasksPage.tsx
import React from 'react'
import { Card, Pagination, Space, Input, Select, DatePicker, Button, App } from 'antd'
import { useNavigate } from 'react-router-dom'
import { TasksTable } from '../components/TasksTable'
import { useTasksQuery, type TaskFilters } from '../hooks/useTasksQuery'
import dayjs from '@/shared/utils/dayjs'
import { tasksApi } from '@/shared/api/endpoints/tasks'
import { isSuccess } from '@/shared/api/http'

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
      message.error(e?.message || '开始考试失败')
    }
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Card title="我的任务" variant="outlined">
        <Space wrap>
          <Input
            placeholder="关键词"
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
              { value: 'all', label: '全部状态' },
              { value: 'not_started', label: '待开始' },
              { value: 'published', label: '已发布' },
              { value: 'in_progress', label: '进行中' },
              { value: 'completed', label: '已完成' },
              { value: 'expired', label: '已过期' },
            ]}
          />
          <RangePicker
            value={rg}
            onChange={v => setRg(v || null)}
            showTime
            disabledDate={d => !!d && d > dayjs().endOf('day')}
          />
          <Button type="primary" onClick={applySearch}>
            查询
          </Button>
          <Button
            onClick={() => {
              setKw('')
              setSt('all')
              setRg(null)
              reset()
            }}
          >
            重置
          </Button>
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

        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end' }}>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            showSizeChanger
            showQuickJumper
            onChange={(p, ps) => {
              setPage(p)
              setPageSize(ps)
            }}
            showTotal={(t, r) => `共 ${t} 条，当前 ${r[0]}-${r[1]}`}
          />
        </div>
      </Card>
    </Space>
  )
}

export default MyTasksPage
