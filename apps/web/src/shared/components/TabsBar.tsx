import React from 'react'
import { Tabs, Dropdown, type MenuProps } from 'antd'
import { useTabs } from '@/shared/contexts/TabsContext'


export const TabsBar: React.FC = () => {
  const { tabs, activeKey, setActiveKey, remove, clear } = useTabs()

  const items = tabs.map(t => ({ key: t.key, label: t.title, closable: t.closable !== false }))
  const menu: MenuProps['items'] = [
    { key: 'close-current', label: '关闭当前' },
    { key: 'close-others', label: '关闭其它' },
    { key: 'close-all', label: '关闭全部' },
  ]

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'close-current') remove(activeKey)
    else if (key === 'close-others')
      tabs.forEach(t => {
        if (t.key !== activeKey && t.closable !== false) remove(t.key)
      })
    else if (key === 'close-all') clear()
  }

  return (
    <Tabs
      animated
      tabBarGutter={8}
      type="editable-card"
      size="middle"
      hideAdd
      items={items}
      activeKey={activeKey}
      onChange={setActiveKey}
      onEdit={(targetKey, action) => action === 'remove' && typeof targetKey === 'string' && remove(targetKey)}
      tabBarExtraContent={{
        right: (
          <Dropdown menu={{ items: menu, onClick: onMenuClick }} trigger={['click']}>
            <a style={{ padding: '0 8px', fontSize: 12 }}>标签操作 ▾</a>
          </Dropdown>
        ),
      }}
    />
  )
}
