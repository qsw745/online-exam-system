import { withTransaction } from '@/infrastructure/db/transaction'
import { HttpError, ValidationError } from '@/common/errors/http-error.js'
import type {
  AddFavoriteItemInput,
  CreateFavoriteInput,
  IFavorite,
  IFavoriteCategory,
  IFavoriteItem,
  UpdateFavoriteInput,
} from '../domain/favorites.model.js'
import { FavoritesRepository } from '../repositories/favorites.repository.js'

const DEFAULT_CATEGORY_SEED: Array<Pick<IFavoriteCategory, 'name' | 'description' | 'color' | 'icon' | 'sort_order'>> = [
  { name: '未分类', description: '未选择分类的收藏', color: '#94A3B8', icon: 'Tag', sort_order: 0 },
  { name: '刷题集', description: '常用练习集合', color: '#60A5FA', icon: 'BookOpen', sort_order: 1 },
  { name: '错题本', description: '需要重点复习的错题', color: '#F97316', icon: 'AlertTriangle', sort_order: 2 },
  { name: '收藏', description: '临时收纳，稍后整理', color: '#A78BFA', icon: 'Star', sort_order: 3 },
]

export class FavoritesService {
  constructor(private readonly repo = new FavoritesRepository()) {}

  async list(userId: number, q: { category_id?: number; is_public?: boolean }) {
    return this.repo.findByUser(userId, { ...q, orderBy: 'updated_at' })
  }

  async getByIdForRead(userId: number, id: number): Promise<{ favorite: IFavorite; items: IFavoriteItem[] }> {
    const favorite = await this.repo.findPublicOrOwnedById(id, userId)
    if (!favorite) throw HttpError.notFound('收藏夹不存在或无权访问')
    const items = await this.repo.listItems(id)
    return { favorite, items }
  }

  async create(input: CreateFavoriteInput): Promise<IFavorite> {
    if (!input.name?.trim()) throw new ValidationError('请求参数验证失败', ['name 不能为空'])
    return withTransaction(async conn => {
      const id = await this.repo.insertFavorite(conn, {
        user_id: input.userId,
        name: input.name.trim(),
        description: input.description ?? '',
        is_public: !!input.is_public,
        category_id: input.category_id ?? null,
      })
      // 关键修复：用同一个事务连接查询
      const fav = await this.repo.findByIdForUser(id, input.userId, conn)
      if (!fav) throw HttpError.internal('创建后查询失败')
      return fav
    })
  }

  async update(input: UpdateFavoriteInput): Promise<IFavorite> {
    // 校验存在（读已提交即可）
    const exists = await this.repo.findByIdForUser(input.id, input.userId)
    if (!exists) throw HttpError.notFound('收藏夹不存在或无权修改')

    await withTransaction(async conn => {
      const ok = await this.repo.updateFavorite(conn, input.id, input.userId, {
        name: input.name,
        description: input.description,
        is_public: input.is_public,
        category_id: input.category_id ?? undefined,
      })
      if (!ok) throw HttpError.internal('更新失败')
    })

    const updated = await this.repo.findByIdForUser(input.id, input.userId)
    if (!updated) throw HttpError.internal('更新后查询失败')
    return updated
  }

  async remove(userId: number, id: number): Promise<void> {
    await withTransaction(async conn => {
      const ok = await this.repo.deleteFavorite(conn, id, userId)
      if (!ok) throw HttpError.notFound('收藏夹不存在或无权删除')
    })
  }

  async listItemsByFavorite(userId: number, favoriteId: number): Promise<IFavoriteItem[]> {
    const fav = await this.repo.findByIdForUser(favoriteId, userId)
    if (!fav) throw HttpError.notFound('收藏夹不存在或无权访问')
    return this.repo.listItems(favoriteId)
  }

  async addItem(input: AddFavoriteItemInput): Promise<IFavoriteItem> {
    const fav = await this.repo.findByIdForUser(input.favoriteId, input.userId)
    if (!fav) throw HttpError.notFound('收藏夹不存在或无权操作')

    if (await this.repo.existsItem(input.favoriteId, input.item_type, input.item_id)) {
      throw new ValidationError('请求参数验证失败', ['该项目已在收藏夹中'])
    }

    const id = await withTransaction(async conn => {
      return this.repo.insertItem(conn, {
        favorite_id: input.favoriteId,
        item_type: input.item_type,
        item_id: input.item_id,
        title: input.title ?? '',
        description: input.description ?? '',
        tags: JSON.stringify(input.tags ?? []),
        notes: input.notes ?? '',
      })
    })

    const items = await this.repo.listItems(input.favoriteId)
    const item = items.find(i => (i as any).id === id)
    return item ?? items[0]
  }

  async removeItem(userId: number, favoriteId: number, itemId: number): Promise<void> {
    const fav = await this.repo.findByIdForUser(favoriteId, userId)
    if (!fav) throw HttpError.notFound('收藏夹不存在或无权操作')
    await withTransaction(async conn => {
      const ok = await this.repo.deleteItem(conn, itemId, favoriteId)
      if (!ok) throw HttpError.notFound('收藏项目不存在')
    })
  }

  async searchItems(userId: number, q: { keyword?: string; item_type?: string; favorite_id?: number }) {
    return this.repo.searchItems(userId, q)
  }

  async categories(): Promise<IFavoriteCategory[]> {
    const list = await this.repo.allCategories()
    if (list.length) return list

    return withTransaction(async conn => {
      const existing = await this.repo.allCategories(conn)
      if (existing.length) return existing
      await this.repo.insertCategoriesBulk(conn, DEFAULT_CATEGORY_SEED)
      return this.repo.allCategories(conn)
    })
  }

  async createShare(userId: number, favoriteId: number, shareCode: string): Promise<void> {
    const fav = await this.repo.findByIdForUser(favoriteId, userId)
    if (!fav) throw HttpError.notFound('收藏夹不存在或无权分享')
    await this.repo.createShareRecord({ favorite_id: favoriteId, shared_by: userId, share_code: shareCode })
  }

  async getSharedFavorite(shareCode: string): Promise<{
    favorite: IFavorite
    items: IFavoriteItem[]
    owner?: { id: number; username: string | null; nickname: string | null }
  }> {
    const record = await this.repo.findShareByCode(shareCode)
    if (!record) throw HttpError.notFound('分享链接不存在或已失效')
    const items = await this.repo.listItems(record.share.favorite_id)
    return { favorite: record.favorite, items, owner: record.owner }
  }
}
