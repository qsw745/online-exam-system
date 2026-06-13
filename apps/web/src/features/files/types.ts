import type { FileItem } from '@/shared/api/endpoints/files'

export type FileRecord = FileItem & {
  size?: number | null
}

export type FileBreadcrumb = { id: number; name: string }
