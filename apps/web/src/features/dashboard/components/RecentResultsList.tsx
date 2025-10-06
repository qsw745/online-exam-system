import { Card, Empty, List, Space, Typography } from 'antd'
import { BookmarkPlus, Calendar } from 'lucide-react'
import React from 'react'

import dayjs from '@/shared/utils/dayjs'
import { Link } from 'react-router-dom'

const { Text } = Typography

type RecentResult = {
  id: string | number
  paper_title: string
  created_at: string
  score: number
  total_score: number
}
export const RecentResultsList: React.FC<{
  title: string
  viewAllText: string
  emptyText: string
  results: RecentResult[] // ✅ 使用本地类型
  locale: 'zh-CN' | 'en-US'
  label: { submit: string; score: string }
}> = ({ title, viewAllText, emptyText, results, locale, label }) => {
  return (
    <Card
      title={title}
      extra={
        <Link to="/exam/results" style={{ color: '#1890ff' }}>
          {viewAllText}
        </Link>
      }
    >
      {results.length > 0 ? (
        <List
          dataSource={results}
          renderItem={result => (
            <List.Item>
              <List.Item.Meta
                title={<Text strong>{result.paper_title}</Text>}
                description={
                  <Space>
                    <Calendar style={{ width: 14, height: 14 }} />
                    <Text type="secondary">
                      {label.submit}: {dayjs(result.created_at).locale(locale).format('YYYY/MM/DD HH:mm')}
                    </Text>
                  </Space>
                }
              />
              <div style={{ textAlign: 'right' }}>
                <Text strong style={{ fontSize: '16px' }}>
                  {result.score} / {result.total_score}
                </Text>
                <br />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {label.score}
                </Text>
              </div>
            </List.Item>
          )}
        />
      ) : (
        <Empty image={<BookmarkPlus style={{ width: 48, height: 48, color: '#d9d9d9' }} />} description={emptyText} />
      )}
    </Card>
  )
}
