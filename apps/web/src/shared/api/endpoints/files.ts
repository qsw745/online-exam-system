import { api } from '@/shared/api/http'
import { isSuccess, getErr, type ApiResult } from '@/shared/api/core/types'

export type FileKind = 'file' | 'folder'

export interface FileItem {
  id: number
  parent_id: number | null
  type: FileKind
  name: string
  original_name?: string | null
  ext?: string | null
  size?: number | null
  mime_type?: string | null
  download_url?: string | null
  description?: string | null
  tags?: string[]
  created_at?: string
  updated_at?: string
}

export type FileListResponse = {
  items: FileItem[]
  pagination: { total: number; pageSize: number; currentPage: number }
  parentId: number | null
  breadcrumbs: Array<{ id: number; name: string }>
  stats?: { totalSize: number; files: number; folders: number }
}

async function unwrap<T>(promise: Promise<ApiResult<T>>): Promise<T> {
  const resp = await promise
  if (isSuccess<T>(resp)) return resp.data
  throw new Error(getErr(resp, '文件中心请求失败'))
}

export const filesApi = {
  list: (params?: { parentId?: number | null; search?: string; type?: FileKind; page?: number; limit?: number }) =>
    unwrap<FileListResponse>(api.get('/files', { params })),
  uploads: (params?: { search?: string; page?: number; limit?: number }) =>
    unwrap<{ items: FileItem[]; pagination: { total: number; pageSize: number; currentPage: number } }>(
      api.get('/files/uploads', { params })
    ),
  createFolder: (payload: { name: string; parent_id?: number | null }) =>
    unwrap<FileItem>(api.post('/files/folders', payload)),
  upload: (form: FormData) =>
    unwrap<FileItem>(
      api.post('/files/upload', form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60000 })
    ),
  update: (id: number, payload: { name?: string; parent_id?: number | null; description?: string; tags?: string[] }) =>
    unwrap<FileItem>(api.patch(`/files/${id}`, payload)),
  remove: (id: number) => unwrap(api.delete(`/files/${id}`)),
}

export type { FileItem as FilesItem }
