import { App, Button, Card, Col, Empty, Modal, Row, Space, Typography } from 'antd'
import { Heart, Plus, BookOpen, Star } from 'lucide-react'
import { useFavorites } from '@/shared/hooks/useFavorites'
import FavoritesList from '../components/FavoritesList'
import FavoriteItems from '../components/FavoriteItems'
import CreateFavoriteModal from '../components/CreateFavoriteModal'
import EditFavoriteModal from '../components/EditFavoriteModal'

const { Title, Text } = Typography

export default function FavoritesPage() {
  const { message } = App.useApp()
  const {
    favorites,
    selected,
    selectedId,
    items,
    loading,
    itemsLoading,
    createOpen,
    editOpen,
    setSelectedId,
    setCreateOpen,
    setEditOpen,
    createFavorite,
    updateFavorite,
    deleteFavorite,
    removeItem,
    shareFavorite,
  } = useFavorites()

  const onDelete = (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '删除后无法恢复，确定要删除这个收藏夹吗？',
      onOk: () => deleteFavorite(id).catch(() => message.error('删除收藏夹失败')),
    })
  }

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 标题 + 按钮 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space align="center">
            <Heart style={{ width: 24, height: 24, color: '#f5222d' }} />
            <Title level={2} style={{ margin: 0 }}>
              我的收藏夹
            </Title>
          </Space>
          <Button type="primary" icon={<Plus style={{ width: 16, height: 16 }} />} onClick={() => setCreateOpen(true)}>
            新建收藏夹
          </Button>
        </div>

        <Row gutter={24}>
          {/* 左侧列表 */}
          <Col xs={24} lg={10}>
            <Card title="收藏夹列表" style={{ height: '100%' }}>
              {loading ? (
                <Empty description="加载中..." />
              ) : favorites.length === 0 ? (
                <Empty description="暂无收藏夹" />
              ) : (
                <FavoritesList
                  data={favorites}
                  selectedId={selectedId}
                  onSelect={fav => setSelectedId(fav.id)}
                  onEdit={fav => {
                    setSelectedId(fav.id)
                    setEditOpen(true)
                  }}
                  onShare={fav => shareFavorite(fav.id).catch(() => message.error('生成分享链接失败'))}
                  onDelete={fav => onDelete(fav.id)}
                />
              )}
            </Card>
          </Col>

          {/* 右侧明细 */}
          <Col xs={24} lg={14}>
            <Card
              title={
                selected ? (
                  <Space align="center">
                    <BookOpen style={{ width: 20, height: 20 }} />
                    <span>{selected.name}</span>
                  </Space>
                ) : (
                  '选择收藏夹查看内容'
                )
              }
              style={{ height: '100%' }}
            >
              {selected ? (
                <FavoriteItems
                  items={items}
                  loading={itemsLoading}
                  onView={qid => window.open(`/questions/${qid}`, '_blank')}
                  onRemove={id => removeItem(id).catch(() => message.error('移除失败'))}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <Star style={{ width: 64, height: 64, color: '#d9d9d9', margin: '0 auto 16px' }} />
                  <Text type="secondary">请选择一个收藏夹查看内容</Text>
                </div>
              )}
            </Card>
          </Col>
        </Row>

        {/* 创建 / 编辑模态框 */}
        <CreateFavoriteModal
          open={createOpen}
          onCancel={() => setCreateOpen(false)}
          onSubmit={vals =>
            createFavorite(vals)
              .then(() => setCreateOpen(false))
              .catch(() => message.error('创建收藏夹失败'))
          }
        />
        <EditFavoriteModal
          open={editOpen}
          initial={selected}
          onCancel={() => setEditOpen(false)}
          onSubmit={vals =>
            updateFavorite(vals)
              .then(() => setEditOpen(false))
              .catch(() => message.error('更新收藏夹失败'))
          }
        />
      </Space>
    </div>
  )
}
