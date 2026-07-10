import React, { useMemo } from 'react'
import { Card, Empty, Spin, Tag, Avatar, Tooltip } from 'antd'
import { MessageCircle, ThumbsUp, Eye, Clock, Pin } from 'lucide-react'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'

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
    const author_name = d.author_name ?? d.username ?? translate('common.anonymous_user')
    const author_avatar = d.author_avatar || d.avatar || undefined
    const cid = String(d.category_id ?? d.categoryId ?? d.category ?? '')
    const catNameRaw = d.category_name
    const category_name = typeof catNameRaw === 'string' && catNameRaw.trim() ? catNameRaw : cMap[cid]?.name || translate('common.uncategorized')
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
    <Card title={translate('auto.6457cc30b3')} styles={{ body: { padding: 0 } }}>
      <Spin spinning={loading}>
        {data.length === 0 ? (
          <div style={{ padding: 32 }}>
            <Empty description={translate('auto.c2eeb5feff')} />
          </div>
        ) : (
          <div>
            {data.map(raw => {
              const d = toVM(raw)
              const initial = (d.author_name || '').charAt(0).toUpperCase() || translate('visible.4e0a3caa22')
              const createdText = d.created_at ? formatDateTime(d.created_at) : '-'
              const isActive = selectedId === d.id
              return (
                <button
                  key={d.id}
                  type="button"
                  className={`disc-item${isActive ? ' disc-item--active' : ''}`}
                  onClick={() => onSelect(raw)}
                >
                  <div className="disc-item__meta">
                    {d.is_pinned && (
                      <Tag color="red" icon={<Pin size={12} />}>
                        {translate('auto.7bcf18641f')}
                      </Tag>
                    )}
                    <Tag color={getCategoryColor(d.category_color)}>{d.category_name}</Tag>
                    <span className="disc-item__time">
                      <Clock size={12} />
                      {createdText}
                    </span>
                  </div>

                  <div className="disc-item__title">{d.title || translate('header.untitled')}</div>

                  {d.question_title && (
                    <div className="disc-item__question">
                      {translate('auto.e79035ba92')}
                      {d.question_title}
                    </div>
                  )}

                  <div className="disc-item__footer">
                    <span className="disc-item__author">
                      <Avatar src={d.author_avatar} size={22} style={{ flexShrink: 0 }}>
                        {initial}
                      </Avatar>
                      <span className="disc-item__author-name">{d.author_name}</span>
                    </span>

                    <span className="disc-item__stats">
                      <Tooltip title={translate('auto.e07f300d0c')}>
                        <span className="disc-stat">
                          <ThumbsUp size={14} />
                          {d.likes}
                        </span>
                      </Tooltip>
                      <Tooltip title={translate('auto.089f60a9bf')}>
                        <span className="disc-stat">
                          <MessageCircle size={14} />
                          {d.replies}
                        </span>
                      </Tooltip>
                      <Tooltip title={translate('auto.362b49c2b1')}>
                        <span className="disc-stat">
                          <Eye size={14} />
                          {d.views}
                        </span>
                      </Tooltip>
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </Spin>
    </Card>
  )
}
