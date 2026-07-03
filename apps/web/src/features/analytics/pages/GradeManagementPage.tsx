// apps/web/src/features/analytics/pages/GradeManagementPage.tsx
import { GradeFilters } from '@/features/analytics/components/GradeFilters'
import { GradePagination } from '@/features/analytics/components/GradePagination'
import { GradeStatsCards } from '@/features/analytics/components/GradeStatsCards'
import { GradeTable } from '@/features/analytics/components/GradeTable'
import ResultDetailContent from '@/features/analytics/components/ResultDetailContent'
import { useGrades } from '@/features/analytics/hooks/useGrades'
import { api, isSuccess } from '@/shared/api/http'

import { App, Card, Divider, Drawer, Skeleton, Space, Typography } from 'antd'
import React, { useEffect, useMemo, useState } from 'react'
import { translate } from '@/shared/utils/i18n'
const { Title, Text } = Typography

const GradeManagementPage: React.FC = () => {
  const { message } = App.useApp()
  const {
    loading,
    error,
    stats,
    papers,
    results,
    totalPages,
    totalResults,
    query,
    setSearchTerm,
    setFilterPaper,
    setFilterStatus,
    setPage,
    exportResults,
    statusTagColor,
    statusLabel,
    scoreTextType,
    refetch, // 👈 新增：强制刷新
  } = useGrades(15)

  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (error) message.error(error)
  }, [error, message])

  // ========= 详情抽屉 =========
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState<any | null>(null)
  const openDetail = async (id: number | string) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setDetail(null)
    try {
      const res = await api.get(`/results/${id}`, { params: { include: 'questions' } })
      if (isSuccess(res)) setDetail(res.data as any)
      else throw new Error((res as any).error || '加载详情失败')
    } catch (e: any) {
      message.error(e?.message || translate('auto.02c28cd84c'))
    } finally {
      setDetailLoading(false)
    }
  }

  const onExport = async () => {
    try {
      setExporting(true)
      await exportResults()
      message.success(translate('auto.106030ff68'))
    } catch (e: any) {
      message.error(e?.message || translate('auto.4109877c41'))
    } finally {
      setExporting(false)
    }
  }

  const filtersCard = useMemo(
    () => (
      <Card>
        <GradeFilters
          searchTerm={query.searchTerm}
          onSearchChange={setSearchTerm}
          onSearchSubmit={() => {
            setPage(1)
            refetch() // 👈 即刻刷新
          }}
          papers={papers}
          filterPaper={query.filterPaper}
          filterStatus={query.filterStatus}
          onFilterPaper={v => {
            setFilterPaper(v)
            setPage(1)
          }}
          onFilterStatus={v => {
            setFilterStatus(v)
            setPage(1)
          }}
          onExport={onExport}
          exporting={exporting}
        />
      </Card>
    ),
    [
      papers,
      query.searchTerm,
      query.filterPaper,
      query.filterStatus,
      setSearchTerm,
      setFilterPaper,
      setFilterStatus,
      setPage,
      onExport,
      exporting,
      refetch,
    ]
  )

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <div>
        <Title level={2} style={{ marginBottom: 4 }}>
          {translate('menus.admin-grades')}</Title>
        <Text type="secondary">{translate('auto.06c4e0d6f1')}</Text>
      </div>

      {stats ? <GradeStatsCards stats={stats} /> : <Skeleton active paragraph={{ rows: 2 }} />}

      {filtersCard}

      <Card bodyStyle={{ padding: 0 }}>
        <GradeTable
          results={results}
          statusTagColor={statusTagColor}
          statusLabel={statusLabel}
          scoreTextType={scoreTextType}
          loading={loading}
          onView={r => openDetail(r.id)}
        />
      </Card>

      <Divider style={{ margin: '8px 0' }} />

      <GradePagination
        page={query.page}
        pageSize={query.limit}
        totalPages={totalPages}
        totalResults={totalResults}
        onChange={p => {
          setPage(p)
          refetch() // 翻页也立刻刷新
        }}
      />

      <Drawer title={translate('auto.5cfcc42e70')} width={720} open={detailOpen} onClose={() => setDetailOpen(false)} destroyOnHidden>
        <ResultDetailContent loading={detailLoading} data={detail} />
      </Drawer>
    </Space>
  )
}

export default GradeManagementPage
