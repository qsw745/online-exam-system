import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  App,
  Breadcrumb,
  Button,
  Card,
  Input,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
  Popconfirm,
} from 'antd'
import {
  CloudUploadOutlined,
  DeleteOutlined,
  FileOutlined,
  FolderAddOutlined,
  FolderOpenOutlined,
  ReloadOutlined,
  EditOutlined,
  DownloadOutlined,
} from '@ant-design/icons'
import dayjs from '@/shared/utils/dayjs'
import { filesApi } from '@/shared/api/endpoints/files'
import type { FileRecord, FileBreadcrumb } from '../types'
import { CreateFolderModal } from '../components/CreateFolderModal'
import { UploadFileModal } from '../components/UploadFileModal'

const { Text } = Typography

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

export default function FilesLibraryPage() {
  const { message } = App.useApp()
  const [parentId, setParentId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(20)
  const [rows, setRows] = useState<FileRecord[]>([])
  const [breadcrumbs, setBreadcrumbs] = useState<FileBreadcrumb[]>([])
  const [stats, setStats] = useState<{ totalSize: number; files: number; folders: number }>({
    totalSize: 0,
    files: 0,
    folders: 0,
  })
  const [paginationTotal, setPaginationTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [createLoading, setCreateLoading] = useState(false)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploadLoading, setUploadLoading] = useState(false)
  const [renameTarget, setRenameTarget] = useState<FileRecord | null>(null)
  const [renameLoading, setRenameLoading] = useState(false)

  const fetchList = useCallback(async () => {
    setLoading(true)
    try {
      const data = await filesApi.list({
        parentId,
        search: search || undefined,
        page,
        limit,
      })
      setRows(Array.isArray(data.items) ? data.items : [])
      setPaginationTotal(data.pagination?.total || 0)
      setBreadcrumbs(data.breadcrumbs || [])
      if (data.stats) setStats(data.stats)
    } catch (e: any) {
      message.error(e?.message || '加载文件失败')
      setRows([])
      setPaginationTotal(0)
    } finally {
      setLoading(false)
    }
  }, [parentId, search, page, limit, message])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const handleCreateFolder = async ({ name }: { name: string }) => {
    setCreateLoading(true)
    try {
      await filesApi.createFolder({ name, parent_id: parentId })
      message.success('文件夹创建成功')
      setCreateOpen(false)
      fetchList()
    } catch (e: any) {
      message.error(e?.message || '创建失败')
    } finally {
      setCreateLoading(false)
    }
  }

  const handleUpload = async (formData: FormData) => {
    setUploadLoading(true)
    try {
      await filesApi.upload(formData)
      message.success('上传成功')
      setUploadOpen(false)
      fetchList()
    } catch (e: any) {
      message.error(e?.message || '上传失败')
    } finally {
      setUploadLoading(false)
    }
  }

  const handleRename = async ({ name }: { name: string }) => {
    if (!renameTarget) return
    setRenameLoading(true)
    try {
      await filesApi.update(renameTarget.id, { name })
      message.success('更新成功')
      setRenameTarget(null)
      fetchList()
    } catch (e: any) {
      message.error(e?.message || '更新失败')
    } finally {
      setRenameLoading(false)
    }
  }

  const handleDelete = async (record: FileRecord) => {
    try {
      await filesApi.remove(record.id)
      message.success('删除成功')
      fetchList()
    } catch (e: any) {
      message.error(e?.message || '删除失败')
    }
  }

  const breadcrumbItems = useMemo(() => {
    const items = [{ id: null as number | null, name: '全部文件' }]
    if (breadcrumbs?.length) items.push(...breadcrumbs)
    return items
  }, [breadcrumbs])

  const columns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      render: (_: string, record: FileRecord) => {
        const isFolder = record.type === 'folder'
        return (
          <Space>
            {isFolder ? <FolderOpenOutlined /> : <FileOutlined />}
            {isFolder ? (
              <Button type="link" onClick={() => {
                setParentId(record.id)
                setPage(1)
              }}>
                {record.name}
              </Button>
            ) : (
              <Text>{record.name}</Text>
            )}
          </Space>
        )
      },
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string, record: FileRecord) =>
        type === 'folder' ? <Tag color="blue">文件夹</Tag> : <Tag>{record.ext?.toUpperCase() || '文件'}</Tag>,
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      width: 140,
      render: (size: number, record: FileRecord) => (record.type === 'folder' ? '-' : formatSize(size)),
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
      title: '更新时间',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 200,
      render: (value: string) => (value ? dayjs(value).format('YYYY-MM-DD HH:mm') : '-'),
    },
    {
      title: '操作',
      key: 'actions',
      width: 220,
      render: (_: any, record: FileRecord) => {
        const isFolder = record.type === 'folder'
        return (
          <Space>
            <Tooltip title="重命名">
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setRenameTarget(record)
                }}
              />
            </Tooltip>
            {!isFolder && record.download_url && (
              <Tooltip title="下载">
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() => window.open(record.download_url || '#', '_blank')}
                />
              </Tooltip>
            )}
            <Popconfirm title="确定要删除吗？" onConfirm={() => handleDelete(record)}>
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
            <Typography.Title level={4} style={{ marginBottom: 8 }}>
              文件库
            </Typography.Title>
            <Breadcrumb>
              {breadcrumbItems.map(item => (
                <Breadcrumb.Item key={item.id ?? 'root'}>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      setParentId(item.id)
                      setPage(1)
                    }}
                  >
                    {item.name}
                  </Button>
                </Breadcrumb.Item>
              ))}
            </Breadcrumb>
          </div>
          <Space>
            <Input.Search
              placeholder="搜索文件/文件夹"
              value={keyword}
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
              allowClear
              style={{ width: 240 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => fetchList()} />
            <Button icon={<FolderAddOutlined />} type="default" onClick={() => setCreateOpen(true)}>
              新建文件夹
            </Button>
            <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => setUploadOpen(true)}>
              上传文件
            </Button>
          </Space>
        </Space>
      </Card>

      <Space size="middle" style={{ width: '100%' }}>
        <Card style={{ flex: 1 }}>
          <Statistic title="文件数" value={stats.files} />
        </Card>
        <Card style={{ flex: 1 }}>
          <Statistic title="文件夹" value={stats.folders} />
        </Card>
        <Card style={{ flex: 1 }}>
          <Statistic title="占用空间" value={formatSize(stats.totalSize)} />
        </Card>
      </Space>

      <Card>
        <Table
          rowKey="id"
          dataSource={rows}
          columns={columns}
          pagination={{
            current: page,
            pageSize: limit,
            total: paginationTotal,
            showSizeChanger: true,
            onChange: (p, l) => {
              setPage(p)
              setLimit(l)
            },
          }}
          loading={loading}
        />
      </Card>

      <CreateFolderModal
        open={createOpen}
        confirmLoading={createLoading}
        onCancel={() => setCreateOpen(false)}
        onSubmit={handleCreateFolder}
      />

      <UploadFileModal
        open={uploadOpen}
        parentId={parentId}
        confirmLoading={uploadLoading}
        onCancel={() => setUploadOpen(false)}
        onSubmit={handleUpload}
      />

      <CreateFolderModal
        open={!!renameTarget}
        title="重命名"
        initialName={renameTarget?.name}
        confirmLoading={renameLoading}
        onCancel={() => setRenameTarget(null)}
        onSubmit={handleRename}
      />
    </Space>
  )
}
