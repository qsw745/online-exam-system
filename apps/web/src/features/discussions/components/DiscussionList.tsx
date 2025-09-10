import React from 'react'
import { Card, Empty, List, Spin, Tag, Avatar } from 'antd'
import { MessageCircle, ThumbsUp, Eye, Clock } from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'
import type { Discussion } from '../types'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

type Props = {
  loading: boolean
  data: Discussion[]
  selectedId?: number | null
  onSelect: (d: Discussion) => void
}

const getCategoryColor = (color?: string) => color || '#1677ff'

// 统一做一层“显示用”的兼容映射，避免模板里到处写 ?? 判断
function toViewModel(d: any) {
  const author_name = d.author_name ?? d.username ?? d.user_name ?? '匿名用户'
  const author_avatar = d.author_avatar ?? d.avatar ?? d.avatar_url ?? undefined

  return {
    id: Number(d.id),
    title: d.title ?? '',
    // 分类
    category_name: d.category_name ?? d.category ?? '未分类',
    category_color: d.category_color ?? d.categoryColor ?? undefined,
    is_pinned: !!(d.is_pinned ?? d.pinned),
    // 关联题目（可选）
    question_title: d.question_title ?? d.related_title ?? undefined,
    // 计数兼容
    likes: Number(d.likes_count ?? d.like_count ?? d.likes ?? 0),
    replies: Number(d.replies_count ?? d.reply_count ?? d.replies ?? 0),
    views: Number(d.views_count ?? d.view_count ?? d.views ?? 0),
    // 作者
    author_name,
    author_avatar,
    // 时间
    created_at: d.created_at ?? d.createdAt ?? d.created_time ?? null,
  }
}

export const DiscussionList: React.FC<Props> = ({ loading, data, selectedId, onSelect }) => {
  return (
    <Card title="讨论列表" className="h-full">
      <Spin spinning={loading}>
        {data.length === 0 ? (
          <Empty description="暂无讨论" />
        ) : (
          <List
            dataSource={data}
            renderItem={raw => {
              const d = toViewModel(raw)
              const initial = (d.author_name ?? '').charAt(0).toUpperCase()
              const createdText = d.created_at ? dayjs(d.created_at).fromNow() : '-'
              return (
                <List.Item
                  className={`cursor-pointer rounded-lg p-4 mb-3 transition-colors border ${
                    selectedId === d.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-gray-50 border-gray-200'
                  }`}
                  onClick={() => onSelect(raw)}
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
                          {initial || '匿'}
                        </Avatar>
                        <span>{d.author_name}</span>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className="flex items-center space-x-1">
                          <ThumbsUp className="w-3 h-3" />
                          <span>{d.likes}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <MessageCircle className="w-3 h-3" />
                          <span>{d.replies}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Eye className="w-3 h-3" />
                          <span>{d.views}</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                      <span className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{createdText}</span>
                      </span>
                    </div>
                  </div>
                </List.Item>
              )
            }}
          />
        )}
      </Spin>
    </Card>
  )
}
