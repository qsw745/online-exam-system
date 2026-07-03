import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Input, Space, Table, Tag, Tooltip, Popconfirm, Typography } from 'antd'
import { ReloadOutlined, DeleteOutlined, DownloadOutlined, FileOutlined } from '@ant-design/icons'
import dayjs from '@/shared/utils/dayjs'
import { filesApi } from '@/shared/api/endpoints/files'
import { createTablePaginationConfig, resolvePaginationChange } from '@/shared/constants/pagination'
import type { FileRecord } from '../types'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'

const { Title, Text } = Typography

const formatSize = (bytes?: number | null) => {
  if (!bytes || bytes <= 0) return '-'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unit = 0
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024
    unit++
  }
  return `${size % 1 === 0 ? size : size.toFixed(1)} ${units[unit]}`
}

export default function FilesUploadPage() {
  const { message } = App.useApp()
  const [rows, setRows] = useState<FileRecord[]>([])
  const [search, setSearch] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const fetchRows = useCallback(async () => {
    setLoading(true)
    try {
      const data = await filesApi.uploads({ search: search || undefined, page, limit })
      setRows(Array.isArray(data.items) ? data.items : [])
      setTotal(data.pagination?.total || 0)
    } catch (e: any) {
      message.error(e?.message || translate('auto.fd4fcd39d1'))
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [search, page, limit, message])

  useEffect(() => {
    fetchRows()
  }, [fetchRows])

  const handleDelete = async (record: FileRecord) => {
    try {
      await filesApi.remove(record.id)
      message.success(translate('users.message.delete_success'))
      fetchRows()
    } catch (e: any) {
      message.error(e?.message || translate('orgs.message.delete_failed'))
    }
  }

  const handlePaginationChange = (nextPage: number, nextLimit?: number) => {
    const next = resolvePaginationChange(nextPage, nextLimit, limit)
    setPage(next.page)
    setLimit(next.pageSize)
  }

  const columns = [
    {
      title: translate('auto.1275f6feb7'),
      dataIndex: 'name',
      key: 'name',
      render: (_: string, record: FileRecord) => (
        <Space>
          <FileOutlined />
          <Text>{record.name}</Text>
        </Space>
      ),
    },
    {
      title: translate('questions.col_tags'),
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[]) =>
        Array.isArray(tags) && tags.length ? (
          <Space wrap>
            {tags.map(tag => (
              <Tag key={tag}>{tag}</Tag>
            ))}
          </Space>
        ) : (
          <Text type="secondary">-</Text>
        ),
    },
    {
      title: translate('files.columns.size'),
      dataIndex: 'size',
      key: 'size',
      width: 140,
      render: (size: number) => formatSize(size),
    },
    {
      title: translate('systemConfig.col_type'),
      dataIndex: 'mime_type',
      key: 'mime_type',
      width: 160,
      render: (type: string) => type || '-',
    },
    {
      title: translate('auto.109db23827'),
      dataIndex: 'created_at',
      key: 'created_at',
      width: 200,
      render: (value: string) => (value ? formatDateTime(value) : '-'),
    },
    {
      title: translate('users.columns.actions'),
      key: 'actions',
      width: 160,
      render: (_: any, record: FileRecord) => {
        const url = record.download_url
        return (
          <Space>
            {url && (
              <Tooltip title={translate('files.download')}>
                <Button size="small" icon={<DownloadOutlined />} onClick={() => window.open(url, '_blank')} />
              </Tooltip>
            )}
            <Popconfirm title={translate('auto.0a75f446d1')} onConfirm={() => handleDelete(record)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
        )
      },
    },
  ]

  return (
    <Space direction="vertical" size="middle" style={{ width: '100%' }}>
      <Card>
        <Space style={{ width: '100%', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div>
            <Title level={4} style={{ marginBottom: 8 }}>
              {translate('menus.files-upload')}</Title>
            <Text type="secondary">{translate('auto.ab5ffabb75')}</Text>
          </div>
          <Space>
            <Input.Search
              placeholder={translate('auto.f278077d2e')}
              value={keyword}
              allowClear
              onChange={e => {
                setKeyword(e.target.value)
                if (!e.target.value) {
                  setPage(1)
                  setSearch('')
                }
              }}
              onSearch={val => {
                setPage(1)
                setSearch(val.trim())
              }}
              style={{ width: 240 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => fetchRows()} />
          </Space>
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="id"
          dataSource={rows}
          columns={columns}
          loading={loading}
          pagination={createTablePaginationConfig({
            current: page,
            pageSize: limit,
            total,
            unit: translate('visible.6218629ae2'),
            onChange: handlePaginationChange,
          })}
        />
      </Card>
    </Space>
  )
}
