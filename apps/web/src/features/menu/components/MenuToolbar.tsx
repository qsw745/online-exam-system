import { Button, Space } from 'antd'
import { PlusOutlined, DragOutlined, ExportOutlined, ImportOutlined } from '@ant-design/icons'

export default function MenuToolbar({
  onCreate,
  onBatchSort,
  onExport,
  onImport,
}: {
  onCreate: () => void
  onBatchSort: () => void
  onExport: () => void
  onImport: () => void
}) {
  return (
    <Space>
      <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
        新增菜单
      </Button>
      <Button icon={<DragOutlined />} onClick={onBatchSort}>
        批量排序
      </Button>
      <Button icon={<ExportOutlined />} onClick={onExport}>
        导出配置
      </Button>
      <Button icon={<ImportOutlined />} onClick={onImport}>
        导入配置
      </Button>
    </Space>
  )
}
