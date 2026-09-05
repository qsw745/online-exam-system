import { api, favoritesApi, isSuccess } from '@/shared/api/http'
import { translate } from '@/shared/utils/i18n'
import { normalizePracticeQuestion } from './practiceQuestion'

export async function getQuestionById(id: string) {
  if (!/^[1-9]\d*$/.test(id)) throw new Error('题目编号无效')
  const result = await api.get(`/questions/${id}`)
  if (!isSuccess(result)) throw new Error(result.error || '题目加载失败')
  const data = result.data as any
  return normalizePracticeQuestion(data?.data ?? data)
}

async function getFirstFavoriteList(create = false) {
  const lists = await favoritesApi.list()
  if (lists.length) return lists[0]
  if (!create) return null
  const created = await favoritesApi.create({ name: translate('auto.441c933645') })
  if (!created?.id) throw new Error('创建收藏夹失败')
  return created
}

/** 查询收藏状态只读取，不自动创建收藏夹；批量练习共用一次查询。 */
export async function getFavoriteQuestionIds(): Promise<Set<string>> {
  const favorite = await getFirstFavoriteList()
  if (!favorite) return new Set()
  const items = await favoritesApi.items(favorite.id)
  return new Set(items.filter(item => !item.item_type || item.item_type === 'question')
    .map(item => String(item.question_id ?? item.item_id ?? '')))
}

export async function isQuestionFavorited(questionId: string): Promise<boolean> {
  return (await getFavoriteQuestionIds()).has(questionId)
}

export async function addQuestionToFavorites(questionId: string, title?: string) {
  const favorite = await getFirstFavoriteList(true)
  if (!favorite) throw new Error('创建收藏夹失败')
  await favoritesApi.addItem(favorite.id, { question_id: Number(questionId), title })
}

export async function removeQuestionFromFavorites(questionId: string) {
  const favorite = await getFirstFavoriteList()
  if (!favorite) return
  const items = await favoritesApi.items(favorite.id)
  const hit = items.find(item => (!item.item_type || item.item_type === 'question') && String(item.question_id ?? item.item_id) === questionId)
  if (hit) await favoritesApi.removeItem(favorite.id, hit.id)
}
