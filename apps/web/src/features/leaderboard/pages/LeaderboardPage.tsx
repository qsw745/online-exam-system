import AppBreadcrumb from '@/shared/components/AppBreadcrumb'
import { useLeaderboard } from '@/shared/hooks/useLeaderboard'
import { Card, Tabs } from 'antd'
import { Trophy } from 'lucide-react'
import LeaderboardFilters from '../components/LeaderboardFilters'
import LeaderboardStatsCards from '../components/LeaderboardStatsCards'
import LeaderboardTable from '../components/LeaderboardTable'
export default function LeaderboardPage() {
  const {
    // tabs
    activeTab,
    setActiveTab,
    // filters
    subjects,
    selectedSubject,
    setSelectedSubject,
    timeRange,
    setTimeRange,
    boards,
    boardId,
    setBoardId,
    // stats
    stats,
    loading,
    // table
    pageData,
    totalItems,
    page,
    pageSize,
    setPage,
    setPageSize,
  } = useLeaderboard()

  return (
    <div className="p-6">
      <AppBreadcrumb />
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Trophy className="w-6 h-6 text-yellow-500" />
          <h1 className="text-2xl font-bold">排行榜</h1>
        </div>

        <LeaderboardFilters
          boards={boards}
          boardId={boardId}
          onBoardChange={setBoardId}
          subjects={subjects}
          subject={selectedSubject}
          onSubjectChange={setSelectedSubject}
          timeRange={timeRange}
          onRangeChange={v => setTimeRange(v)}
        />
      </div>

      {/* 统计卡片 */}
      <LeaderboardStatsCards stats={stats} />

      {/* 表格 + Tabs */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={k => {
            setActiveTab(k as any)
            setPage(1)
          }}
          items={[
            {
              key: 'overall',
              label: '综合排名',
              children: (
                <LeaderboardTable
                  data={pageData}
                  loading={loading}
                  total={totalItems}
                  page={page}
                  pageSize={pageSize}
                  onChange={(p, ps) => {
                    setPage(p)
                    if (ps && ps !== pageSize) {
                      setPageSize(ps)
                      setPage(1)
                    }
                  }}
                  onPageSizeChange={(_, s) => {
                    setPageSize(s)
                    setPage(1)
                  }}
                  rowGradient="from-yellow-50 to-orange-50"
                />
              ),
            },
            {
              key: 'study_time',
              label: '学习时长',
              children: (
                <LeaderboardTable
                  data={pageData}
                  loading={loading}
                  total={totalItems}
                  page={page}
                  pageSize={pageSize}
                  onChange={(p, ps) => {
                    setPage(p)
                    if (ps && ps !== pageSize) {
                      setPageSize(ps)
                      setPage(1)
                    }
                  }}
                  onPageSizeChange={(_, s) => {
                    setPageSize(s)
                    setPage(1)
                  }}
                  rowGradient="from-blue-50 to-indigo-50"
                />
              ),
            },
            {
              key: 'accuracy',
              label: '正确率',
              children: (
                <LeaderboardTable
                  data={pageData}
                  loading={loading}
                  total={totalItems}
                  page={page}
                  pageSize={pageSize}
                  onChange={(p, ps) => {
                    setPage(p)
                    if (ps && ps !== pageSize) {
                      setPageSize(ps)
                      setPage(1)
                    }
                  }}
                  onPageSizeChange={(_, s) => {
                    setPageSize(s)
                    setPage(1)
                  }}
                  rowGradient="from-green-50 to-emerald-50"
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
