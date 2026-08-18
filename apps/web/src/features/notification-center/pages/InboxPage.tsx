import {
  ArrowRightOutlined,
  BellOutlined,
  CarryOutOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
  MailOutlined,
  PaperClipOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { App, Button, Empty, Input, Popconfirm, Segmented, Skeleton, Space, Switch, Tag, Tooltip, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from '@/shared/utils/dayjs'
import { inboxApi, type InboxItem, type InboxKind } from '@/shared/api/endpoints/inbox'
import type { NotificationAttachment } from '@/shared/api/endpoints/notifications'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { formatDateTime } from '@/shared/utils/datetime'
import './inbox-page.css'

const { Paragraph, Text, Title } = Typography

type KindFilter = 'all' | InboxKind

/** 收件箱计数变更后广播，顶部铃铛角标即时同步 */
const INBOX_EVENT = 'inbox-counts-changed'
const notifyCountsChanged = () => window.dispatchEvent(new CustomEvent(INBOX_EVENT))

const KIND_META: Record<InboxKind, { icon: ReactNode; color: string; labelKey: string }> = {
  notice: { icon: <BellOutlined />, color: 'blue', labelKey: 'inbox.kind_notice' },
  message: { icon: <MailOutlined />, color: 'green', labelKey: 'inbox.kind_message' },
  todo: { icon: <CarryOutOutlined />, color: 'orange', labelKey: 'inbox.kind_todo' },
}

const LEVEL_COLOR: Record<string, string> = {
  info: 'blue',
  success: 'green',
  warning: 'gold',
  error: 'red',
}

const formatSize = (bytes?: number) => {
  if (!bytes || bytes <= 0) return ''
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let idx = 0
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024
    idx += 1
  }
  return `${value.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`
}

/** 一周内用相对时间，更久则回落到全局时间格式 */
const smartTime = (value?: string) => {
  if (!value) return '-'
  const d = dayjs(value)
  if (!d.isValid()) return '-'
  return dayjs().diff(d, 'day') < 7 ? d.fromNow() : formatDateTime(value)
}

const snippet = (content: string) => content.replace(/\s+/g, ' ').trim()

export default function InboxPage() {
  const { t } = useLanguage()
  const { message } = App.useApp()
  const navigate = useNavigate()

  const [items, setItems] = useState<InboxItem[]>([])
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState<KindFilter>('all')
  const [keyword, setKeyword] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [activeUid, setActiveUid] = useState<string | null>(null)
  const [marking, setMarking] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await inboxApi.listAll()
      setItems(list)
    } catch (e: any) {
      message.error(e?.message || t('inbox.msg_load_failed'))
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [message, t])

  useEffect(() => {
    load()
  }, [load])

  const unreadOf = useCallback(
    (k: KindFilter) => items.filter(i => !i.is_read && (k === 'all' || i.kind === k)).length,
    [items]
  )

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    return items.filter(i => {
      if (kind !== 'all' && i.kind !== kind) return false
      if (unreadOnly && i.is_read) return false
      if (!kw) return true
      return i.title.toLowerCase().includes(kw) || i.content.toLowerCase().includes(kw)
    })
  }, [items, kind, keyword, unreadOnly])

  // 选中项由派生得到：选中失效（被过滤/删除）时自动回落到第一条
  const active = useMemo(() => {
    const picked = activeUid ? filtered.find(i => i.uid === activeUid) : undefined
    return picked ?? filtered[0] ?? null
  }, [filtered, activeUid])

  const markRead = useCallback(async (item: InboxItem) => {
    if (item.is_read) return
    try {
      await inboxApi.markRead(item)
      setItems(prev => prev.map(i => (i.uid === item.uid ? { ...i, is_read: true } : i)))
      notifyCountsChanged()
    } catch {
      /* 已读失败不打断阅读，静默忽略 */
    }
  }, [])

  /** 待办的"已读"等于办结，属于业务动作，只能由用户显式触发 */
  const openItem = (item: InboxItem) => {
    setActiveUid(item.uid)
    if (item.kind !== 'todo') markRead(item)
  }

  const completeTodo = async (item: InboxItem) => {
    try {
      await inboxApi.markRead(item)
      setItems(prev => prev.map(i => (i.uid === item.uid ? { ...i, is_read: true } : i)))
      notifyCountsChanged()
      message.success(t('inbox.msg_todo_done'))
    } catch (e: any) {
      message.error(e?.message || t('inbox.msg_todo_done_failed'))
    }
  }

  // "全部" 视图下的批量已读只覆盖通知与消息，待办不会被顺手办结
  const bulkAffects = useCallback(
    (item: InboxItem) => (kind === 'all' ? item.kind !== 'todo' : item.kind === kind),
    [kind]
  )
  const bulkPendingCount = useMemo(
    () => items.filter(i => !i.is_read && bulkAffects(i)).length,
    [items, bulkAffects]
  )

  const markAllRead = async () => {
    setMarking(true)
    try {
      await inboxApi.markAllRead(kind === 'all' ? undefined : kind)
      setItems(prev => prev.map(i => (bulkAffects(i) ? { ...i, is_read: true } : i)))
      notifyCountsChanged()
      message.success(t(kind === 'todo' ? 'inbox.msg_all_done' : 'inbox.msg_all_read'))
    } catch (e: any) {
      message.error(e?.message || t('inbox.msg_all_read_failed'))
    } finally {
      setMarking(false)
    }
  }

  const remove = async (item: InboxItem) => {
    try {
      await inboxApi.remove(item)
      setItems(prev => prev.filter(i => i.uid !== item.uid))
      if (!item.is_read) notifyCountsChanged()
      message.success(t('inbox.msg_deleted'))
    } catch (e: any) {
      message.error(e?.message || t('inbox.msg_delete_failed'))
    }
  }

  const kindOptions = useMemo(
    () =>
      (['all', 'notice', 'message', 'todo'] as KindFilter[]).map(k => {
        const count = unreadOf(k)
        const label = k === 'all' ? t('inbox.kind_all') : t(KIND_META[k].labelKey)
        return {
          value: k,
          label: (
            <span className="inbox-seg-label">
              {k !== 'all' && KIND_META[k].icon}
              <span>{label}</span>
              {count > 0 && <span className="inbox-seg-count">{count > 99 ? '99+' : count}</span>}
            </span>
          ),
        }
      }),
    [unreadOf, t]
  )

  const totalUnread = unreadOf('all')

  return (
    <div className="inbox-page">
      <header className="inbox-toolbar">
        <div className="inbox-toolbar-head">
          <Title level={4} className="inbox-heading">
            {t('menus.notify-inbox')}
            {totalUnread > 0 && (
              <span className="inbox-heading-count">{t('inbox.unread_summary').replace('{n}', String(totalUnread))}</span>
            )}
          </Title>
          <Space size={8} wrap>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder={t('inbox.search_placeholder')}
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              className="inbox-search"
            />
            <span className="inbox-unread-switch">
              <Switch size="small" checked={unreadOnly} onChange={setUnreadOnly} />
              <span>{t('inbox.filter_unread_only')}</span>
            </span>
            {kind === 'todo' ? (
              <Popconfirm
                title={t('inbox.confirm_all_done')}
                okText={t('app.confirm')}
                cancelText={t('app.cancel')}
                onConfirm={markAllRead}
              >
                <Button icon={<CheckCircleOutlined />} loading={marking} disabled={bulkPendingCount === 0}>
                  {t('inbox.btn_mark_all_done')}
                </Button>
              </Popconfirm>
            ) : (
              <Button icon={<CheckCircleOutlined />} loading={marking} disabled={bulkPendingCount === 0} onClick={markAllRead}>
                {t('inbox.btn_mark_all_read')}
              </Button>
            )}
            <Tooltip title={t('app.refresh')}>
              <Button icon={<ReloadOutlined />} loading={loading} onClick={load} />
            </Tooltip>
          </Space>
        </div>
        <Segmented value={kind} onChange={v => setKind(v as KindFilter)} options={kindOptions} className="inbox-seg" />
      </header>

      <div className="inbox-body">
        <section className="inbox-list-pane" aria-label={t('menus.notify-inbox')}>
          {loading ? (
            <div className="inbox-skeleton">
              {[0, 1, 2, 3].map(i => (
                <Skeleton key={i} active paragraph={{ rows: 2 }} title={{ width: '55%' }} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Empty className="inbox-empty" description={t('inbox.empty')} />
          ) : (
            <ul className="inbox-list">
              {filtered.map(item => {
                const meta = KIND_META[item.kind]
                return (
                  <li
                    key={item.uid}
                    className={[
                      'inbox-item',
                      item.uid === active?.uid ? 'is-active' : '',
                      item.is_read ? 'is-read' : 'is-unread',
                    ].join(' ')}
                    onClick={() => openItem(item)}
                  >
                    <span className={`inbox-item-dot inbox-dot-${item.kind}`} aria-hidden />
                    <div className="inbox-item-main">
                      <div className="inbox-item-row">
                        <span className="inbox-item-title">{item.title || t('inbox.untitled')}</span>
                        <span className="inbox-item-time">{smartTime(item.created_at)}</span>
                      </div>
                      <div className="inbox-item-desc">{snippet(item.content) || '—'}</div>
                      <div className="inbox-item-tags">
                        <Tag color={meta.color} bordered={false}>
                          {meta.icon} {t(meta.labelKey)}
                        </Tag>
                        {item.source && item.source !== 'system' && (
                          <Tag bordered={false}>{item.source}</Tag>
                        )}
                        {item.attachments.length > 0 && (
                          <Tag bordered={false} icon={<PaperClipOutlined />}>
                            {item.attachments.length}
                          </Tag>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="inbox-detail-pane">
          {!active ? (
            <div className="inbox-detail-placeholder">
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('inbox.detail_placeholder')} />
            </div>
          ) : (
            <article className="inbox-detail">
              <header className="inbox-detail-head">
                <Title level={4} className="inbox-detail-title">
                  {active.title || t('inbox.untitled')}
                </Title>
                <Space size={8} wrap className="inbox-detail-meta">
                  <Tag color={KIND_META[active.kind].color} bordered={false}>
                    {KIND_META[active.kind].icon} {t(KIND_META[active.kind].labelKey)}
                  </Tag>
                  {active.level && LEVEL_COLOR[active.level] && (
                    <Tag color={LEVEL_COLOR[active.level]} bordered={false}>
                      {active.level}
                    </Tag>
                  )}
                  <Text type="secondary">{active.created_at ? formatDateTime(active.created_at) : '-'}</Text>
                </Space>
                <Space size={8} className="inbox-detail-actions">
                  {active.target_path && (
                    <Button type="primary" icon={<ArrowRightOutlined />} onClick={() => navigate(active.target_path as string)}>
                      {t('inbox.btn_go_handle')}
                    </Button>
                  )}
                  {active.kind === 'todo' && !active.is_read && (
                    <Button icon={<CheckCircleOutlined />} onClick={() => completeTodo(active)}>
                      {t('inbox.btn_mark_done')}
                    </Button>
                  )}
                  <Popconfirm
                    title={t('inbox.confirm_delete')}
                    okText={t('app.confirm')}
                    cancelText={t('app.cancel')}
                    onConfirm={() => remove(active)}
                  >
                    <Button danger icon={<DeleteOutlined />}>
                      {t('app.delete')}
                    </Button>
                  </Popconfirm>
                </Space>
              </header>

              <Paragraph className="inbox-detail-content">{active.content || '—'}</Paragraph>

              {active.attachments.length > 0 && (
                <section className="inbox-attachments">
                  <Text strong>{t('inbox.attachments')}</Text>
                  <ul>
                    {active.attachments.map((att: NotificationAttachment) => (
                      <li key={att.id}>
                        <PaperClipOutlined />
                        <a href={att.url} target="_blank" rel="noreferrer">
                          {att.file_name}
                        </a>
                        <Text type="secondary">{formatSize(att.file_size)}</Text>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </article>
          )}
        </section>
      </div>
    </div>
  )
}
