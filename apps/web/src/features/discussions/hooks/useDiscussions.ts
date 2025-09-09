// src/features/discussions/hooks/useDiscussions.ts
import { useCallback, useEffect, useState } from 'react'
import { App, Form } from 'antd'
import type { Discussion, DiscussionCategory, Reply, SortBy } from '@/shared/api/http'
import { discussionsApi } from '@/shared/api/endpoints/discussions'

type CreateDiscussionDto = {
  title: string
  category_id: number
  question_id?: number
  content: string
}
type CreateReplyDto = { content: string }

export function useDiscussions() {
  const { message } = App.useApp()

  // 列表/详情/回复
  const [discussions, setDiscussions] = useState<Discussion[]>([])
  const [selectedDiscussion, setSelectedDiscussion] = useState<Discussion | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])

  // 基础数据
  const [categories, setCategories] = useState<DiscussionCategory[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<SortBy>('latest')

  // 加载状态
  const [loading, setLoading] = useState(true)
  const [repliesLoading, setRepliesLoading] = useState(false)

  // 弹窗控制
  const [createOpen, setCreateOpen] = useState(false)
  const [replyOpen, setReplyOpen] = useState(false)

  // 表单
  const [createForm] = Form.useForm<CreateDiscussionDto>()
  const [replyForm] = Form.useForm<CreateReplyDto>()

  // 拉取分类
  const fetchCategories = useCallback(async () => {
    try {
      const list = await discussionsApi.categories()
      setCategories(list)
    } catch {
      // 静默或按需提示
    }
  }, [])

  // 拉取讨论列表
  const fetchDiscussions = useCallback(async () => {
    try {
      setLoading(true)
      const params: Record<string, any> = { sort: sortBy, limit: 50 }
      if (selectedCategory !== 'all') params.category_id = selectedCategory
      const list = await discussionsApi.list(params)
      setDiscussions(list)
    } catch {
      setDiscussions([])
      message.error('获取讨论列表失败')
    } finally {
      setLoading(false)
    }
  }, [message, selectedCategory, sortBy])

  // 拉取回复
  const fetchReplies = useCallback(async (discussionId: number) => {
    try {
      setRepliesLoading(true)
      const list = await discussionsApi.replies(discussionId)
      setReplies(list)
    } finally {
      setRepliesLoading(false)
    }
  }, [])

  // 计数 +1（静默）
  const incrementViews = useCallback(async (discussionId: number) => {
    try {
      await discussionsApi.viewed(discussionId)
      setDiscussions(prev => prev.map(d => (d.id === discussionId ? { ...d, views_count: d.views_count + 1 } : d)))
      setSelectedDiscussion(prev =>
        prev && prev.id === discussionId ? { ...prev, views_count: prev.views_count + 1 } : prev
      )
    } catch {}
  }, [])

  // 点赞讨论
  const toggleLike = useCallback(
    async (id: number) => {
      try {
        const payload = await discussionsApi.like(id)
        if (!payload) return
        setDiscussions(prev => prev.map(d => (d.id === id ? { ...d, ...payload } : d)))
        setSelectedDiscussion(prev => (prev && prev.id === id ? { ...prev, ...payload } : prev))
      } catch {
        message.error('点赞失败')
      }
    },
    [message]
  )

  // 点赞回复
  const toggleReplyLike = useCallback(
    async (replyId: number) => {
      try {
        const payload = await discussionsApi.likeReply(replyId)
        if (!payload) return
        setReplies(prev => prev.map(r => (r.id === replyId ? { ...r, ...payload } : r)))
      } catch {
        message.error('点赞回复失败')
      }
    },
    [message]
  )

  // 新建讨论
  const createDiscussion = useCallback(
    async (values: CreateDiscussionDto) => {
      const created = await discussionsApi.create(values)
      if (created) {
        setDiscussions(prev => [created, ...prev])
        setCreateOpen(false)
        createForm.resetFields()
        message.success('发布讨论成功')
      } else {
        message.error('发布讨论失败')
      }
    },
    [createForm, message]
  )

  // 新建回复
  const createReply = useCallback(
    async (values: CreateReplyDto) => {
      if (!selectedDiscussion) return
      const created = await discussionsApi.reply(selectedDiscussion.id, values)
      if (created) {
        setReplies(prev => [...prev, created])
        setSelectedDiscussion(prev => (prev ? { ...prev, replies_count: prev.replies_count + 1 } : prev))
        setReplyOpen(false)
        replyForm.resetFields()
        message.success('回复成功')
      } else {
        message.error('回复失败')
      }
    },
    [message, replyForm, selectedDiscussion]
  )

  // 选择某条讨论 → 拉取回复、+1 浏览
  const selectDiscussion = useCallback(
    (d: Discussion) => {
      setSelectedDiscussion(d)
      fetchReplies(d.id)
      incrementViews(d.id)
    },
    [fetchReplies, incrementViews]
  )

  // 副作用：初始拉分类；过滤/排序变化拉列表
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
