import { discussionsApi } from '@/shared/api/endpoints/discussions'
import { App, Form } from 'antd'
import { useCallback, useEffect, useState } from 'react'
import { translate } from '@/shared/utils/i18n'

// —— 最小必要类型，避免外部类型导入不齐导致构建失败 ——
export type SortBy = 'latest' | 'hot' | 'replies'
export type Discussion = Record<string, any>
export type DiscussionCategory = { id: number; name?: string; color?: string }
export type Reply = Record<string, any>

type CreateDiscussionDto = {
  title: string
  category_id: number
  question_id?: number
  content: string
}
type CreateReplyDto = { content: string }

// —— 把后端任何形态的分类，规范成 {id, name, color} ——
const normalizeCategories = (raw: any): DiscussionCategory[] => {
  const arr = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : []
  return arr.map((c: any) => ({
    id: Number(c?.id ?? c),
    name: String(c?.name ?? c?.title ?? c?.label ?? c ?? ''),
    color: c?.color,
  }))
}

export function useDiscussions() {
  const { message } = App.useApp()

  const [discussions, setDiscussions] = useState<Discussion[]>([])
  const [selectedDiscussion, setSelectedDiscussion] = useState<Discussion | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])

  const [categories, setCategories] = useState<DiscussionCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortBy>('latest')

  const [loading, setLoading] = useState(true)
  const [repliesLoading, setRepliesLoading] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)

  const [createForm] = Form.useForm<CreateDiscussionDto>()
  const [replyForm] = Form.useForm<CreateReplyDto>()
  const viewedSet = new Set<number>()

  // 拉取分类（并做规范化）
  const fetchCategories = useCallback(async () => {
    try {
      const res = await discussionsApi.categories()
      setCategories(normalizeCategories(res))
    } catch {
      setCategories([])
    }
  }, [])

  // 拉取讨论列表
  const fetchDiscussions = useCallback(async () => {
    try {
      setLoading(true)
      const params: Record<string, any> = { sort: sortBy, limit: 50 }
      if (selectedCategory !== 'all') params.category_id = selectedCategory
      const list = await discussionsApi.list(params)
      setDiscussions(Array.isArray(list) ? list : [])
      setSelectedDiscussion(prev => (prev && Array.isArray(list) && list.some(d => d.id === prev.id) ? prev : null))
    } catch {
      setDiscussions([])
      message.error(translate('auto.512a763089'))
    } finally {
      setLoading(false)
    }
  }, [message, selectedCategory, sortBy])

  const fetchReplies = useCallback(async (discussionId: number) => {
    if (!discussionId) return
    try {
      setRepliesLoading(true)
      const list = await discussionsApi.replies(discussionId)
      setReplies(Array.isArray(list) ? list : [])
    } finally {
      setRepliesLoading(false)
    }
  }, [])

  const incrementViews = useCallback(async (discussionId: number) => {
    if (!discussionId || viewedSet.has(discussionId)) return

    try {
      await discussionsApi.viewed(discussionId)
      viewedSet.add(discussionId)
      setDiscussions(prev =>
        prev.map(d => (d.id === discussionId ? { ...d, views_count: (d.views_count ?? 0) + 1 } : d))
      )
      setSelectedDiscussion(prev =>
        prev && prev.id === discussionId ? { ...prev, views_count: (prev.views_count ?? 0) + 1 } : prev
      )
    } catch {}
  }, [])

  const toggleLike = useCallback(
    async (id: number) => {
      if (!id) return
      try {
        const payload = await discussionsApi.like(id)
        if (!payload) return
        setDiscussions(prev => prev.map(d => (d.id === id ? { ...d, ...payload } : d)))
        setSelectedDiscussion(prev => (prev && prev.id === id ? { ...prev, ...payload } : prev))
      } catch {
        message.error(translate('auto.b11cc4945e'))
      }
    },
    [message]
  )

  const toggleReplyLike = useCallback(
    async (replyId: number) => {
      if (!replyId) return
      try {
        const payload = await discussionsApi.likeReply(replyId)
        if (!payload) return
        setReplies(prev => prev.map(r => (r.id === replyId ? { ...r, ...payload } : r)))
      } catch {
        message.error(translate('auto.b406bf9867'))
      }
    },
    [message]
  )

  const createDiscussion = useCallback(
    async (values: CreateDiscussionDto) => {
      const created = await discussionsApi.create(values)
      if (created) {
        // 后端返回字段不全（缺作者/分类名），重新拉取列表保证展示完整
        await fetchDiscussions()
        setCreateOpen(false)
        createForm.resetFields()
        message.success(translate('auto.ce58397b82'))
      } else {
        message.error(translate('auto.412bb6e431'))
      }
    },
    [createForm, fetchDiscussions, message]
  )

  const createReply = useCallback(
    async (values: CreateReplyDto) => {
      if (!selectedDiscussion?.id) return
      const created = await discussionsApi.reply(selectedDiscussion.id, values)
      if (created) {
        await fetchReplies(selectedDiscussion.id)
        setSelectedDiscussion(prev => (prev ? { ...prev, replies_count: (prev.replies_count ?? 0) + 1 } : prev))
        setReplyOpen(false)
        replyForm.resetFields()
        message.success(translate('auto.31f44cfc31'))
      } else {
        message.error(translate('auto.fccf47ff04'))
      }
    },
    [fetchReplies, message, replyForm, selectedDiscussion]
  )

  const selectDiscussion = useCallback(
    (dOrId: Discussion | number) => {
      const disc = typeof dOrId === 'number' ? discussions.find(x => x.id === dOrId) || null : dOrId ?? null
      if (!disc?.id) return
      setSelectedDiscussion(disc)
      fetchReplies(disc.id)
      incrementViews(disc.id)
    },
    [discussions, fetchReplies, incrementViews]
  )

  useEffect(() => {
    fetchCategories()
  }, [fetchCategories])

  useEffect(() => {
    fetchDiscussions()
  }, [fetchDiscussions])

  return {
    // state
    discussions,
    selectedDiscussion,
    replies,
    categories,
    selectedCategory,
    sortBy,
    loading,
    repliesLoading,
    createOpen,
    replyOpen,

    // setters
    setSelectedCategory,
    setSortBy,
    setCreateOpen,
    setReplyOpen,

    // forms
    createForm,
    replyForm,

    // actions
    selectDiscussion,
    toggleLike,
    toggleReplyLike,
    createDiscussion,
    createReply,
  }
}
