import { Button, List, Tag, Tooltip, Typography } from 'antd'
import { Edit, Share2, Trash2, Eye } from 'lucide-react'
import type { Favorite } from '@/shared/api/endpoints/favorites'
import { translate } from '@/shared/utils/i18n'

const { Text } = Typography

type Props = {
  data: Favorite[]
  selectedId: number | null
  onSelect: (fav: Favorite) => void
  onEdit: (fav: Favorite) => void
  onShare: (fav: Favorite) => void
  onDelete: (fav: Favorite) => void
}

export default function FavoritesList({ data, selectedId, onSelect, onEdit, onShare, onDelete }: Props) {
  return (
    <List
      dataSource={data}
      renderItem={favorite => (
        <List.Item
          style={{
            cursor: 'pointer',
            borderRadius: 8,
            padding: 12,
            marginBottom: 8,
            backgroundColor: selectedId === favorite.id ? '#f0f9ff' : undefined,
            border: selectedId === favorite.id ? '1px solid #bae6fd' : '1px solid transparent',
            transition: 'all 0.2s',
          }}
          onClick={() => onSelect(favorite)}
          actions={[
            <Tooltip title={translate('app.edit')} key="edit">
              <Button
                type="text"
                size="small"
                icon={<Edit style={{ width: 16, height: 16 }} />}
                onClick={e => {
                  e.stopPropagation()
                  onEdit(favorite)
                }}
              />
            </Tooltip>,
            <Tooltip title={translate('auto.7a92434114')} key="share">
              <Button
                type="text"
                size="small"
                icon={<Share2 style={{ width: 16, height: 16 }} />}
                onClick={e => {
                  e.stopPropagation()
                  onShare(favorite)
                }}
              />
            </Tooltip>,
            <Tooltip title={translate('app.delete')} key="delete">
              <Button
                type="text"
                size="small"
                danger
                icon={<Trash2 style={{ width: 16, height: 16 }} />}
                onClick={e => {
                  e.stopPropagation()
                  onDelete(favorite)
                }}
              />
            </Tooltip>,
          ]}
        >
          <List.Item.Meta
            title={
              <div className="flex items-center space-x-2">
                <span>{favorite.name}</span>
                {Boolean(favorite.is_public) && ( // 关键：Boolean()，避免 0 被当成文本渲染
                  <Tag
                    color="blue"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, paddingInline: 8, height: 22 }}
                  >
                    <Eye style={{ width: 12, height: 12 }} /> {translate('settings.public')}</Tag>
                )}
              </div>
            }
            description={
              <div>
                <Text type="secondary" style={{ fontSize: 14, marginBottom: 4, display: 'block' }}>
                  {favorite.description || translate('visible.4b64e784af')}
                </Text>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Tag color={favorite.category_color || 'purple'}>{favorite.category_name || translate('visible.b28f13ea3e')}</Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {Number(favorite.items_count ?? 0)} {translate('papers.unit_question')}</Text>
                </div>
              </div>
            }
          />
        </List.Item>
      )}
    />
  )
}
