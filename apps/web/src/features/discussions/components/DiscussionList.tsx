import React, { useMemo } from 'react'
import { Card, Empty, List, Spin, Tag, Avatar, Badge, Tooltip } from 'antd'
import { MessageCircle, ThumbsUp, Eye, Clock } from 'lucide-react'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/zh-cn'

dayjs.extend(relativeTime)
dayjs.locale('zh-cn')

type Category = { id: number; name?: string; color?: string }
type Discussion = Record<string, any>

type Props = {
  loading: boolean
  data: Discussion[]
  categories: Category[]
  selectedId?: number | null
  onSelect: (d: Discussion | number) => void
}

const getCategoryColor = (color?: string) => color || '#1677ff'

export const DiscussionList: React.FC<Props> = ({ loading, data, categories, selectedId, onSelect }) => {
  // id -> {name,color}
  const cMap = useMemo(() => {
    const map: Record<string, { name?: string; color?: string }> = {}
    categories.forEach(c => (map[String(c.id)] = { name: c.name, color: c.color }))
    return map
  }, [categories])

  const toVM = (d: any) => {
    const author_name = d.author_name ?? d.username ?? '匿名用户'
    const author_avatar = d.author_avatar ?? d.avatar ?? undefined
    const cid = String(d.category_id ?? d.categoryId ?? d.category ?? '')
    const catNameRaw = d.category_name
    const category_name = typeof catNameRaw === 'string' && catNameRaw.trim() ? catNameRaw : cMap[cid]?.name || '未分类'
    const category_color = d.category_color ?? cMap[cid]?.color

    return {
      id: Number(d.id),
      title: d.title ?? '',
      category_name,
      category_color,
      is_pinned: !!(d.is_pinned ?? d.pinned ?? 0),
      likes: Number(d.likes_count ?? d.like_count ?? 0),
      replies: Number(d.replies_count ?? d.reply_count ?? 0),
      views: Number(d.views_count ?? d.view_count ?? 0),
      author_name,
      author_avatar,
      created_at: d.created_at ?? null,
      question_title: d.question_title,
    }
  }

  return (
    <Card
      title={<div className="font-semibold">讨论列表</div>}
      className="h-full border bg-white shadow-sm rounded-2xl overflow-hidden"
      // ↓↓↓ 修复：使用 styles.body 替代 bodyStyle
      styles={{ body: { padding: 0 } }}
    >
      <Spin spinning={loading}>
        {data.length === 0 ? (
          <div className="p-8">
            <Empty description="暂无讨论" />
          </div>
        ) : (
          <List
            dataSource={data}
            renderItem={raw => {
              const d = toVM(raw)
              const initial = (d.author_name || '').charAt(0).toUpperCase() || '匿'
              const createdText = d.created_at ? dayjs(d.created_at).fromNow() : '-'
              const isActive = selectedId === d.id
              return (
                <List.Item className="px-4 py-3">
                  <button
                    className={[
                      'w-full text-left rounded-xl border transition-all',
                      'bg-white hover:bg-gray-50',
                      isActive ? 'border-blue-300 ring-2 ring-blue-100' : 'border-gray-200',
                      'shadow-xs hover:shadow-sm px-4 py-3',
                    ].join(' ')}
                    onClick={() => onSelect(raw)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {d.is_pinned && <Badge color="red" text={<span className="text-red-500">置顶</span>} />}
                          <Tag color={getCategoryColor(d.category_color)}>{d.category_name}</Tag>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {createdText}
                          </span>
                        </div>

                        <div className="text-base font-semibold text-gray-900 mb-1 line-clamp-2">
                          {d.title || '(无标题)'}
                        </div>

                        {d.question_title && (
                          <div className="text-xs text-blue-600 mb-1">关联题目：{d.question_title}</div>
                        )}

                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-2 text-sm text-gray-600 min-w-0">
                            <Avatar src={d.author_avatar} size={24} className="bg-blue-500 shrink-0">
                              {initial}
                            </Avatar>
                            <span className="truncate">{d.author_name}</span>
                          </div>

                          <div className="flex items-center gap-3 text-gray-600">
                            <Tooltip title="点赞">
                              <span className="flex items-center gap-1">
                                <ThumbsUp className="w-4 h-4" />
                                <span className="tabular-nums">{d.likes}</span>
                              </span>
                            </Tooltip>
                            <Tooltip title="回复数">
                              <span className="flex items-center gap-1">
                                <MessageCircle className="w-4 h-4" />
                                <span className="tabular-nums">{d.replies}</span>
                              </span>
                            </Tooltip>
                            <Tooltip title="浏览量">
                              <span className="flex items-center gap-1">
                                <Eye className="w-4 h-4" />
                                <span className="tabular-nums">{d.views}</span>
                              </span>
                            </Tooltip>
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                </List.Item>
              )
            }}
          />
        )}
      </Spin>
    </Card>
  )
}
