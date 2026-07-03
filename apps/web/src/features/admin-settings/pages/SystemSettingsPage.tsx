// features/admin-settings/pages/AdminSettingsPage.tsx

import SectionCard from '@/shared/components/SectionCard'
import { SettingOutlined } from '@ant-design/icons'
import { Col, Row, Typography } from 'antd'
import { SettingsForm } from '../components/SettingsForm'
import { useSettings } from '../hooks/useSettings'
import { translate } from '@/shared/utils/i18n'
const { Title, Text } = Typography

export default function AdminSettingsPage() {
  const { loading, initial, current, setCurrent, save, load, isDirty } = useSettings()

  return (
    <div >
 
      <div style={{ marginBottom: 24 }}>
        <Title level={2}>
          <SettingOutlined style={{ marginRight: 8 }} />
          {translate('menus.system-settings')}</Title>
        <Text type="secondary">{translate('auto.e8c95c7822')}</Text>
      </div>

      <Row gutter={[24, 24]}>
        <Col span={24}>
          <SectionCard title={translate('auto.b68228a04e')} loading={loading}>
            <SettingsForm
              value={current ?? undefined}
              loading={loading}
              onChange={setCurrent as any}
              onSubmit={async v => {
                await save(v)
              }}
              onReset={() => {
                if (initial) setCurrent(initial)
              }}
              disableSave={!isDirty}
            />
          </SectionCard>
        </Col>
      </Row>
    </div>
  )
}
