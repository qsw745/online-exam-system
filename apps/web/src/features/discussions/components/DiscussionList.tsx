import React from 'react'
import { Card, Empty, List, Spin, Tag, Avatar } from 'antd'
import { MessageCircle, ThumbsUp, Eye, Clock } from 'lucide-react'
import dayjs from 'dayjs'
import type { Discussion } from '../types'

type Props = {
  loading: boolean
  data: Discussion[]
  selectedId?: number | null
  onSelect: (d: Discussion) => void
}

const getCategoryColor = (color?: string) => color || '#1677ff'

export const DiscussionList: React.FC<Props> = ({ loading, data, selectedId, onSelect }) => {
  return (
    <Card title="讨论列表" className="h-full">
      <Spin spinning={loading}>
        {data.length === 0 ? (
          <Empty description="暂无讨论" />
        ) : (
          <List
            dataSource={data}
            renderItem={d => (
              <List.Item
                className={`cursor-pointer rounded-lg p-4 mb-3 transition-colors border ${
                  selectedId === d.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50 border-gray-200'
                }`}
                onClick={() => onSelect(d)}
              >
                <div className="w-full">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        {d.is_pinned && <Tag color="red">置顶</Tag>}
                        <Tag color={getCategoryColor(d.category_color)}>{d.category_name}</Tag>
                      </div>
                      <h4 className="font-medium text-gray-900 mb-1 line-clamp-2">{d.title}</h4>
                      {d.question_title && <p className="text-sm text-blue-600 mb-1">关联题目: {d.question_title}</p>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center space-x-2">
                      <Avatar src={d.author_avatar} size={20} className="bg-blue-500">
                        {d.author_name.charAt(0)}
                      </Avatar>
                      <span>{d.author_name}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="flex items-center space-x-1">
                        <ThumbsUp className="w-3 h-3" />
                        <span>{d.likes_count}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <MessageCircle className="w-3 h-3" />
                        <span>{d.replies_count}</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <Eye className="w-3 h-3" />
                        <span>{d.views_count}</span>
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3 h-3" />
                      <span>{dayjs(d.created_at).fromNow()}</span>
                    </span>
                  </div>
                </div>
              </List.Item>
            )}
          />
        )}
      </Spin>
    </Card>
  )
}
