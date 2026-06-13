// src/features/dashboard/pages/DashboardPage.tsx
import React, { useEffect } from 'react'
import { Space, Typography, Row, Col, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { useDashboard } from '@/shared/hooks/useDashboard'
import { tasksApi } from '@/shared/api/endpoints/tasks'
import { isSuccess } from '@/shared/api/http'
import { DashboardStatsCards } from '../components/DashboardStatsCards'
import { RecentTasksList } from '../components/RecentTasksList'
import { RecentResultsList } from '../components/RecentResultsList'

const { Title, Text } = Typography

const DashboardPage: React.FC = () => {
  const { t, language } = useLanguage()
  const locale = (language === 'zh-CN' ? 'zh-CN' : 'en-US') as 'zh-CN' | 'en-US'
  const nav = useNavigate()

  // ✅ 只能在组件函数体内调用 Hook
  const { stats, recentTasks, recentResults, isLoading, isError, errorMessages } = useDashboard(5)

  // ✅ 依赖 recentTasks 的 useMemo 也必须放在组件内
  const recentTasksForList = React.useMemo(
    () =>
      (recentTasks || []).map(t => ({
        ...t,
        // 兜底字段，避免类型不匹配
        type: (t as any).type ?? (t as any).task_type ?? ((t as any).isExam ? 'exam' : 'practice'),
        status: (t as any).status ?? (t as any).state ?? 'pending',
      })),
    [recentTasks]
  )

  useEffect(() => {
    if (isError && errorMessages.length) message.error(errorMessages[0])
  }, [isError, errorMessages])

  const handleStartTask = React.useCallback(
    async (task: any) => {
      if (!task) return
      try {
        if (task.type !== 'exam') {
          nav(`/learning/practice/${task.id}`)
          return
        }
        const res: any = await tasksApi.startExam?.(task.id)
        if (!isSuccess(res)) throw new Error(res?.message || res?.error || '开始任务失败')
        const payload = res.data ?? {}
        const examId = payload.examId ?? payload.exam_id ?? task.exam_id
        if (!examId) throw new Error('未获取到考试ID')
        nav(`/exam/${examId}`, { state: { ...payload, taskId: task.id } })
      } catch (e: any) {
        message.error(e?.message || '无法开始任务，请稍后重试')
      }
    },
    [nav]
  )

  // 可选：你也可以在 loading 时给个整页骨架
  // if (isLoading) {
  //   return <LoadingSpinner center="page" text={t('dashboard.loading')} />
  // }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={2} style={{ marginBottom: 8 }}>
          {t('dashboard.title')}
        </Title>
        <Text type="secondary">{t('dashboard.description')}</Text>
      </div>

      <DashboardStatsCards
        stats={stats}
        labels={{
          total: t('dashboard.total_tasks'),
          completed: t('dashboard.completed_tasks'),
          average: t('dashboard.average_score'),
          best: t('dashboard.best_score'),
        }}
      />

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <RecentTasksList
            title={t('dashboard.recent_tasks')}
            viewAllText={t('dashboard.view_all')}
            emptyText={t('dashboard.no_tasks')}
            tasks={recentTasksForList}
            locale={locale}
            label={{
              start: t('dashboard.start_time'),
              exam: t('dashboard.exam'),
              practice: t('dashboard.practice'),
            }}
            onStartTask={handleStartTask}
          />
        </Col>

        <Col xs={24} lg={12}>
          <RecentResultsList
            title={t('dashboard.recent_results')}
            viewAllText={t('dashboard.view_all')}
            emptyText={t('dashboard.no_results')}
            results={recentResults as any} // 若还有类型不兼容，先保持 as any，等统一类型后再收紧
            locale={locale}
            label={{ submit: t('dashboard.submit_time'), score: t('dashboard.score') }}
          />
        </Col>
      </Row>
    </Space>
  )
}

export default DashboardPage
