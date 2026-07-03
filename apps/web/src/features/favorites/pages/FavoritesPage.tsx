
import { useFavorites } from '@/shared/hooks/useFavorites'
import { App, Button, Card, Col, Empty, Modal, Row, Space, Typography } from 'antd'
import { BookOpen, Heart, Plus, Star } from 'lucide-react'
import CreateFavoriteModal from '../components/CreateFavoriteModal'
import EditFavoriteModal from '../components/EditFavoriteModal'
import FavoriteItems from '../components/FavoriteItems'
import FavoritesList from '../components/FavoritesList'
import { translate } from '@/shared/utils/i18n'
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
      title: translate('papers.confirm_delete'),
      content: translate('auto.55f8f1225b'),
      onOk: () => deleteFavorite(id).catch(() => message.error(translate('auto.c127a4863b'))),
    })
  }

  return (
    <div >
   
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* 标题 + 按钮 */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Space align="center">
            <Heart style={{ width: 24, height: 24, color: '#f5222d' }} />
            <Title level={2} style={{ margin: 0 }}>
              {translate('auto.aa8ab014e9')}</Title>
          </Space>
          <Button type="primary" icon={<Plus style={{ width: 16, height: 16 }} />} onClick={() => setCreateOpen(true)}>
            {translate('auto.be459bcd93')}</Button>
        </div>

        <Row gutter={24}>
          {/* 左侧列表 */}
          <Col xs={24} lg={10}>
            <Card title={translate('auto.1ece63b7c9')} style={{ height: '100%' }}>
              {loading ? (
                <Empty description={translate('app.loading')} />
              ) : favorites.length === 0 ? (
                <Empty description={translate('auto.5111da5937')} />
              ) : (
                <FavoritesList
                  data={favorites}
                  selectedId={selectedId}
                  onSelect={fav => setSelectedId(fav.id)}
                  onEdit={fav => {
                    setSelectedId(fav.id)
                    setEditOpen(true)
                  }}
                  onShare={fav => shareFavorite(fav.id).catch(() => message.error(translate('auto.19a9339497')))}
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
                  translate('visible.866240e0b2')
                )
              }
              style={{ height: '100%' }}
            >
              {selected ? (
                <FavoriteItems
                  items={items}
                  loading={itemsLoading}
                  onView={qid => window.open(`/questions/${qid}`, '_blank')}
                  onRemove={id => removeItem(id).catch(() => message.error(translate('papers.remove_failed')))}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <Star style={{ width: 64, height: 64, color: '#d9d9d9', margin: '0 auto 16px' }} />
                  <Text type="secondary">{translate('auto.f5c9ac95af')}</Text>
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
              .catch(() => message.error(translate('auto.83d3a1137b')))
          }
        />
        <EditFavoriteModal
          open={editOpen}
          initial={selected}
          onCancel={() => setEditOpen(false)}
          onSubmit={vals =>
            updateFavorite(vals)
              .then(() => setEditOpen(false))
              .catch(() => message.error(translate('auto.5008e77ced')))
          }
        />
      </Space>
    </div>
  )
}
