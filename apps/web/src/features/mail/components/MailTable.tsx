import { Button, Space, Table, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { MailMessage } from '@/shared/api/endpoints/mail'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'

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
            {r.name || `${translate('mail.user_prefix')}${r.id}`}
            {recalled ? translate('visible.a4b988db7b') : ''}
          </Tag>
        )
      })}
    </Space>
  )
}

export default function MailTable({ mailbox, data, loading, onView, onEditDraft, onDelete, onRecall }: Props) {
  const columns: ColumnsType<MailMessage> = [
    {
      title: translate('settings.theme'),
      dataIndex: 'subject',
      render: (text: string, record) => (
        <Space size={4}>
          {mailbox === 'inbox' && !record.is_read && <Tag color="red">{translate('auto.1e230aa201')}</Tag>}
          {mailbox === 'sent' && record.status === 'recalled' && <Tag color="orange">{translate('auto.2b0e1bf4dc')}</Tag>}
          {mailbox === 'sent' &&
            record.status !== 'recalled' &&
            (record.recipients || []).some(r => r.status === 'recalled') && (
              <Tag color="orange">
                {translate('workflow.msg_withdrawn')}{(record.recipients || []).filter(r => r.status === 'recalled').length}/
                {(record.recipients || []).length}
              </Tag>
            )}
          <Typography.Link onClick={() => onView?.(record)}>{text || translate('visible.dd6026e30d')}</Typography.Link>
        </Space>
      ),
    },
    {
      title: mailbox === 'inbox' ? translate('mail.sender') : translate('mail.recipient'),
      dataIndex: mailbox === 'inbox' ? 'sender_name' : 'recipients',
      render: (_: any, record) =>
        mailbox === 'inbox'
          ? record.sender_name || `${translate('mail.user_prefix')}${record.sender_id}`
          : renderRecipients(record.recipients),
      width: 240,
    },
    {
      title: mailbox === 'drafts' ? translate('mail.last_saved_at') : translate('mail.sent_at'),
      dataIndex: mailbox === 'drafts' ? 'updated_at' : 'sent_at',
      width: 200,
      render: (value: string | null, record) => {
        const time = value || record.created_at
        return time ? formatDateTime(time) : '-'
      },
    },
  ]

  if (mailbox === 'drafts') {
    columns.push({
      title: translate('users.columns.actions'),
      width: 160,
      render: (_, record) => (
        <Space>
          <Button type="link" onClick={() => onEditDraft?.(record)}>
            {translate('auto.3a481bc764')}</Button>
          <Button type="link" danger onClick={e => (e.stopPropagation(), onDelete?.(record, mailbox))}>
            {translate('app.delete')}</Button>
        </Space>
      ),
    })
  } else if (mailbox === 'sent') {
    columns.push({
      title: translate('users.columns.actions'),
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
                {translate('workflow.btn_withdraw')}</Button>
            )}
            <Button
              type="link"
              danger
              onClick={e => {
                e.stopPropagation()
                onDelete?.(record, mailbox)
              }}
            >
              {translate('app.delete')}</Button>
          </Space>
        )
      },
    })
  } else if (mailbox === 'inbox') {
    columns.push({
      title: translate('users.columns.actions'),
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
          {translate('app.delete')}</Button>
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
