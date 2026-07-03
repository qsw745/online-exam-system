import { Button, Space } from 'antd'
import { PlusOutlined, DragOutlined, ExportOutlined, ImportOutlined } from '@ant-design/icons'
import { translate } from '@/shared/utils/i18n'

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
        {translate('auto.55c59bd0c9')}</Button>
      <Button icon={<DragOutlined />} onClick={onBatchSort}>
        {translate('auto.a0e1f784e9')}</Button>
      <Button icon={<ExportOutlined />} onClick={onExport}>
        {translate('auto.3d05c8ad5e')}</Button>
      <Button icon={<ImportOutlined />} onClick={onImport}>
        {translate('auto.280779a502')}</Button>
    </Space>
  )
}
