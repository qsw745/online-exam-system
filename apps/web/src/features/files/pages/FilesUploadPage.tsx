import { useCallback, useEffect, useState } from 'react'
import { App, Button, Card, Input, Space, Table, Tag, Tooltip, Popconfirm, Typography } from 'antd'
import { ReloadOutlined, DeleteOutlined, DownloadOutlined, FileOutlined } from '@ant-design/icons'
import dayjs from '@/shared/utils/dayjs'
import { filesApi } from '@/shared/api/endpoints/files'
import { createTablePaginationConfig, resolvePaginationChange } from '@/shared/constants/pagination'
import type { FileRecord } from '../types'

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
      message.error(e?.message || '加载上传记录失败')
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
      message.success('删除成功')
      fetchRows()
    } catch (e: any) {
      message.error(e?.message || '删除失败')
    }
  }

  const handlePaginationChange = (nextPage: number, nextLimit?: number) => {
    const next = resolvePaginationChange(nextPage, nextLimit, limit)
    setPage(next.page)
    setLimit(next.pageSize)
  }

  const columns = [
    {
      title: '文件名',
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
      title: '标签',
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
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 140,
      render: (size: number) => formatSize(size),
    },
    {
      title: '类型',
      dataIndex: 'mime_type',
      key: 'mime_type',
      width: 160,
      render: (type: string) => type || '-',
    },
    {
      title: '上传时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 200,
      render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 160,
      render: (_: any, record: FileRecord) => {
        const url = record.download_url
        return (
          <Space>
            {url && (
              <Tooltip title="下载">
                <Button size="small" icon={<DownloadOutlined />} onClick={() => window.open(url, '_blank')} />
              </Tooltip>
            )}
            <Popconfirm title="确定删除该文件？" onConfirm={() => handleDelete(record)}>
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
              上传管理
            </Title>
            <Text type="secondary">查看最近的上传记录并执行删除或下载等操作</Text>
          </div>
          <Space>
            <Input.Search
              placeholder="搜索文件名"
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
            unit: '个文件',
            onChange: handlePaginationChange,
          })}
        />
      </Card>
    </Space>
  )
}
