import React, { useMemo } from 'react'
import { Button, Space, Table, Tag, Tooltip } from 'antd'
import type { TablePaginationConfig } from 'antd/es/table'
import { Edit, Eye, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { formatDateTime } from '@/shared/utils/datetime'

export type Question = {
  id: string
  content: string
  question_type: string
  tags?: string[]
  knowledge_points?: string[]
  created_at?: string | number | Date
}

export default function QuestionTable({
  loading,
  data,
  selectedRowKeys,
  onSelectChange,
  pagination,
  onDeleteClick,
}: {
  loading: boolean
  data: Question[]
  selectedRowKeys: React.Key[]
  onSelectChange: (keys: React.Key[]) => void
  pagination: false | TablePaginationConfig
  onDeleteClick: (q: Question) => void
}) {
  const navigate = useNavigate()
  const { t } = useLanguage()

  const columns = useMemo(
    () => [
      {
        title: t('questions.col_content'),
        dataIndex: 'content',
        ellipsis: { showTitle: false },
        render: (text: string) => (
          <Tooltip placement="topLeft" title={text}>
            <span>{text}</span>
          </Tooltip>
        ),
      },
      {
        title: t('questions.col_type'),
        dataIndex: 'question_type',
        width: 120,
        render: (type: Question['question_type']) => {
          const map = {
            single_choice: { color: 'blue', text: t('questions.type_single') },
            multiple_choice: { color: 'green', text: t('questions.type_multiple') },
            true_false: { color: 'orange', text: t('questions.type_true_false') },
            short_answer: { color: 'purple', text: t('questions.type_short') },
          } as const
          const cfg = (map as any)[type] || { color: 'default', text: type }
          return <Tag color={cfg.color as any}>{cfg.text}</Tag>
        },
      },
      {
        title: t('questions.col_tags'),
        dataIndex: 'tags',
        width: 240,
        render: (tags: string[]) => (
          <div>
            {Array.isArray(tags) && tags.length ? (
              tags.slice(0, 3).map((t, i) => (
                <Tag key={i} color="geekblue" style={{ marginBottom: 4 }}>
                  {t}
                </Tag>
              ))
            ) : (
              <span style={{ color: '#999' }}>-</span>
            )}
            {Array.isArray(tags) && tags.length > 3 && (
              <Tooltip title={tags.slice(3).join(', ')}>
                <Tag>+{tags.length - 3}</Tag>
              </Tooltip>
            )}
          </div>
        ),
      },
      {
        title: t('questions.col_knowledge'),
        dataIndex: 'knowledge_points',
        width: 220,
        render: (points: string[]) => (
          <div>
            {points?.length ? (
              points.slice(0, 2).map((p, i) => (
                <Tag key={i} style={{ marginBottom: 4 }}>
                  {p}
                </Tag>
              ))
            ) : (
              <span style={{ color: '#999' }}>-</span>
            )}
            {points && points.length > 2 && (
              <Tooltip title={points.slice(2).join(', ')}>
                <Tag>+{points.length - 2}</Tag>
              </Tooltip>
            )}
          </div>
        ),
      },
      {
        title: t('questions.col_created_at'),
        dataIndex: 'created_at',
        width: 180,
        render: (d: string | number | Date) => (d ? formatDateTime(d) : '-'),
      },
      {
        title: t('questions.col_actions'),
        width: 150,
        render: (_: any, record: Question) => (
          <Space size="small">
            <Button
              type="text"
              icon={<Eye size={16} />}
              onClick={() => navigate(`/admin/question-detail/${record.id}`)}
            />
            <Button
              type="text"
              icon={<Edit size={16} />}
              onClick={() => navigate(`/admin/question-edit/${record.id}`)}
            />
            <Button type="text" danger icon={<Trash2 size={16} />} onClick={() => onDeleteClick(record)} />
          </Space>
        ),
      },
    ],
    [navigate, onDeleteClick, t]
  )

  return (
    <Table
      loading={loading}
      columns={columns as any}
      dataSource={data}
      rowKey="id"
      rowSelection={{ selectedRowKeys, onChange: onSelectChange }}
      pagination={pagination}
      locale={{
        emptyText: (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <span style={{ color: '#999' }}>{t('questions.empty')}</span>
          </div>
        ),
      }}
    />
  )
}
