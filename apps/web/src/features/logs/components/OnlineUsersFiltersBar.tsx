// apps/web/src/features/logs/components/OnlineUsersFiltersBar.tsx
import { Button, Input, Typography } from 'antd'
import { translate } from '@/shared/utils/i18n'

const { Text } = Typography

export default function OnlineUsersFiltersBar({
  username,
  onUsernameChange,
  onSearch,
  onReset,
  loading,
}: {
  username: string
  onUsernameChange: (v: string) => void
  onSearch: () => void
  onReset: () => void
  loading?: boolean
}) {
  return (
    <div
      style={{
        display: 'inline-grid', // ✅ 让容器按内容宽度收缩
        gridTemplateColumns: 'auto max-content max-content', // ✅ 按内容决定列宽，按钮不被拉伸
        gap: 16,
        alignItems: 'center',
        width: 'fit-content', // ✅ fit-content，整体缩小并靠左
        maxWidth: '100%',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Text strong style={{ width: 64, textAlign: 'right' }}>
          {translate('auth.username')}</Text>
        <Input
          allowClear
          placeholder={translate('auto.ad5f05f1cf')}
          value={username}
          onChange={e => onUsernameChange(e.target.value)}
          style={{ width: 240 }} // 你要更短可调成 200/220
        />
      </div>

      <Button
        type="primary"
        onClick={onSearch}
        loading={loading}
        style={{ minWidth: 88 }} // 小保护，避免太窄
      >
        {translate('app.search')}</Button>

      <Button onClick={onReset} disabled={loading} style={{ minWidth: 88 }}>
        {translate('app.reset')}</Button>
    </div>
  )
}
