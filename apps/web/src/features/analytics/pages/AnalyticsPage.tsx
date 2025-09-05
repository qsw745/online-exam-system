import { App, Spin } from 'antd'
import dayjs from '@shared/utils/dayjs'
import { BarChart3 } from 'lucide-react'
import React, { useMemo, useState } from 'react'
import { useAnalytics, type DateRange } from '@shared/hooks/useAnalytics'
import { AnalyticsFilters } from '../components/AnalyticsFilters'
import { OverviewStats } from '../components/OverviewStats'
import { SubjectsTable } from '../components/SubjectsTable'
import { StudentsTable } from '../components/StudentsTable'
import type { StudentRow } from '../types'

export default function AnalyticsPage() {
  const { message } = App.useApp()

  // 筛选状态
  const [timeRange, setTimeRange] = useState<DateRange>([dayjs().subtract(30, 'day'), dayjs()])
  const [selectedSubject, setSelectedSubject] = useState<string>('all')

  // 学生分页（前端分页，本地 slice）
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const { subjects, data, isLoading, isError, error } = useAnalytics(timeRange, selectedSubject)

  // 错误提示（只在有错误且非 loading 时提示一次）
  if (!isLoading && isError && error) {
    message.error(error.message || '获取统计数据失败')
  }

  // 分页切片
  const { pageItems, totalStudents } = useMemo(() => {
    const list = (data?.students || []) as StudentRow[]
    const total = list.length
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return { pageItems: list.slice(start, end), totalStudents: total }
  }, [data?.students, currentPage, pageSize])

  return (
    <div className="p-6">
      {/* 标题 & 筛选 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <BarChart3 className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold">数据统计</h1>
        </div>
        <AnalyticsFilters
          subjects={subjects}
          selectedSubject={selectedSubject}
          onSubjectChange={s => {
            setSelectedSubject(s)
            setCurrentPage(1)
          }}
          timeRange={timeRange}
          onRangeChange={r => {
            setTimeRange(r)
            setCurrentPage(1)
          }}
        />
      </div>

      <Spin spinning={isLoading}>
        {data && (
          <div className="space-y-6">
            <OverviewStats overview={data.overview} />
            <SubjectsTable data={data.subjects || []} />
            <StudentsTable
              data={pageItems}
              total={totalStudents}
              current={currentPage}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(_c, size) => {
                setPageSize(size)
                setCurrentPage(1)
              }}
            />
          </div>
        )}
      </Spin>
    </div>
  )
}
