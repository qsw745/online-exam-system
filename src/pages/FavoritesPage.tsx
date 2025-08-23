import React, { useState, useEffect } from 'react'
import { Card, List, Button, Modal, Form, Input, Select, Tag, Tooltip, Spin, App, Empty } from 'antd'
import { Heart, Plus, Edit, Trash2, Share2, Eye, BookOpen, Star } from 'lucide-react'
import { api } from '../lib/api'

const { Option } = Select
const { TextArea } = Input

interface Favorite {
  id: number
  name: string
  description?: string
  category: string
  is_public: boolean
  items_count: number
  created_at: string
  updated_at: string
}

interface FavoriteItem {
  id: number
  question_id: number
  question_title: string
  question_type: string
  difficulty: string
  subject: string
  added_at: string
}

export default function FavoritesPage() {
  const { message } = App.useApp()
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [selectedFavorite, setSelectedFavorite] = useState<Favorite | null>(null)
  const [favoriteItems, setFavoriteItems] = useState<FavoriteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [categories, setCategories] = useState<string[]>([])
  const [form] = Form.useForm()
  const [editForm] = Form.useForm()

  useEffect(() => {
    fetchFavorites()
    fetchCategories()
  }, [])

  useEffect(() => {
    if (selectedFavorite) {
      fetchFavoriteItems(selectedFavorite.id)
    }
  }, [selectedFavorite])

  const fetchFavorites = async () => {
    try {
      setLoading(true)
      const response = await api.get('/favorites')
      setFavorites(response.data.data || [])
      if (response.data.data?.length > 0 && !selectedFavorite) {
        setSelectedFavorite(response.data.data[0])
      }
    } catch (error) {
      console.error('获取收藏夹失败:', error)
      message.error('获取收藏夹失败')
    } finally {
      setLoading(false)
    }
  }

  const fetchFavoriteItems = async (favoriteId: number) => {
    try {
      setItemsLoading(true)
      const response = await api.get(`/favorites/${favoriteId}/items`)
      setFavoriteItems(response.data.data || [])
    } catch (error) {
      console.error('获取收藏夹内容失败:', error)
      message.error('获取收藏夹内容失败')
    } finally {
      setItemsLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await api.get('/favorites/categories/list')
      setCategories(response.data.data || [])
    } catch (error) {
      console.error('获取分类失败:', error)
    }
  }

  const createFavorite = async (values: any) => {
    try {
      const response = await api.post('/favorites', values)
      setFavorites(prev => [response.data.data, ...prev])
      setCreateModalVisible(false)
      form.resetFields()
      message.success('创建收藏夹成功')
    } catch (error) {
      console.error('创建收藏夹失败:', error)
      message.error('创建收藏夹失败')
    }
  }

  const updateFavorite = async (values: any) => {
    if (!selectedFavorite) return
    
    try {
      const response = await api.put(`/favorites/${selectedFavorite.id}`, values)
      setFavorites(prev => 
        prev.map(fav => 
          fav.id === selectedFavorite.id ? response.data.data : fav
        )
      )
      setSelectedFavorite(response.data.data)
      setEditModalVisible(false)
      editForm.resetFields()
      message.success('更新收藏夹成功')
    } catch (error) {
      console.error('更新收藏夹失败:', error)
      message.error('更新收藏夹失败')
    }
  }

  const deleteFavorite = async (favoriteId: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这个收藏夹吗？',
      onOk: async () => {
        try {
          await api.delete(`/favorites/${favoriteId}`)
          setFavorites(prev => prev.filter(fav => fav.id !== favoriteId))
          if (selectedFavorite?.id === favoriteId) {
            const remaining = favorites.filter(fav => fav.id !== favoriteId)
            setSelectedFavorite(remaining.length > 0 ? remaining[0] : null)
          }
          message.success('删除收藏夹成功')
        } catch (error) {
          console.error('删除收藏夹失败:', error)
          message.error('删除收藏夹失败')
        }
      }
    })
  }

  const removeFromFavorite = async (itemId: number) => {
    if (!selectedFavorite) return
    
    try {
      await api.delete(`/favorites/${selectedFavorite.id}/items/${itemId}`)
      setFavoriteItems(prev => prev.filter(item => item.id !== itemId))
      setSelectedFavorite(prev => prev ? { ...prev, items_count: prev.items_count - 1 } : null)
      message.success('移除成功')
    } catch (error) {
      console.error('移除失败:', error)
      message.error('移除失败')
    }
  }

  const shareFavorite = async (favoriteId: number) => {
    try {
      const response = await api.post(`/favorites/${favoriteId}/share`)
      const shareLink = response.data.data?.share_link
      if (shareLink) {
        navigator.clipboard.writeText(shareLink)
        message.success('分享链接已复制到剪贴板')
      }
    } catch (error) {
      console.error('生成分享链接失败:', error)
      message.error('生成分享链接失败')
    }
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return 'green'
      case 'medium': return 'orange'
      case 'hard': return 'red'
      default: return 'default'
    }
  }

  const getDifficultyText = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return '简单'
      case 'medium': return '中等'
      case 'hard': return '困难'
      default: return difficulty
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Heart className="w-6 h-6 text-red-500" />
          <h1 className="text-2xl font-bold">我的收藏夹</h1>
        </div>
        <Button 
          type="primary" 
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setCreateModalVisible(true)}
        >
          新建收藏夹
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* 收藏夹列表 */}
        <div className="col-span-12 lg:col-span-4">
          <Card title="收藏夹列表" className="h-full">
            <Spin spinning={loading}>
              {favorites.length === 0 ? (
                <Empty description="暂无收藏夹" />
              ) : (
                <List
                  dataSource={favorites}
                  renderItem={(favorite) => (
                    <List.Item
                      className={`cursor-pointer rounded-lg p-3 mb-2 transition-colors ${
                        selectedFavorite?.id === favorite.id 
                          ? 'bg-blue-50 border-blue-200' 
                          : 'hover:bg-gray-50'
                      }`}
                      onClick={() => setSelectedFavorite(favorite)}
                      actions={[
                        <Tooltip title="编辑">
                          <Button
                            type="text"
                            size="small"
                            icon={<Edit className="w-4 h-4" />}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedFavorite(favorite)
                              editForm.setFieldsValue(favorite)
                              setEditModalVisible(true)
                            }}
                          />
                        </Tooltip>,
                        <Tooltip title="分享">
                          <Button
                            type="text"
                            size="small"
                            icon={<Share2 className="w-4 h-4" />}
                            onClick={(e) => {
                              e.stopPropagation()
                              shareFavorite(favorite.id)
                            }}
                          />
                        </Tooltip>,
                        <Tooltip title="删除">
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<Trash2 className="w-4 h-4" />}
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteFavorite(favorite.id)
                            }}
                          />
                        </Tooltip>
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <div className="flex items-center space-x-2">
                            <span>{favorite.name}</span>
                            {favorite.is_public && (
                              <Tag color="blue" size="small">
                                <Eye className="w-3 h-3 inline mr-1" />
                                公开
                              </Tag>
                            )}
                          </div>
                        }
                        description={
                          <div>
                            <div className="text-sm text-gray-600 mb-1">
                              {favorite.description || '暂无描述'}
                            </div>
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <Tag color="purple">{favorite.category}</Tag>
                              <span>{favorite.items_count} 题</span>
                            </div>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
            </Spin>
          </Card>
        </div>

        {/* 收藏夹内容 */}
        <div className="col-span-12 lg:col-span-8">
          <Card 
            title={
              selectedFavorite ? (
                <div className="flex items-center space-x-3">
                  <BookOpen className="w-5 h-5" />
                  <span>{selectedFavorite.name}</span>
                  <Tag color="purple">{selectedFavorite.category}</Tag>
                  {selectedFavorite.is_public && (
                    <Tag color="blue">
                      <Eye className="w-3 h-3 inline mr-1" />
                      公开
                    </Tag>
                  )}
                </div>
              ) : '选择收藏夹查看内容'
            }
            className="h-full"
          >
            {selectedFavorite ? (
              <Spin spinning={itemsLoading}>
                {favoriteItems.length === 0 ? (
                  <Empty description="收藏夹为空" />
                ) : (
                  <List
                    dataSource={favoriteItems}
                    renderItem={(item) => (
                      <List.Item
                        actions={[
                          <Button
                            type="link"
                            onClick={() => window.open(`/questions/${item.question_id}`, '_blank')}
                          >
                            查看题目
                          </Button>,
                          <Button
                            type="text"
                            danger
                            icon={<Trash2 className="w-4 h-4" />}
                            onClick={() => removeFromFavorite(item.id)}
                          >
                            移除
                          </Button>
                        ]}
                      >
                        <List.Item.Meta
                          title={
                            <div className="flex items-center space-x-2">
                              <span>{item.question_title}</span>
                              <Tag color={getDifficultyColor(item.difficulty)}>
                                {getDifficultyText(item.difficulty)}
                              </Tag>
                            </div>
                          }
                          description={
                            <div className="flex items-center space-x-4 text-sm text-gray-600">
                              <span>科目: {item.subject}</span>
                              <span>类型: {item.question_type}</span>
                              <span>收藏时间: {new Date(item.added_at).toLocaleDateString()}</span>
                            </div>
                          }
                        />
                      </List.Item>
                    )}
                  />
                )}
              </Spin>
            ) : (
              <div className="text-center py-12">
                <Star className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">请选择一个收藏夹查看内容</p>
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* 创建收藏夹模态框 */}
      <Modal
        title="新建收藏夹"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={() => form.submit()}
        okText="创建"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={createFavorite}
        >
          <Form.Item
            name="name"
            label="收藏夹名称"
            rules={[{ required: true, message: '请输入收藏夹名称' }]}
          >
            <Input placeholder="请输入收藏夹名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={3} placeholder="请输入收藏夹描述" />
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
            name="is_public"
            label="是否公开"
            initialValue={false}
          >
            <Select>
              <Option value={false}>私有</Option>
              <Option value={true}>公开</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑收藏夹模态框 */}
      <Modal
        title="编辑收藏夹"
        open={editModalVisible}
        onCancel={() => setEditModalVisible(false)}
        onOk={() => editForm.submit()}
        okText="保存"
        cancelText="取消"
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={updateFavorite}
        >
          <Form.Item
            name="name"
            label="收藏夹名称"
            rules={[{ required: true, message: '请输入收藏夹名称' }]}
          >
            <Input placeholder="请输入收藏夹名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="描述"
          >
            <TextArea rows={3} placeholder="请输入收藏夹描述" />
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
            name="is_public"
            label="是否公开"
          >
            <Select>
              <Option value={false}>私有</Option>
              <Option value={true}>公开</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}