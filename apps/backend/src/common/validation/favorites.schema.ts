import { z } from 'zod'

/** 创建收藏夹 */
export const createFavoriteSchema = z.object({
  name: z.string().min(1, '收藏夹名称不能为空').max(100, '收藏夹名称长度必须在1-100字符之间'),
  description: z.string().max(500, '描述最多500字符').optional().or(z.literal('')),
  is_public: z.boolean().optional(),
  category_id: z.coerce.number().int().positive('category_id必须为正整数').optional().nullable(),
})

/** 更新收藏夹（字段可选，但如果给了也要满足规则） */
export const updateFavoriteSchema = z.object({
  name: z.string().min(1, '收藏夹名称不能为空').max(100, '收藏夹名称长度必须在1-100字符之间').optional(),
  description: z.string().max(500, '描述最多500字符').optional().or(z.literal('')),
  is_public: z.boolean().optional(),
  category_id: z.coerce.number().int().positive('category_id必须为正整数').optional().nullable(),
})

/** 添加收藏项 */
export const addFavoriteItemSchema = z.object({
  item_type: z.enum(['question', 'exam', 'task', 'note'], { message: 'item_type不合法' }),
  item_id: z.coerce.number().int().positive('item_id必须为正整数'),
  title: z.string().max(200, 'title最长200字符').optional().or(z.literal('')),
  description: z.string().max(500, 'description最长500字符').optional().or(z.literal('')),
  tags: z.array(z.string().max(32, '单个tag最长32字符')).max(20, '最多20个tag').optional(),
  notes: z.string().max(1000, 'notes最长1000字符').optional().or(z.literal('')),
})

/** 快速收藏 */
export const quickFavoriteSchema = z.object({
  item_type: z.enum(['question', 'exam', 'task', 'note'], { message: 'item_type不合法' }),
  item_id: z.coerce.number().int().positive('item_id必须为正整数'),
  title: z.string().max(200, 'title最长200字符').optional().or(z.literal('')),
  description: z.string().max(500, 'description最长500字符').optional().or(z.literal('')),
})

/** 检查收藏状态：路由参数 */
export const checkStatusParamsSchema = z.object({
  itemType: z.enum(['question', 'exam', 'task', 'note'], { message: 'itemType不合法' }),
  itemId: z.coerce.number().int().positive('itemId必须为正整数'),
})

/** 批量移动收藏项 */
export const moveItemsSchema = z.object({
  item_ids: z.array(z.coerce.number().int().positive()).min(1, 'item_ids不能为空'),
  target_favorite_id: z.coerce.number().int().positive('target_favorite_id必须为正整数'),
})

/** 更新排序 */
export const updateOrderSchema = z.object({
  item_orders: z
    .array(
      z.object({
        item_id: z.coerce.number().int().positive(),
        sort_order: z.coerce.number().int(),
      })
    )
    .min(1, 'item_orders不能为空'),
})

/** 搜索收藏项 */
export const searchItemsQuerySchema = z.object({
  keyword: z.string().min(1, 'keyword不能为空'),
  item_type: z.enum(['question', 'exam', 'task', 'note']).optional(),
  favorite_id: z.coerce.number().int().positive().optional(),
})

export function zodErrors(e: unknown): string[] {
  if (e && typeof e === 'object' && 'issues' in (e as any)) {
    return (e as any).issues.map((i: any) => i.message ?? 'Invalid value')
  }
  return ['Invalid value']
}
