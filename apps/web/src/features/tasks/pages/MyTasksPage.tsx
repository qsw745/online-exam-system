// src/features/tasks/pages/MyTasksPage.tsx
import React from 'react'
import { Alert, Card, Space, Input, Select, DatePicker, Button, App, Typography } from 'antd'
import { useNavigate } from 'react-router-dom'
import { TasksTable } from '../components/TasksTable'
import MobileTaskList from '../components/MobileTaskList'
import { useTasksQuery, type Task, type TaskFilters } from '../hooks/useTasksQuery'
import dayjs from '@/shared/utils/dayjs'
import GlobalPagination from '@/shared/components/GlobalPagination'
import { translate } from '@/shared/utils/i18n'
import { useIsMobile } from '@/shared/hooks/useMobile'
import { resolveAppTarget } from '@/platform/appTarget'

const { RangePicker } = DatePicker

const MyTasksPage: React.FC = () => {
  const nav = useNavigate()
  const { message } = App.useApp()
  const isMobile = useIsMobile()
  const isNativeApp = resolveAppTarget(import.meta.env.VITE_APP_TARGET) === 'ios'

  const { rows, total, page, pageSize, setPage, setPageSize, loading, error, refetch, filters, search, reset } = useTasksQuery(10, {
    scope: 'mine',
  })

  const [kw, setKw] = React.useState(filters.keyword || '')
  const [st, setSt] = React.useState(filters.status || 'all')
  const [rg, setRg] = React.useState<any>(filters.range || null)
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [filtersExpanded, setFiltersExpanded] = React.useState(false)

  const applySearch = () => {
    if (isMobile && ((!!startDate !== !!endDate) || (startDate && startDate > endDate))) {
      message.warning('请选择完整的日期范围，结束日期不能早于开始日期')
      return
    }
    const next: TaskFilters = {
      keyword: kw.trim() || undefined,
      status: st || 'all',
      range: isMobile ? (startDate && endDate ? [dayjs(startDate), dayjs(endDate)] : null) : rg && rg.length === 2 ? rg : null,
    }
    search(next)
  }

  const handleStart = async (r: Task) => {
    try {
      if (r.my_result_id && ['completed', 'submitted', 'graded'].includes(String(r.my_result_status || '').toLowerCase())) {
        nav(`/results/${r.my_result_id}`)
        return
      }
      if (r.type !== 'exam') {
        nav(`/learning/practice?taskId=${encodeURIComponent(r.id)}`)
        return
      }
      nav(`/exam/task/${r.id}`)
    } catch (e: any) {
      message.error(e?.message || translate('auto.3ff424111a'))
    }
  }

  return (
    <Space className="student-tasks-page" direction="vertical" size={16} style={{ width: '100%' }}>
      {isNativeApp && <div><Typography.Title level={2}>任务</Typography.Title><Typography.Text type="secondary">查看考试与练习安排。</Typography.Text></div>}
      <Card title={isNativeApp ? '查找任务' : translate('menus.tasks-my')} variant="outlined"
        extra={isMobile && <Button type="text" aria-expanded={filtersExpanded} aria-controls="student-task-advanced"
          onClick={() => setFiltersExpanded(value => !value)}>{filtersExpanded ? '收起筛选' : '筛选条件'}</Button>}>
        <Space className="student-task-filters" wrap>
          <Input
            aria-label="任务关键词"
            placeholder={translate('aiLogs.keyword')}
            allowClear
            value={kw}
            onChange={e => setKw(e.target.value)}
            onPressEnter={applySearch}
            style={{ width: 240 }}
          />
          {(!isMobile || filtersExpanded) && <Space id="student-task-advanced" className="student-task-advanced" wrap>
          <Select
            aria-label="任务状态"
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
          {isMobile ? <div className="student-task-date-range">
            <label>开始日期<input type="date" value={startDate} max={endDate || undefined} onChange={e => {
              setStartDate(e.target.value)
              setRg(e.target.value && endDate ? [dayjs(e.target.value), dayjs(endDate)] : null)
            }} /></label>
            <label>结束日期<input type="date" value={endDate} min={startDate || undefined} onChange={e => {
              setEndDate(e.target.value)
              setRg(startDate && e.target.value ? [dayjs(startDate), dayjs(e.target.value)] : null)
            }} /></label>
          </div> : <RangePicker
            value={rg}
            onChange={v => {
              setRg(v || null)
              setStartDate(v?.[0]?.format('YYYY-MM-DD') || '')
              setEndDate(v?.[1]?.format('YYYY-MM-DD') || '')
            }}
          />}
          </Space>}
          <Space className="student-task-filter-actions">
          <Button type="primary" onClick={applySearch}>
            {translate('auto.711363c424')}</Button>
          <Button
            onClick={() => {
              setKw('')
              setSt('all')
              setRg(null)
              setStartDate('')
              setEndDate('')
              reset()
            }}
          >
            {translate('app.reset')}</Button>
          </Space>
        </Space>
      </Card>

      <Card variant="outlined">
        {error ? (
          <Alert type="error" showIcon message="任务加载失败" description={error}
            action={<Button loading={loading} onClick={() => void refetch()}>重试</Button>} />
        ) : isMobile || resolveAppTarget(import.meta.env.VITE_APP_TARGET) === 'ios' ? (
          <MobileTaskList tasks={rows} loading={loading} onStart={handleStart} onView={task => nav(`/tasks/detail/${task.id}`)} />
        ) : (
          <TasksTable
            data={rows}
            loading={loading}
            showPublishActions={false}
            showStartAction
            onStart={handleStart}
            onViewResult={(task: Task) => {
              if (task.my_result_id) nav(`/results/${task.my_result_id}`)
            }}
          />
        )}

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
