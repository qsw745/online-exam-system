import { api } from '@shared/api/http'
import { App, Avatar, Badge, Card, Col, DatePicker, Pagination, Row, Select, Spin, Statistic, Table, Tabs } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import { Award, Medal, Target, TrendingUp, Trophy, Users } from 'lucide-react'
import { useEffect, useState } from 'react'

import { createPaginationConfig } from '@shared/constants/pagination'
const { RangePicker } = DatePicker
const { Option } = Select

// ===== 统一 ApiResult 类型与守卫（适配你的 http 封装/拦截器）=====
type ApiSuccess<T = any> = { success: true; data: T; message?: string }
type ApiFailure = { success: false; error?: string; message?: string }
type ApiResult<T = any> = ApiSuccess<T> | ApiFailure
const isSuccess = <T,>(r: any): r is ApiSuccess<T> => r && typeof r === 'object' && r.success === true

// 从各种返回形态里“捞”出数据
function pickData<T>(resp: any, fallback: T): T {
  if (isSuccess<T>(resp)) return (resp.data as T) ?? fallback
  const d = resp?.data
  if (d?.data !== undefined) return (d.data as T) ?? fallback
  return (d as T) ?? fallback
}
// ============================================================

interface LeaderboardEntry {
  id: number
  user_id: number
  username: string
  avatar?: string
  score: number
  rank: number
  total_questions: number
  correct_questions: number
  study_time: number
  streak_days: number
}

interface LeaderboardStats {
  total_participants: number
  avg_score: number
  top_score: number
  my_rank?: number
}

export default function LeaderboardPage() {
  const { message } = App.useApp()
  const [leaderboards, setLeaderboards] = useState<any[]>([])
  const [selectedLeaderboard, setSelectedLeaderboard] = useState<number | null>(null)
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([])
  const [stats, setStats] = useState<LeaderboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overall')

  // ✅ 与 antd RangePicker 对齐的类型
  const [timeRange, setTimeRange] = useState<[Dayjs | null, Dayjs | null] | null>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ])
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [subjects, setSubjects] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalItems, setTotalItems] = useState(0)

  useEffect(() => {
    fetchLeaderboards()
    fetchStats()
    fetchSubjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // activeTab 变化重新拉榜单列表
  useEffect(() => {
    fetchLeaderboards()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  // 选择了具体榜单或筛选变化时刷新数据（如需带上 subject/timeRange，可在后端支持后启用）
  useEffect(() => {
    if (selectedLeaderboard) {
      fetchLeaderboardData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeaderboard])

  // 分页处理函数
  const handlePageChange = (page: number, size?: number) => {
    setCurrentPage(page)
    if (size && size !== pageSize) {
      setPageSize(size)
      setCurrentPage(1)
    }
  }

  const handlePageSizeChange = (_current: number, size: number) => {
    setPageSize(size)
    setCurrentPage(1)
  }

  const onRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    setTimeRange(dates)
  }

  // 获取当前页数据（前端切片，若后端分页请替换为服务端分页）
  const getCurrentPageData = () => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return leaderboardData.slice(startIndex, endIndex)
  }

  const fetchLeaderboards = async () => {
    try {
      setLoading(true)
      const params = {
        category: 'all',
        type: activeTab === 'overall' ? 'all' : activeTab,
        active: true,
      }
      const resp: ApiResult<any> | any = await api.get('/leaderboard', { params })
      const data = pickData<any>(resp, {})
      const list = Array.isArray(data?.leaderboards) ? data.leaderboards : Array.isArray(data) ? data : []
      setLeaderboards(list)
      if (list.length > 0 && !selectedLeaderboard) {
        setSelectedLeaderboard(list[0].id)
      }
    } catch (error) {
      console.error('获取排行榜列表失败:', error)
      message.error('获取排行榜列表失败')
      setLeaderboards([])
    } finally {
      setLoading(false)
    }
  }

  const fetchLeaderboardData = async () => {
    if (!selectedLeaderboard) return
    try {
      setLoading(true)
      const resp: ApiResult<any> | any = await api.get(`/leaderboard/${selectedLeaderboard}`)
      const data = pickData<any>(resp, {})
      const records: LeaderboardEntry[] = Array.isArray(data?.records)
        ? data.records
        : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data)
        ? data
        : []
      setLeaderboardData(records)
      setTotalItems(records.length)
    } catch (error) {
      console.error('获取排行榜数据失败:', error)
      // 使用模拟数据兜底
      const fallback: LeaderboardEntry[] = [
        {
          id: 1,
          user_id: 1,
          username: '张三',
          score: 95.5,
          rank: 1,
          total_questions: 100,
          correct_questions: 95,
          study_time: 120,
          streak_days: 15,
        },
        {
          id: 2,
          user_id: 2,
          username: '李四',
          score: 92.0,
          rank: 2,
          total_questions: 100,
          correct_questions: 92,
          study_time: 110,
          streak_days: 12,
        },
        {
          id: 3,
          user_id: 3,
          username: '王五',
          score: 89.5,
          rank: 3,
          total_questions: 100,
          correct_questions: 89,
          study_time: 105,
          streak_days: 8,
        },
      ]
      setLeaderboardData(fallback)
      setTotalItems(fallback.length)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      // 暂时使用模拟数据
      setStats({
        total_participants: 156,
        avg_score: 78.5,
        top_score: 98.5,
        my_rank: 23,
      })
    } catch (error) {
      console.error('获取排行榜统计失败:', error)
    }
  }

  const fetchSubjects = async () => {
    try {
      // 暂时使用模拟数据
      setSubjects(['数学', '语文', '英语', '物理', '化学', '生物'])
    } catch (error) {
      console.error('获取科目列表失败:', error)
    }
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="w-5 h-5 text-yellow-500" />
      case 2:
        return <Medal className="w-5 h-5 text-gray-400" />
      case 3:
        return <Award className="w-5 h-5 text-orange-500" />
      default:
        return <span className="w-5 h-5 flex items-center justify-center text-sm font-bold text-gray-500">#{rank}</span>
    }
  }

  const getRankBadge = (rank: number) => {
    if (rank <= 3) {
      const colors = ['gold', 'silver', '#cd7f32']
      return <Badge color={colors[rank - 1]} />
    }
    return null
  }

  const formatTime = (minutes: number) => {
    const mins = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0
    const hours = Math.floor(mins / 60)
    const left = mins % 60
    return hours > 0 ? `${hours}h${left}m` : `${left}m`
  }

  const columns = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      render: (rank: number) => <div className="flex items-center justify-center">{getRankIcon(rank)}</div>,
    },
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      render: (username: string, record: LeaderboardEntry) => (
        <div className="flex items-center space-x-3">
          <Avatar src={record.avatar} size={40} className="bg-blue-500">
            {username?.charAt(0)?.toUpperCase?.() || 'U'}
          </Avatar>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-medium">{username}</span>
              {getRankBadge(record.rank)}
            </div>
            <div className="text-xs text-gray-500">ID: {record.user_id}</div>
          </div>
        </div>
      ),
    },
    {
      title: '分数',
      dataIndex: 'score',
      key: 'score',
      sorter: (a: LeaderboardEntry, b: LeaderboardEntry) => b.score - a.score,
      render: (score: number) => <div className="text-lg font-bold text-blue-600">{Number(score).toFixed(1)}</div>,
    },
    {
      title: '正确率',
      key: 'accuracy',
      render: (record: LeaderboardEntry) => {
        const total = Number(record.total_questions) || 0
        const correct = Number(record.correct_questions) || 0
        const accuracy = total > 0 ? (correct / total) * 100 : 0
        return (
          <div className="text-center">
            <div className="font-medium">{accuracy.toFixed(1)}%</div>
            <div className="text-xs text-gray-500">
              {correct}/{total}
            </div>
          </div>
        )
      },
    },
    {
      title: '学习时长',
      dataIndex: 'study_time',
      key: 'study_time',
      render: (time: number) => <div className="text-center font-medium">{formatTime(time)}</div>,
    },
    {
      title: '连续天数',
      dataIndex: 'streak_days',
      key: 'streak_days',
      render: (days: number) => (
        <div className="text-center">
          <Badge count={Number(days) || 0} style={{ backgroundColor: '#52c41a' }} />
        </div>
      ),
    },
  ]

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Trophy className="w-6 h-6 text-yellow-500" />
          <h1 className="text-2xl font-bold">排行榜</h1>
        </div>
        <div className="flex items-center space-x-4">
          <Select
            value={selectedLeaderboard ?? undefined}
            onChange={v => setSelectedLeaderboard(v)}
            style={{ width: 200 }}
            placeholder="选择排行榜"
          >
            {leaderboards.map(board => (
              <Option key={board.id} value={board.id}>
                {board.name ?? `榜单 #${board.id}`}
              </Option>
            ))}
          </Select>
          <Select value={selectedSubject} onChange={setSelectedSubject} style={{ width: 120 }}>
            <Option value="all">全部科目</Option>
            {subjects.map(subject => (
              <Option key={subject} value={subject}>
                {subject}
              </Option>
            ))}
          </Select>
          <RangePicker value={timeRange} onChange={onRangeChange} format="YYYY-MM-DD" />
        </div>
      </div>

      {/* 统计概览 */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="参与人数"
              value={stats?.total_participants || 0}
              prefix={<Users className="w-4 h-4 text-blue-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="平均分数"
              value={stats?.avg_score || 0}
              precision={1}
              prefix={<Target className="w-4 h-4 text-green-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="最高分数"
              value={stats?.top_score || 0}
              precision={1}
              prefix={<TrendingUp className="w-4 h-4 text-orange-500" />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="我的排名"
              value={stats?.my_rank ?? '-'}
              prefix={<Award className="w-4 h-4 text-purple-500" />}
            />
          </Card>
        </Col>
      </Row>

      {/* 排行榜表格 */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={k => {
            setActiveTab(k)
            // 切换标签时重置分页
            setCurrentPage(1)
          }}
          items={[
            {
              key: 'overall',
              label: '综合排名',
              children: (
                <Spin spinning={loading}>
                  <Table
                    columns={columns as any}
                    dataSource={getCurrentPageData()}
                    rowKey="id"
                    pagination={false}
                    rowClassName={(record: any) =>
                      record.rank <= 3 ? 'bg-gradient-to-r from-yellow-50 to-orange-50' : ''
                    }
                  />
                  <Pagination
                    current={currentPage}
                    total={totalItems}
                    pageSize={pageSize}
                    onChange={handlePageChange}
                    onShowSizeChange={handlePageSizeChange}
                    {...createPaginationConfig()}
                  />
                </Spin>
              ),
            },
            {
              key: 'study_time',
              label: '学习时长',
              children: (
                <Spin spinning={loading}>
                  <Table
                    columns={columns as any}
                    dataSource={getCurrentPageData()}
                    rowKey="id"
                    pagination={false}
                    rowClassName={(record: any) =>
                      record.rank <= 3 ? 'bg-gradient-to-r from-blue-50 to-indigo-50' : ''
                    }
                  />
                  <Pagination
                    current={currentPage}
                    total={totalItems}
                    pageSize={pageSize}
                    onChange={handlePageChange}
                    onShowSizeChange={handlePageSizeChange}
                    {...createPaginationConfig()}
                  />
                </Spin>
              ),
            },
            {
              key: 'accuracy',
              label: '正确率',
              children: (
                <Spin spinning={loading}>
                  <Table
                    columns={columns as any}
                    dataSource={getCurrentPageData()}
                    rowKey="id"
                    pagination={false}
                    rowClassName={(record: any) =>
                      record.rank <= 3 ? 'bg-gradient-to-r from-green-50 to-emerald-50' : ''
                    }
                  />
                  <Pagination
                    current={currentPage}
                    total={totalItems}
                    pageSize={pageSize}
                    onChange={handlePageChange}
                    onShowSizeChange={handlePageSizeChange}
                    {...createPaginationConfig()}
                  />
                </Spin>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}
