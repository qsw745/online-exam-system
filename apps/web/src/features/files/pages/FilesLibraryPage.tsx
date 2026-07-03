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
import { createTablePaginationConfig, resolvePaginationChange } from '@/shared/constants/pagination'
import type { FileRecord, FileBreadcrumb } from '../types'
import { CreateFolderModal } from '../components/CreateFolderModal'
import { UploadFileModal } from '../components/UploadFileModal'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import { formatDateTime } from '@/shared/utils/datetime'

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
  const { t } = useLanguage()
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
      message.error(e?.message || t('files.messages.load_failed'))
      setRows([])
      setPaginationTotal(0)
    } finally {
      setLoading(false)
    }
  }, [parentId, search, page, limit, message, t])

  useEffect(() => {
    fetchList()
  }, [fetchList])

  const handleCreateFolder = async ({ name }: { name: string }) => {
    setCreateLoading(true)
    try {
      await filesApi.createFolder({ name, parent_id: parentId })
      message.success(t('files.messages.folder_created'))
      setCreateOpen(false)
      fetchList()
    } catch (e: any) {
      message.error(e?.message || t('files.messages.create_failed'))
    } finally {
      setCreateLoading(false)
    }
  }

  const handleUpload = async (formData: FormData) => {
    setUploadLoading(true)
    try {
      await filesApi.upload(formData)
      message.success(t('files.messages.upload_success'))
      setUploadOpen(false)
      fetchList()
    } catch (e: any) {
      message.error(e?.message || t('files.messages.upload_failed'))
    } finally {
      setUploadLoading(false)
    }
  }

  const handleRename = async ({ name }: { name: string }) => {
    if (!renameTarget) return
    setRenameLoading(true)
    try {
      await filesApi.update(renameTarget.id, { name })
      message.success(t('files.messages.update_success'))
      setRenameTarget(null)
      fetchList()
    } catch (e: any) {
      message.error(e?.message || t('files.messages.update_failed'))
    } finally {
      setRenameLoading(false)
    }
  }

  const handleDelete = async (record: FileRecord) => {
    try {
      await filesApi.remove(record.id)
      message.success(t('files.messages.delete_success'))
      fetchList()
    } catch (e: any) {
      message.error(e?.message || t('files.messages.delete_failed'))
    }
  }

  const handlePaginationChange = (nextPage: number, nextLimit?: number) => {
    const next = resolvePaginationChange(nextPage, nextLimit, limit)
    setPage(next.page)
    setLimit(next.pageSize)
  }

  const breadcrumbItems = useMemo(() => {
    const items = [{ id: null as number | null, name: t('files.root') }]
    if (breadcrumbs?.length) items.push(...breadcrumbs)
    return items
  }, [breadcrumbs, t])

  const columns = [
    {
      title: t('files.columns.name'),
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
      title: t('files.columns.type'),
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string, record: FileRecord) =>
        type === 'folder' ? <Tag color="blue">{t('files.folder')}</Tag> : <Tag>{record.ext?.toUpperCase() || t('files.file')}</Tag>,
    },
    {
      title: t('files.columns.size'),
      dataIndex: 'size',
      key: 'size',
      width: 140,
      render: (size: number, record: FileRecord) => (record.type === 'folder' ? '-' : formatSize(size)),
    },
    {
      title: t('files.columns.tags'),
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
      title: t('files.columns.updated_at'),
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 200,
      render: (value: string) => (value ? formatDateTime(value) : '-'),
    },
    {
      title: t('files.columns.actions'),
      key: 'actions',
      width: 220,
      render: (_: any, record: FileRecord) => {
        const isFolder = record.type === 'folder'
        return (
          <Space>
            <Tooltip title={t('files.rename')}>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => {
                  setRenameTarget(record)
                }}
              />
            </Tooltip>
            {!isFolder && record.download_url && (
              <Tooltip title={t('files.download')}>
                <Button
                  size="small"
                  icon={<DownloadOutlined />}
                  onClick={() => window.open(record.download_url || '#', '_blank')}
                />
              </Tooltip>
            )}
            <Popconfirm title={t('files.confirm_delete')} onConfirm={() => handleDelete(record)}>
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
              {t('files.library')}
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
              placeholder={t('files.search_placeholder')}
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
              {t('files.new_folder')}
            </Button>
            <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => setUploadOpen(true)}>
              {t('files.upload_file')}
            </Button>
          </Space>
        </Space>
      </Card>

      <Space size="middle" style={{ width: '100%' }}>
        <Card style={{ flex: 1 }}>
          <Statistic title={t('files.stats.files')} value={stats.files} />
        </Card>
        <Card style={{ flex: 1 }}>
          <Statistic title={t('files.stats.folders')} value={stats.folders} />
        </Card>
        <Card style={{ flex: 1 }}>
          <Statistic title={t('files.stats.used_space')} value={formatSize(stats.totalSize)} />
        </Card>
      </Space>

      <Card>
        <Table
          rowKey="id"
          dataSource={rows}
          columns={columns}
          pagination={createTablePaginationConfig({
            current: page,
            pageSize: limit,
            total: paginationTotal,
            unit: t('files.pagination_unit'),
            onChange: handlePaginationChange,
          })}
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
        title={t('files.rename')}
        initialName={renameTarget?.name}
        confirmLoading={renameLoading}
        onCancel={() => setRenameTarget(null)}
        onSubmit={handleRename}
      />
    </Space>
  )
}
