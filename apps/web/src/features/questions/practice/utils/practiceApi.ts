// src/features/questions/practice/utils/practiceApi.ts
import { api, favoritesApi } from '@/shared/api/http'

export async function getQuestionById(id: string) {
  const r = await api.get(`/questions/${id}`)
  const anyr = r as any
  const d = anyr?.data?.data ?? anyr?.data ?? r
  return (d?.question ?? d) as any
}

/** —— favorites 兼容层（list/items/addItem/removeItem 组合）—— */
async function getFirstFavoriteList(): Promise<any | null> {
  try {
    const lists = await (favoritesApi as any).list?.()
    const arr = ((lists as any)?.data ?? lists) as any
    if (Array.isArray(arr) && arr.length) return arr[0]
    if (!(favoritesApi as any).create) return null
    const created = await (favoritesApi as any).create?.({ name: '默认收藏' })
    return (created as any)?.data ?? created ?? null
  } catch {
    return null
  }
}

export async function isQuestionFavorited(questionId: string): Promise<boolean> {
  try {
    const fav = await getFirstFavoriteList()
    if (!fav) return false
    const fid = Number(fav.id ?? fav.favorite_id ?? fav.ID)
    const items = await (favoritesApi as any).items?.(fid)
    const list = (((items as any)?.data ?? items) as any[]) || []
    const qidNum = Number(questionId)
    return (
      Array.isArray(list) && list.some(it => Number(it?.question_id ?? it?.qid ?? it?.target_id ?? it?.id) === qidNum)
    )
  } catch {
    return false
  }
}

export async function addQuestionToFavorites(questionId: string, title?: string) {
  const fav = await getFirstFavoriteList()
  if (!fav) throw new Error('没有可用的收藏夹')
  const fid = Number(fav.id ?? fav.favorite_id ?? fav.ID)
  if (!(favoritesApi as any).addItem) throw new Error('当前收藏接口不支持新增项目')
  await (favoritesApi as any).addItem(fid, { question_id: Number(questionId), title })
}

export async function removeQuestionFromFavorites(questionId: string) {
  const fav = await getFirstFavoriteList()
  if (!fav) throw new Error('没有可用的收藏夹')
  const fid = Number(fav.id ?? fav.favorite_id ?? fav.ID)
  if (!(favoritesApi as any).removeItem) throw new Error('当前收藏接口不支持删除项目')
  const items = await (favoritesApi as any).items?.(fid)
  const list = (((items as any)?.data ?? items) as any[]) || []
  const qidNum = Number(questionId)
  const hit = Array.isArray(list)
    ? list.find(it => Number(it?.question_id ?? it?.qid ?? it?.target_id ?? it?.id) === qidNum)
    : null
  if (!hit) return
  const itemId = Number(hit.id ?? hit.item_id ?? hit.ID ?? qidNum)
  await (favoritesApi as any).removeItem(fid, itemId)
}
