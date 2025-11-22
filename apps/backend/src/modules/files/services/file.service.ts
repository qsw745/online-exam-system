import type { FileRecord, FileType, FileListResult } from '../domain/file.model'
import { FileRepository } from '../repositories/file.repository'

const ensureArrayFromMaybeCsv = (input: any): string[] => {
  if (Array.isArray(input))
    return input
      .map(String)
      .map(s => s.trim())
      .filter(Boolean)
  if (typeof input === 'string') {
    const normalized = input.replace(/[\r\n]+/g, ',').replace(/[，；;]/g, ',')
    return normalized
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)
  }
  if (input != null && (typeof input === 'number' || typeof input === 'boolean')) {
    return [String(input)]
  }
  return []
}

type UploadedFile = {
  filename: string
  originalname: string
  mimetype: string
  size: number
  path: string
}

const formatRecord = (record: FileRecord) => {
  const tags = (() => {
    if (Array.isArray(record.tags)) return record.tags
    if (typeof record.tags === 'string') {
      try {
        const parsed = JSON.parse(record.tags)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return ensureArrayFromMaybeCsv(record.tags)
      }
    }
    return []
  })()
  return {
    ...record,
    tags,
  }
}

async function buildBreadcrumbs(parentId: number | null) {
  if (parentId == null) return []
  const crumbs: Array<{ id: number; name: string }> = []
  const visited = new Set<number>()
  let currentId: number | null = parentId
  while (currentId != null) {
    if (visited.has(currentId)) break
    visited.add(currentId)
    const node = await FileRepository.findById(currentId)
    if (!node) break
    crumbs.unshift({ id: node.id, name: node.name })
    currentId = node.parent_id
  }
  return crumbs
}

export class FileService {
  async listLibrary(params: {
    parentId?: number | null
    search?: string
    type?: FileType
    page?: number
    limit?: number
  }): Promise<FileListResult> {
    const page = Number(params.page || 1)
    const limit = Number(params.limit || 20)
    const parentId = params.parentId ?? null
    const [rows, total, stats, breadcrumbs] = await Promise.all([
      FileRepository.list({
        parentId,
        search: params.search,
        type: params.type,
        limit,
        offset: (page - 1) * limit,
      }),
      FileRepository.count({ parentId, search: params.search, type: params.type }),
      FileRepository.stats(parentId),
      buildBreadcrumbs(parentId),
    ])

    return {
      items: rows.map(formatRecord),
      pagination: { total, pageSize: limit, currentPage: page },
      parentId,
      breadcrumbs,
      stats: {
        totalSize: stats.total_size,
        files: stats.files,
        folders: stats.folders,
      },
    }
  }

  async listUploads(params: { search?: string; page?: number; limit?: number }) {
    const page = Number(params.page || 1)
    const limit = Number(params.limit || 20)
    const { rows, total } = await FileRepository.listUploads({ search: params.search, page, limit })
    return {
      items: rows.map(formatRecord),
      pagination: { total, pageSize: limit, currentPage: page },
    }
  }

  async createFolder(user: { id?: number | null }, payload: { name: string; parent_id?: number | null }) {
    const name = String(payload.name || '').trim()
    if (!name) throw new Error('文件夹名称不能为空')
    const parentId = payload.parent_id ?? null
    const exists = await FileRepository.existsByName(parentId, name, 'folder')
    if (exists) throw new Error('同级目录下已存在同名文件夹')

    const id = await FileRepository.insert({
      parent_id: parentId,
      type: 'folder',
      name,
      created_by: user.id ?? null,
      updated_by: user.id ?? null,
    })
    const created = await FileRepository.findById(id)
    return created ? formatRecord(created) : null
  }

  async saveUploadedFile(
    user: { id?: number | null },
    payload: {
      file: UploadedFile
      parent_id?: number | null
      name?: string
      description?: string
      tags?: string[] | string
    }
  ) {
    if (!payload.file) throw new Error('未检测到文件')
    const parentId = payload.parent_id ?? null
    const ext = (payload.file.originalname.split('.').pop() || '').toLowerCase()
    const tags = ensureArrayFromMaybeCsv(payload.tags)
    const id = await FileRepository.insert({
      parent_id: parentId,
      type: 'file',
      name: payload.name?.trim() || payload.file.originalname || payload.file.filename,
      original_name: payload.file.originalname || null,
      ext: ext || null,
      size: payload.file.size ?? null,
      mime_type: payload.file.mimetype || null,
      storage_path: payload.file.path || null,
      download_url: `/api/uploads/files/${payload.file.filename}`,
      tags: tags.length ? JSON.stringify(tags) : null,
      description: payload.description || null,
      created_by: user.id ?? null,
      updated_by: user.id ?? null,
    })
    const created = await FileRepository.findById(id)
    return created ? formatRecord(created) : null
  }

  async updateFile(
    user: { id?: number | null },
    id: number,
    payload: { name?: string; parent_id?: number | null; description?: string; tags?: string[] | string }
  ) {
    const target = await FileRepository.findById(id)
    if (!target || target.is_deleted) throw new Error('文件不存在')

    if (payload.parent_id === id) throw new Error('无法将节点移动到自身')

    const nextName = payload.name && payload.name.trim() ? payload.name.trim() : target.name
    const nextParent = payload.parent_id !== undefined ? payload.parent_id : target.parent_id

    if (payload.name && payload.name.trim() && payload.name.trim() !== target.name) {
      const exists = await FileRepository.existsByName(nextParent ?? null, nextName, target.type)
      if (exists) throw new Error('同级目录已存在同名项')
    }

    if (payload.parent_id !== undefined && payload.parent_id !== target.parent_id) {
      const exists = await FileRepository.existsByName(payload.parent_id ?? null, nextName, target.type)
      if (exists) throw new Error('目标目录已存在同名项')
    }

    const tags = payload.tags ? ensureArrayFromMaybeCsv(payload.tags) : undefined
    const patch: any = { updated_by: user.id ?? null }
    if (payload.name !== undefined) patch.name = payload.name.trim()
    if (payload.parent_id !== undefined) patch.parent_id = payload.parent_id
    if (payload.description !== undefined) patch.description = payload.description
    if (tags !== undefined) patch.tags = tags.length ? JSON.stringify(tags) : null
    await FileRepository.update(id, patch)
    const updated = await FileRepository.findById(id)
    return updated ? formatRecord(updated) : null
  }

  async remove(user: { id?: number | null }, id: number) {
    const target = await FileRepository.findById(id)
    if (!target || target.is_deleted) throw new Error('文件不存在或已删除')
    if (target.type === 'folder') {
      const hasChildren = await FileRepository.hasChildren(target.id)
      if (hasChildren) throw new Error('文件夹非空，无法删除')
    }
    await FileRepository.markDeleted(id, user.id ?? null)
    return true
  }
}
