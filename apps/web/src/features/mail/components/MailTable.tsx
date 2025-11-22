import { Button, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { MailMessage } from '@/shared/api/endpoints/mail'

type Mailbox = 'inbox' | 'sent' | 'drafts'

type Props = {
  mailbox: Mailbox
  data: MailMessage[]
  loading: boolean
  onView?: (record: MailMessage) => void
  onEditDraft?: (record: MailMessage) => void
  onDelete?: (record: MailMessage, mailbox: Mailbox) => void
  onRecall?: (record: MailMessage) => void
}

const renderRecipients = (recipients: MailMessage['recipients']) => {
  if (!recipients?.length) return '-'
  return (
    <Space wrap>
      {recipients.map(r => {
        const recalled = r.status === 'recalled'
        return (
          <Tag key={r.id} color={recalled ? 'default' : 'blue'}>
            {r.name || `用户${r.id}`}
            {recalled ? '（已撤回）' : ''}
          </Tag>
        )
      })}
    </Space>
  )
}

export default function MailTable({ mailbox, data, loading, onView, onEditDraft, onDelete, onRecall }: Props) {
  const columns: ColumnsType<MailMessage> = [
    {
      title: '主题',
      dataIndex: 'subject',
      render: (text: string, record) => (
        <Space size={4}>
          {mailbox === 'inbox' && !record.is_read && <Tag color="red">未读</Tag>}
          {mailbox === 'sent' && record.status === 'recalled' && <Tag color="orange">全部撤回</Tag>}
          {mailbox === 'sent' &&
            record.status !== 'recalled' &&
            (record.recipients || []).some(r => r.status === 'recalled') && (
              <Tag color="orange">
                已撤回 {(record.recipients || []).filter(r => r.status === 'recalled').length}/
                {(record.recipients || []).length}
              </Tag>
            )}
          <Typography.Link onClick={() => onView?.(record)}>{text || '(无主题)'}</Typography.Link>
        </Space>
      ),
    },
    {
      title: mailbox === 'inbox' ? '发件人' : '收件人',
      dataIndex: mailbox === 'inbox' ? 'sender_name' : 'recipients',
      render: (_: any, record) =>
        mailbox === 'inbox'
          ? record.sender_name || `用户${record.sender_id}`
          : renderRecipients(record.recipients),
      width: 240,
    },
    {
      title: mailbox === 'drafts' ? '最后保存时间' : '发送时间',
      dataIndex: mailbox === 'drafts' ? 'updated_at' : 'sent_at',
      width: 200,
      render: (value: string | null, record) => {
        const time = value || record.created_at
        return time ? new Date(time).toLocaleString() : '-'
      },
    },
  ]

  if (mailbox === 'drafts') {
    columns.push({
      title: '操作',
      width: 160,
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => onEditDraft?.(record)}>
            继续编辑
          </Button>
          <Button type="link" danger onClick={e => (e.stopPropagation(), onDelete?.(record, mailbox))}>
            删除
          </Button>
        </Space>
      ),
    })
  } else if (mailbox === 'sent') {
    columns.push({
      title: '操作',
      width: 200,
      render: (_, record) => {
        const hasActiveRecipients = record.recipients?.some(r => r.status !== 'recalled') ?? false
        return (
          <Space>
            {record.status === 'sent' && hasActiveRecipients && (
              <Button
                type="link"
                onClick={e => {
                  e.stopPropagation()
                  onRecall?.(record)
                }}
              >
                撤回
              </Button>
            )}
            <Button
              type="link"
              danger
              onClick={e => {
                e.stopPropagation()
                onDelete?.(record, mailbox)
              }}
            >
              删除
            </Button>
          </Space>
        )
      },
    })
  } else if (mailbox === 'inbox') {
    columns.push({
      title: '操作',
      width: 120,
      render: (_, record) => (
        <Button
          type="link"
          danger
          onClick={e => {
            e.stopPropagation()
            onDelete?.(record, mailbox)
          }}
        >
          删除
        </Button>
      ),
    })
  }

  return (
    <Table
      rowKey="id"
      dataSource={data}
      columns={columns}
      loading={loading}
      pagination={false}
      onRow={record => ({
        onClick: () => onView?.(record),
      })}
    />
  )
}
