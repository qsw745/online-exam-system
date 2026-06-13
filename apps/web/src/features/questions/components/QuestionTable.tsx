import React, { useMemo } from 'react'
import { Button, Space, Table, Tag, Tooltip } from 'antd'
import type { TablePaginationConfig } from 'antd/es/table'
import { Edit, Eye, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

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

  const columns = useMemo(
    () => [
      {
        title: '题目内容',
        dataIndex: 'content',
        ellipsis: { showTitle: false },
        render: (text: string) => (
          <Tooltip placement="topLeft" title={text}>
            <span>{text}</span>
          </Tooltip>
        ),
      },
      {
        title: '题目类型',
        dataIndex: 'question_type',
        width: 120,
        render: (type: Question['question_type']) => {
          const map = {
            single_choice: { color: 'blue', text: '单选题' },
            multiple_choice: { color: 'green', text: '多选题' },
            true_false: { color: 'orange', text: '判断题' },
            short_answer: { color: 'purple', text: '简答题' },
          } as const
          const cfg = (map as any)[type] || { color: 'default', text: type }
          return <Tag color={cfg.color as any}>{cfg.text}</Tag>
        },
      },
      {
        title: '标签',
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
        title: '知识点',
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
        title: '创建时间',
        dataIndex: 'created_at',
        width: 180,
        render: (d: string | number | Date) => (d ? new Date(d).toLocaleString('zh-CN') : '-'),
      },
      {
        title: '操作',
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
    [navigate, onDeleteClick]
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
            <span style={{ color: '#999' }}>暂无题目</span>
          </div>
        ),
      }}
    />
  )
}
