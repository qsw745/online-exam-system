import React, { useState, useEffect } from 'react'
import { Card, Table, Avatar, Badge, Select, DatePicker, Tabs, Statistic, Row, Col, Spin, App } from 'antd'
import { Trophy, Medal, Award, TrendingUp, Users, Target } from 'lucide-react'
import { api } from '../lib/api'
import dayjs from 'dayjs'

const { RangePicker } = DatePicker
const { Option } = Select
// const { TabPane } = Tabs // 已弃用，使用 items 属性替代

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
  const [timeRange, setTimeRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>([
    dayjs().subtract(30, 'day'),
    dayjs()
  ])
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [subjects, setSubjects] = useState<string[]>([])

  useEffect(() => {
    fetchLeaderboards()
    fetchStats()
    fetchSubjects()
  }, [])

  useEffect(() => {
    if (selectedLeaderboard) {
      fetchLeaderboardData()
    }
  }, [selectedLeaderboard])

  const fetchLeaderboards = async () => {
    try {
      setLoading(true)
      const params = {
        category: 'all',
        type: activeTab === 'overall' ? 'all' : activeTab,
        active: true
      }
      const response = await api.get('/leaderboard', { params })
      const leaderboardList = response.data.data?.leaderboards || []
      setLeaderboards(leaderboardList)
      if (leaderboardList.length > 0 && !selectedLeaderboard) {
        setSelectedLeaderboard(leaderboardList[0].id)
      }
    } catch (error) {
      console.error('获取排行榜列表失败:', error)
      message.error('获取排行榜列表失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchLeaderboardData = async () => {
    if (!selectedLeaderboard) return
    
    try {
      setLoading(true)
      const response = await api.get(`/leaderboard/${selectedLeaderboard}`)
      setLeaderboardData(response.data.data?.records || [])
    } catch (error) {
      console.error('获取排行榜数据失败:', error)
      // 使用模拟数据
      setLeaderboardData([
        {
          id: 1,
          user_id: 1,
          username: '张三',
          score: 95.5,
          rank: 1,
          total_questions: 100,
          correct_questions: 95,
          study_time: 120,
          streak_days: 15
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
          streak_days: 12
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
          streak_days: 8
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      // 暂时使用模拟数据，因为后端还没有统计API
      setStats({
        total_participants: 156,
        avg_score: 78.5,
        top_score: 98.5,
        my_rank: 23
      })
    } catch (error) {
      console.error('获取排行榜统计失败:', error)
    }
  }

  const fetchSubjects = async () => {
    try {
      // 暂时使用模拟数据，因为后端还没有科目API
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
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return hours > 0 ? `${hours}h${mins}m` : `${mins}m`
  }

  const columns = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      render: (rank: number) => (
        <div className="flex items-center justify-center">
          {getRankIcon(rank)}
        </div>
      )
    },
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      render: (username: string, record: LeaderboardEntry) => (
        <div className="flex items-center space-x-3">
          <Avatar 
            src={record.avatar} 
            size={40}
            className="bg-blue-500"
          >
            {username.charAt(0).toUpperCase()}
          </Avatar>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-medium">{username}</span>
              {getRankBadge(record.rank)}
            </div>
            <div className="text-xs text-gray-500">ID: {record.user_id}</div>
          </div>
        </div>
      )
    },
    {
      title: '分数',
      dataIndex: 'score',
      key: 'score',
      sorter: (a: LeaderboardEntry, b: LeaderboardEntry) => b.score - a.score,
      render: (score: number) => (
        <div className="text-lg font-bold text-blue-600">{score.toFixed(1)}</div>
      )
    },
    {
      title: '正确率',
      key: 'accuracy',
      render: (record: LeaderboardEntry) => {
        const accuracy = record.total_questions > 0 
          ? (record.correct_questions / record.total_questions * 100)
          : 0
        return (
          <div className="text-center">
            <div className="font-medium">{accuracy.toFixed(1)}%</div>
            <div className="text-xs text-gray-500">
              {record.correct_questions}/{record.total_questions}
            </div>
          </div>
        )
      }
    },
    {
      title: '学习时长',
      dataIndex: 'study_time',
      key: 'study_time',
      render: (time: number) => (
        <div className="text-center font-medium">{formatTime(time)}</div>
      )
    },
    {
      title: '连续天数',
      dataIndex: 'streak_days',
      key: 'streak_days',
      render: (days: number) => (
        <div className="text-center">
          <Badge count={days} style={{ backgroundColor: '#52c41a' }} />
        </div>
      )
    }
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
            value={selectedLeaderboard}
            onChange={setSelectedLeaderboard}
            style={{ width: 200 }}
            placeholder="选择排行榜"
          >
            {leaderboards.map(board => (
              <Option key={board.id} value={board.id}>{board.name}</Option>
            ))}
          </Select>
          <Select
            value={selectedSubject}
            onChange={setSelectedSubject}
            style={{ width: 120 }}
          >
            <Option value="all">全部科目</Option>
            {subjects.map(subject => (
              <Option key={subject} value={subject}>{subject}</Option>
            ))}
          </Select>
          <RangePicker
            value={timeRange}
            onChange={setTimeRange}
            format="YYYY-MM-DD"
          />
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
              value={stats?.my_rank || '-'}
              prefix={<Award className="w-4 h-4 text-purple-500" />}
            />
          </Card>
        </Col>
      </Row>

      {/* 排行榜表格 */}
      <Card>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          items={[
            {
              key: 'overall',
              label: '综合排名',
              children: (
                <Spin spinning={loading}>
                  <Table
                    columns={columns}
                    dataSource={leaderboardData}
                    rowKey="id"
                    pagination={{
                      pageSize: 20,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total) => `共 ${total} 条记录`
                    }}
                    rowClassName={(record) => 
                      record.rank <= 3 ? 'bg-gradient-to-r from-yellow-50 to-orange-50' : ''
                    }
                  />
                </Spin>
              )
            },
            {
              key: 'study_time',
              label: '学习时长',
              children: (
                <Spin spinning={loading}>
                  <Table
                    columns={columns}
                    dataSource={leaderboardData}
                    rowKey="id"
                    pagination={{
                      pageSize: 20,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total) => `共 ${total} 条记录`
                    }}
                    rowClassName={(record) => 
                      record.rank <= 3 ? 'bg-gradient-to-r from-blue-50 to-indigo-50' : ''
                    }
                  />
                </Spin>
              )
            },
            {
              key: 'accuracy',
              label: '正确率',
              children: (
                <Spin spinning={loading}>
                  <Table
                    columns={columns}
                    dataSource={leaderboardData}
                    rowKey="id"
                    pagination={{
                      pageSize: 20,
                      showSizeChanger: true,
                      showQuickJumper: true,
                      showTotal: (total) => `共 ${total} 条记录`
                    }}
                    rowClassName={(record) => 
                      record.rank <= 3 ? 'bg-gradient-to-r from-green-50 to-emerald-50' : ''
                    }
                  />
                </Spin>
              )
            }
          ]}
        />
      </Card>
    </div>
  )
}