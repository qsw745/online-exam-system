import type { RowDataPacket } from 'mysql2/promise'

export type FileType = 'file' | 'folder'

export interface FileRecord extends RowDataPacket {
  id: number
  parent_id: number | null
  type: FileType
  name: string
  original_name: string | null
  ext: string | null
  size: number | null
  mime_type: string | null
  storage_path: string | null
  download_url: string | null
  tags: string[] | null
  description: string | null
  version: string | null
  created_by: number | null
  updated_by: number | null
  created_at: Date
  updated_at: Date
  deleted_at: Date | null
  is_deleted: number
}

export type FileListResult = {
  items: FileRecord[]
  pagination: { total: number; pageSize: number; currentPage: number }
  parentId: number | null
  breadcrumbs: Array<{ id: number; name: string }>
  stats: { totalSize: number; files: number; folders: number }
}
