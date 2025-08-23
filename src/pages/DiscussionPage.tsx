import React, { useState, useEffect } from 'react'
import { Card, List, Button, Modal, Form, Input, Select, Tag, Avatar, Space, Spin, Empty, App, Tooltip } from 'antd'
import { MessageSquare, Plus, ThumbsUp, MessageCircle, Eye, Clock, User } from 'lucide-react'
import { api } from '../lib/api'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)

const { Option } = Select
const { TextArea } = Input

interface Discussion {
  id: number
  title: string
  content: string
  category: string
  question_id?: number
  question_title?: string
  author_id: number
  author_name: string
  author_avatar?: string
  likes_count: number
  replies_count: number
  views_count: number
  is_liked: boolean
  is_pinned: boolean
  created_at: string
  updated_at: string
}

interface Reply {
  id: number
  content: string
  author_id: number
  author_name: string
  author_avatar?: string
  likes_count: number
  is_liked: boolean
  created_at: string
}

export default function DiscussionPage() {
  const { message } = App.useApp()
  const [discussions, setDiscussions] = useState<Discussion[]>([])
  const [selectedDiscussion, setSelectedDiscussion] = useState<Discussion | null>(null)
  const [replies, setReplies] = useState<Reply[]>([])
  const [loading, setLoading] = useState(true)
  const [repliesLoading, setRepliesLoading] = useState(false)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [replyModalVisible, setReplyModalVisible] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('latest')
  const [form] = Form.useForm()
  const [replyForm] = Form.useForm()

  useEffect(() => {
    fetchDiscussions()
    fetchCategories()
  }, [selectedCategory, sortBy])

  useEffect(() => {
    if (selectedDiscussion) {
      fetchReplies(selectedDiscussion.id)
      incrementViews(selectedDiscussion.id)
    }
  }, [selectedDiscussion])

  const fetchDiscussions = async () => {
    try {
      setLoading(true)
      const params = {
        category_id: selectedCategory !== 'all' ? selectedCategory : undefined,
        sort: sortBy,
        limit: 50
      }
      const response = await api.get('/discussions', { params })
      setDiscussions(response.data.data || [])
    } catch (error) {
      console.error('获取讨论列表失败:', error)
      message.error('获取讨论列表失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchReplies = async (discussionId: number) => {
    try {
      setRepliesLoading(true)
      const response = await api.get(`/discussions/${discussionId}/replies`)
      setReplies(response.data.data || [])
    } catch (error) {
      console.error('获取回复失败:', error)
      message.error('获取回复失败')
    } finally {
      setRepliesLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await api.get('/discussions/categories/list')
      setCategories(response.data.data || [])
    } catch (error) {
      console.error('获取分类失败:', error)
    }
  }

  const incrementViews = async (discussionId: number) => {
    try {
      await api.post(`/discussions/${discussionId}/view`)
      setDiscussions(prev => 
        prev.map(disc => 
          disc.id === discussionId 
            ? { ...disc, views_count: disc.views_count + 1 }
            : disc
        )
      )
    } catch (error) {
      // 静默处理浏览量更新失败
    }
  }

  const createDiscussion = async (values: any) => {
    try {
      const response = await api.post('/discussions', values)
      setDiscussions(prev => [response.data.data, ...prev])
      setCreateModalVisible(false)
      form.resetFields()
      message.success('发布讨论成功')
    } catch (error) {
      console.error('发布讨论失败:', error)
      message.error('发布讨论失败')
    }
  }

  const createReply = async (values: any) => {
    if (!selectedDiscussion) return
    
    try {
      const response = await api.post(`/discussions/${selectedDiscussion.id}/replies`, values)
      setReplies(prev => [...prev, response.data.data])
      setSelectedDiscussion(prev => prev ? { ...prev, replies_count: prev.replies_count + 1 } : null)
      setReplyModalVisible(false)
      replyForm.resetFields()
      message.success('回复成功')
    } catch (error) {
      console.error('回复失败:', error)
      message.error('回复失败')
    }
  }

  const toggleLike = async (discussionId: number) => {
    try {
      const response = await api.post(`/discussions/${discussionId}/like`)
      const { is_liked, likes_count } = response.data.data
      
      setDiscussions(prev => 
        prev.map(disc => 
          disc.id === discussionId 
            ? { ...disc, is_liked, likes_count }
            : disc
        )
      )
      
      if (selectedDiscussion?.id === discussionId) {
        setSelectedDiscussion(prev => prev ? { ...prev, is_liked, likes_count } : null)
      }
    } catch (error) {
      console.error('点赞失败:', error)
      message.error('点赞失败')
    }
  }

  const toggleReplyLike = async (replyId: number) => {
    try {
      const response = await api.post(`/discussions/replies/${replyId}/like`)
      const { is_liked, likes_count } = response.data.data
      
      setReplies(prev => 
        prev.map(reply => 
          reply.id === replyId 
            ? { ...reply, is_liked, likes_count }
            : reply
        )
      )
    } catch (error) {
      console.error('点赞回复失败:', error)
      message.error('点赞回复失败')
    }
  }

  const getCategoryColor = (category: string) => {
    const colors = {
      '题目讨论': 'blue',
      '学习交流': 'green',
      '考试心得': 'orange',
      '技术问题': 'purple',
      '其他': 'default'
    }
    return colors[category as keyof typeof colors] || 'default'
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <MessageSquare className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold">讨论区</h1>
        </div>
        <div className="flex items-center space-x-4">
          <Select
            value={selectedCategory}
            onChange={setSelectedCategory}
            style={{ width: 120 }}
          >
            <Option value="all">全部分类</Option>
            {categories.map(category => (
              <Option key={category} value={category}>{category}</Option>
            ))}
          </Select>
          <Select
            value={sortBy}
            onChange={setSortBy}
            style={{ width: 120 }}
          >
            <Option value="latest">最新发布</Option>
            <Option value="hot">热门讨论</Option>
            <Option value="replies">回复最多</Option>
          </Select>
          <Button 
            type="primary" 
            icon={<Plus className="w-4 h-4" />}
            onClick={() => setCreateModalVisible(true)}
          >
            发起讨论
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* 讨论列表 */}
        <div className="col-span-12 lg:col-span-5">
          <Card title="讨论列表" className="h-full">
            <Spin spinning={loading}>
              {discussions.length === 0 ? (
                <Empty description="暂无讨论" />
              ) : (
                <List
                  dataSource={discussions}
                  renderItem={(discussion) => (
                    <List.Item
                      className={`cursor-pointer rounded-lg p-4 mb-3 transition-colors border ${
                        selectedDiscussion?.id === discussion.id 
                          ? 'bg-blue-50 border-blue-200' 
                          : 'hover:bg-gray-50 border-gray-200'
                      }`}
                      onClick={() => setSelectedDiscussion(discussion)}
                    >
                      <div className="w-full">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-1">
                              {discussion.is_pinned && (
                                <Tag color="red" size="small">置顶</Tag>
                              )}
                              <Tag color={getCategoryColor(discussion.category)} size="small">
                                {discussion.category}
                              </Tag>
                            </div>
                            <h4 className="font-medium text-gray-900 mb-1 line-clamp-2">
                              {discussion.title}
                            </h4>
                            {discussion.question_title && (
                              <p className="text-sm text-blue-600 mb-1">
                                关联题目: {discussion.question_title}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm text-gray-500">
                          <div className="flex items-center space-x-2">
                            <Avatar 
                              src={discussion.author_avatar} 
                              size={20}
                              className="bg-blue-500"
                            >
                              {discussion.author_name.charAt(0)}
                            </Avatar>
                            <span>{discussion.author_name}</span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className="flex items-center space-x-1">
                              <ThumbsUp className="w-3 h-3" />
                              <span>{discussion.likes_count}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <MessageCircle className="w-3 h-3" />
                              <span>{discussion.replies_count}</span>
                            </span>
                            <span className="flex items-center space-x-1">
                              <Eye className="w-3 h-3" />
                              <span>{discussion.views_count}</span>
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
                          <span className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{dayjs(discussion.created_at).fromNow()}</span>
                          </span>
                        </div>
                      </div>
                    </List.Item>
                  )}
                />
              )}
            </Spin>
          </Card>
        </div>

        {/* 讨论详情和回复 */}
        <div className="col-span-12 lg:col-span-7">
          {selectedDiscussion ? (
            <Card 
              title={
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Tag color={getCategoryColor(selectedDiscussion.category)}>
                      {selectedDiscussion.category}
                    </Tag>
                    {selectedDiscussion.is_pinned && (
                      <Tag color="red">置顶</Tag>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      type={selectedDiscussion.is_liked ? 'primary' : 'default'}
                      size="small"
                      icon={<ThumbsUp className="w-4 h-4" />}
                      onClick={() => toggleLike(selectedDiscussion.id)}
                    >
                      {selectedDiscussion.likes_count}
                    </Button>
                    <Button 
                      type="primary"
                      size="small"
                      icon={<MessageCircle className="w-4 h-4" />}
                      onClick={() => setReplyModalVisible(true)}
                    >
                      回复
                    </Button>
                  </div>
                </div>
              }
              className="h-full"
            >
              <div className="space-y-4">
                {/* 讨论内容 */}
                <div>
                  <h2 className="text-xl font-bold mb-3">{selectedDiscussion.title}</h2>
                  {selectedDiscussion.question_title && (
                    <div className="bg-blue-50 p-3 rounded-lg mb-3">
                      <p className="text-sm text-blue-700">
                        <strong>关联题目:</strong> {selectedDiscussion.question_title}
                      </p>
                    </div>
                  )}
                  <div className="prose max-w-none">
                    <p className="whitespace-pre-wrap">{selectedDiscussion.content}</p>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="flex items-center space-x-2">
                      <Avatar 
                        src={selectedDiscussion.author_avatar} 
                        size={32}
                        className="bg-blue-500"
                      >
                        {selectedDiscussion.author_name.charAt(0)}
                      </Avatar>
                      <div>
                        <div className="font-medium">{selectedDiscussion.author_name}</div>
                        <div className="text-xs text-gray-500">
                          {dayjs(selectedDiscussion.created_at).format('YYYY-MM-DD HH:mm')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-gray-500">
                      <span className="flex items-center space-x-1">
                        <Eye className="w-4 h-4" />
                        <span>{selectedDiscussion.views_count} 浏览</span>
                      </span>
                      <span className="flex items-center space-x-1">
                        <MessageCircle className="w-4 h-4" />
                        <span>{selectedDiscussion.replies_count} 回复</span>
                      </span>
                    </div>
                  </div>
                </div>

                <Divider />

                {/* 回复列表 */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">回复 ({selectedDiscussion.replies_count})</h3>
                  <Spin spinning={repliesLoading}>
                    {replies.length === 0 ? (
                      <Empty description="暂无回复" />
                    ) : (
                      <List
                        dataSource={replies}
                        renderItem={(reply) => (
                          <List.Item className="border-b border-gray-100 last:border-b-0">
                            <div className="w-full">
                              <div className="flex items-start space-x-3">
                                <Avatar 
                                  src={reply.author_avatar} 
                                  size={32}
                                  className="bg-green-500"
                                >
                                  {reply.author_name.charAt(0)}
                                </Avatar>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="font-medium">{reply.author_name}</div>
                                    <div className="flex items-center space-x-2">
                                      <Button
                                        type={reply.is_liked ? 'primary' : 'text'}
                                        size="small"
                                        icon={<ThumbsUp className="w-3 h-3" />}
                                        onClick={() => toggleReplyLike(reply.id)}
                                      >
                                        {reply.likes_count}
                                      </Button>
                                      <span className="text-xs text-gray-500">
                                        {dayjs(reply.created_at).fromNow()}
                                      </span>
                                    </div>
                                  </div>
                                  <p className="whitespace-pre-wrap text-gray-700">{reply.content}</p>
                                </div>
                              </div>
                            </div>
                          </List.Item>
                        )}
                      />
                    )}
                  </Spin>
                </div>
              </div>
            </Card>
          ) : (
            <Card className="h-full">
              <div className="text-center py-12">
                <MessageSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">请选择一个讨论查看详情</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* 发起讨论模态框 */}
      <Modal
        title="发起讨论"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={() => form.submit()}
        okText="发布"
        cancelText="取消"
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={createDiscussion}
        >
          <Form.Item
            name="title"
            label="讨论标题"
            rules={[{ required: true, message: '请输入讨论标题' }]}
          >
            <Input placeholder="请输入讨论标题" />
          </Form.Item>
          <Form.Item
            name="category"
            label="分类"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select placeholder="请选择分类">
              {categories.map(category => (
                <Option key={category} value={category}>{category}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="question_id"
            label="关联题目（可选）"
          >
            <Input placeholder="输入题目ID（可选）" type="number" />
          </Form.Item>
          <Form.Item
            name="content"
            label="讨论内容"
            rules={[{ required: true, message: '请输入讨论内容' }]}
          >
            <TextArea rows={6} placeholder="请详细描述你的问题或想法..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* 回复模态框 */}
      <Modal
        title="回复讨论"
        open={replyModalVisible}
        onCancel={() => setReplyModalVisible(false)}
        onOk={() => replyForm.submit()}
        okText="回复"
        cancelText="取消"
      >
        <Form
          form={replyForm}
          layout="vertical"
          onFinish={createReply}
        >
          <Form.Item
            name="content"
            label="回复内容"
            rules={[{ required: true, message: '请输入回复内容' }]}
          >
            <TextArea rows={4} placeholder="请输入你的回复..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}