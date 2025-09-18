import { GradeFilters } from '@/features/analytics/components/GradeFilters'
import { GradePagination } from '@/features/analytics/components/GradePagination'
import { GradeStatsCards } from '@/features/analytics/components/GradeStatsCards'
import { GradeTable } from '@/features/analytics/components/GradeTable'
import { useGrades } from '@/features/analytics/hooks/useGrades'
import LoadingSpinner from '@/shared/components/LoadingSpinner'
import { App } from 'antd'
import React, { useEffect, useState } from 'react'

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
    statusClass,
    statusLabel,
    scoreClass,
  } = useGrades(15)

  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (error) message.error(error)
  }, [error, message])

  if (loading && results.length === 0) {
    return <LoadingSpinner center="page" text="加载中…" />
  }

  const onExport = async () => {
    try {
      setExporting(true)
      await exportResults()
      message.success('成绩报告导出成功')
    } catch (e: any) {
      message.error(e?.message || '导出成绩报告失败')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">成绩管理</h1>
        <p className="text-gray-600">查看和管理学生考试成绩</p>
      </div>

      {/* 统计卡片 */}
      {stats && <GradeStatsCards stats={stats} />}

      {/* 搜索 & 筛选 */}
      <GradeFilters
        searchTerm={query.searchTerm}
        onSearchChange={setSearchTerm}
        onSearchSubmit={() => setPage(1)}
        papers={papers}
        filterPaper={query.filterPaper}
        filterStatus={query.filterStatus}
        onFilterPaper={setFilterPaper}
        onFilterStatus={setFilterStatus}
        onExport={onExport}
        exporting={exporting}
      />

      {/* 成绩列表 */}
      <GradeTable
        results={results}
        statusClass={statusClass}
        statusLabel={statusLabel}
        scoreClass={scoreClass}
        loading={loading}
      />

      {/* 分页 */}
      <GradePagination
        page={query.page}
        pageSize={query.limit}
        totalPages={totalPages}
        totalResults={totalResults}
        onChange={setPage}
      />
    </div>
  )
}

export default GradeManagementPage
