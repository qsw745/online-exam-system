import { Avatar, Badge, Pagination, Spin, Table } from 'antd'
import { Award, Medal, Trophy } from 'lucide-react'
import { createPaginationConfig } from '@/shared/constants/pagination'
import type { LeaderboardEntry } from '@/shared/api/endpoints/leaderboard'

function RankIcon({ rank }: { rank: number }) {
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
const formatTime = (minutes: number) => {
  const mins = Number.isFinite(minutes) ? Math.max(0, Math.floor(minutes)) : 0
  const h = Math.floor(mins / 60),
    m = mins % 60
  return h > 0 ? `${h}h${m}m` : `${m}m`
}

type Props = {
  data: LeaderboardEntry[]
  loading: boolean
  total: number
  page: number
  pageSize: number
  onChange: (page: number, pageSize?: number) => void
  onPageSizeChange: (current: number, size: number) => void
  rowGradient?: string // 不同 tab 用不同渐变色
}

export default function LeaderboardTable({
  data,
  loading,
  total,
  page,
  pageSize,
  onChange,
  onPageSizeChange,
  rowGradient = 'from-yellow-50 to-orange-50',
}: Props) {
  const columns = [
    {
      title: '排名',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      render: (rank: number) => (
        <div className="flex items-center justify-center">
          <RankIcon rank={rank} />
        </div>
      ),
    },
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      render: (username: string, r: LeaderboardEntry) => (
        <div className="flex items-center space-x-3">
          <Avatar src={r.avatar} size={40} className="bg-blue-500">
            {username?.charAt(0)?.toUpperCase?.() || 'U'}
          </Avatar>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-medium">{username}</span>
              {r.rank <= 3 ? <Badge color={['gold', 'silver', '#cd7f32'][r.rank - 1]} /> : null}
            </div>
            <div className="text-xs text-gray-500">ID: {r.user_id}</div>
          </div>
        </div>
      ),
    },
    {
      title: '分数',
      dataIndex: 'score',
      key: 'score',
      sorter: (a: LeaderboardEntry, b: LeaderboardEntry) => b.score - a.score,
      render: (s: number) => <div className="text-lg font-bold text-blue-600">{Number(s).toFixed(1)}</div>,
    },
    {
      title: '正确率',
      key: 'accuracy',
      render: (r: LeaderboardEntry) => {
        const total = Number(r.total_questions) || 0
        const correct = Number(r.correct_questions) || 0
        const acc = total > 0 ? (correct / total) * 100 : 0
        return (
          <div className="text-center">
            <div className="font-medium">{acc.toFixed(1)}%</div>
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
      render: (t: number) => <div className="text-center font-medium">{formatTime(t)}</div>,
    },
    {
      title: '连续天数',
      dataIndex: 'streak_days',
      key: 'streak_days',
      render: (d: number) => (
        <div className="text-center">
          <Badge count={Number(d) || 0} style={{ backgroundColor: '#52c41a' }} />
        </div>
      ),
    },
  ]

  return (
    <Spin spinning={loading}>
      <Table
        columns={columns as any}
        dataSource={data}
        rowKey="id"
        pagination={false}
        rowClassName={(r: any) => (r.rank <= 3 ? `bg-gradient-to-r ${rowGradient}` : '')}
      />
      <Pagination
        current={page}
        total={total}
        pageSize={pageSize}
        onChange={onChange}
        onShowSizeChange={onPageSizeChange}
        {...createPaginationConfig()}
      />
    </Spin>
  )
}
