import React, { useState, useEffect } from 'react'
import { Card, List, Button, Modal, Form, Input, Select, Tag, Tooltip, Spin, App, Empty, Space, Typography, Row, Col } from 'antd'
import { Heart, Plus, Edit, Trash2, Share2, Eye, BookOpen, Star } from 'lucide-react'
import { api } from '../lib/api'

const { Option } = Select
const { TextArea } = Input
const { Title, Text } = Typography

interface Favorite {
  id: number
  name: string
  description?: string
  category_id: number
  category_name?: string
  category_color?: string
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

interface FavoriteCategory {
  id: number
  name: string
  description: string
  color: string
  icon: string
  sort_order: number
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
  const [categories, setCategories] = useState<FavoriteCategory[]>([])
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
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space align="center">
            <Heart style={{ width: 24, height: 24, color: '#f5222d' }} />
            <Title level={2} style={{ margin: 0 }}>我的收藏夹</Title>
          </Space>
          <Button 
            type="primary" 
            icon={<Plus style={{ width: 16, height: 16 }} />}
            onClick={() => setCreateModalVisible(true)}
          >
            新建收藏夹
          </Button>
        </div>

        <Row gutter={24}>
          {/* 收藏夹列表 */}
          <Col xs={24} lg={10}>
            <Card title="收藏夹列表" style={{ height: '100%' }}>
            <Spin spinning={loading}>
              {favorites.length === 0 ? (
                <Empty description="暂无收藏夹" />
              ) : (
                <List
                  dataSource={favorites}
                  renderItem={(favorite) => (
                    <List.Item
                      style={{
                        cursor: 'pointer',
                        borderRadius: 8,
                        padding: 12,
                        marginBottom: 8,
                        backgroundColor: selectedFavorite?.id === favorite.id ? '#f0f9ff' : undefined,
                        border: selectedFavorite?.id === favorite.id ? '1px solid #bae6fd' : '1px solid transparent',
                        transition: 'all 0.2s'
                      }}
                      onClick={() => setSelectedFavorite(favorite)}
                      actions={[
                        <Tooltip title="编辑">
                          <Button
                            type="text"
                            size="small"
                            icon={<Edit style={{ width: 16, height: 16 }} />}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedFavorite(favorite)
                              editForm.setFieldsValue({
                                ...favorite,
                                category_id: favorite.category_id
                              })
                              setEditModalVisible(true)
                            }}
                          />
                        </Tooltip>,
                        <Tooltip title="分享">
                          <Button
                            type="text"
                            size="small"
                            icon={<Share2 style={{ width: 16, height: 16 }} />}
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
                            icon={<Trash2 style={{ width: 16, height: 16 }} />}
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
                                <Eye style={{ width: 12, height: 12, marginRight: 4 }} />
                                公开
                              </Tag>
                            )}
                          </div>
                        }
                        description={
                          <div>
                            <Text type="secondary" style={{ fontSize: 14, marginBottom: 4, display: 'block' }}>
                              {favorite.description || '暂无描述'}
                            </Text>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Tag color={favorite.category_color || 'purple'}>{favorite.category_name || '未分类'}</Tag>
                              <Text type="secondary" style={{ fontSize: 12 }}>{favorite.items_count} 题</Text>
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
        </Col>

          {/* 收藏夹内容 */}
          <Col xs={24} lg={14}>
            <Card 
              title={
                selectedFavorite ? (
                  <Space align="center">
                    <BookOpen style={{ width: 20, height: 20 }} />
                    <span>{selectedFavorite.name}</span>
                    <Tag color={selectedFavorite.category_color || 'purple'}>{selectedFavorite.category_name || '未分类'}</Tag>
                    {selectedFavorite.is_public && (
                      <Tag color="blue">
                        <Eye style={{ width: 12, height: 12, marginRight: 4 }} />
                        公开
                      </Tag>
                    )}
                  </Space>
                ) : '选择收藏夹查看内容'
              }
              style={{ height: '100%' }}
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
                            icon={<Trash2 style={{ width: 16, height: 16 }} />}
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
                            <Space size="large">
                              <Text type="secondary" style={{ fontSize: 14 }}>科目: {item.subject}</Text>
                              <Text type="secondary" style={{ fontSize: 14 }}>类型: {item.question_type}</Text>
                              <Text type="secondary" style={{ fontSize: 14 }}>收藏时间: {new Date(item.added_at).toLocaleDateString()}</Text>
                            </Space>
                          }
                        />
                      </List.Item>
                    )}
                  />
                )}
              </Spin>
              ) : (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <Star style={{ width: 64, height: 64, color: '#d9d9d9', margin: '0 auto 16px' }} />
                  <Text type="secondary">请选择一个收藏夹查看内容</Text>
                </div>
              )}
          </Card>
           </Col>
         </Row>

      {/* 创建收藏夹模态框 */}
      <Modal
        title="创建收藏夹"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={() => form.submit()}
        okText="创建"
        cancelText="取消"
        destroyOnHidden={true}
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
            name="category_id"
            label="分类"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select placeholder="请选择分类">
              {categories.map(category => (
                <Option key={category.id} value={category.id}>{category.name}</Option>
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
        destroyOnHidden={true}
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
            name="category_id"
            label="分类"
            rules={[{ required: true, message: '请选择分类' }]}
          >
            <Select placeholder="请选择分类">
              {categories.map(category => (
                <Option key={category.id} value={category.id}>{category.name}</Option>
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
    </Space>
    </div>
  )
}