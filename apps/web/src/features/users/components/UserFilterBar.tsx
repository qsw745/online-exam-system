// src/features/users/components/UserFilterBar.tsx
import { FilterOutlined, SearchOutlined, UserAddOutlined } from '@ant-design/icons'
import { Button, Input, Select, Space, Switch, Typography } from 'antd'
import { translate } from '@/shared/utils/i18n'
const { Option } = Select
const { Text } = Typography

export const UserFilterBar: React.FC<{
  keyword: string
  setKeyword: (v: string) => void
  role: string
  setRole: (v: string) => void
  includeChildren: boolean
  setIncludeChildren: (v: boolean) => void
  canBind: boolean
  onBindClick: () => void
}> = ({ keyword, setKeyword, role, setRole, includeChildren, setIncludeChildren, canBind, onBindClick }) => (
  <Space wrap style={{ width: '100%', justifyContent: 'space-between' }}>
    <Input
      placeholder={translate('auto.4c44e372f6')}
      value={keyword}
      onChange={e => setKeyword(e.target.value)}
      prefix={<SearchOutlined />}
      allowClear
      size="large"
      style={{ width: 360 }}
    />
    <Space align="center" wrap>
      <FilterOutlined style={{ color: '#8c8c8c' }} />
      <Select value={role} onChange={setRole} style={{ width: 140 }} size="large" placeholder={translate('workflowDesigner.fields.select_role')} allowClear>
        <Option value="">{translate('auto.1a02c80a37')}</Option>
        <Option value="student">{translate('auth.demo_student')}</Option>
        <Option value="teacher">{translate('auth.demo_teacher')}</Option>
        <Option value="admin">{translate('auth.demo_admin')}</Option>
      </Select>
      {canBind && (
        <Space>
          <Text type="secondary">{translate('users.filters.include_children')}</Text>
          <Switch checked={includeChildren} onChange={setIncludeChildren} />
        </Space>
      )}
      <Button type="primary" icon={<UserAddOutlined />} disabled={!canBind} onClick={onBindClick}>
        {translate('auto.6d16273ff8')}</Button>
    </Space>
  </Space>
)
