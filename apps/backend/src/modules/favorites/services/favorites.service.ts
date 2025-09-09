// src/modules/favorites/favorites.service.ts
import { withTransaction } from '@infrastructure/db/transaction'
import { HttpError, ValidationError } from '../../../common/errors/http-error.js'
import type {
  AddFavoriteItemInput,
  CreateFavoriteInput,
  IFavorite,
  IFavoriteCategory,
  IFavoriteItem,
  UpdateFavoriteInput,
} from '../domain/favorites.model.js'
import { FavoritesRepository } from '../repositories/favorites.repository.js'

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
      // 读回
      const fav = await this.repo.findByIdForUser(id, input.userId)
      if (!fav) throw HttpError.internal('创建后查询失败')
      return fav
    })
  }

  async update(input: UpdateFavoriteInput): Promise<IFavorite> {
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
    const [item] = await this.repo.listItems(input.favoriteId)
    // 为简洁，这里简单再查一遍该收藏夹下最新的项；生产里可按 insertId 精确查
    return (await this.repo.listItems(input.favoriteId)).find(i => i.id === id)!
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
    return this.repo.allCategories()
  }
}
