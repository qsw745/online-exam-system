import React, { useMemo } from 'react'
import { Tabs, Dropdown, type MenuProps } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useTabs } from '@/shared/contexts/TabsContext'

export const TabsBar: React.FC = () => {
  const navigate = useNavigate()
  const { tabs, activeKey, closeTab, closeOthers, closeAll } = useTabs()

  // 全量 tabs 直接用于 antd
  const items = useMemo(
    () =>
      tabs.map(t => ({
        key: t.key,
        label: t.title,
        closable: t.closable !== false,
      })),
    [tabs]
  )

  const menu: MenuProps['items'] = [
    { key: 'close-current', label: '关闭当前' },
    { key: 'close-others', label: '关闭其它' },
    { key: 'close-all', label: '关闭全部' },
  ]

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'close-current') closeTab(activeKey)
    else if (key === 'close-others') closeOthers(activeKey)
    else if (key === 'close-all') closeAll()
  }

  return (
    <div
      className="app-tabs-bar"
      style={{
        background: '#fff',
        position: 'relative',
        zIndex: 150,
        borderBottom: '1px solid #f0f0f0',
      }}
    >
      <style>
        {`
          .app-tabs-bar .ant-tabs-nav { margin: 0; }
          .app-tabs-bar .ant-tabs-nav-wrap { padding-right: 12px; }
          .app-tabs-bar .ant-tabs-editable-card .ant-tabs-tab { margin-right: 8px; }
          .app-tabs-bar .ant-tabs-nav .ant-tabs-nav-operations { margin: 0 2px; }
        `}
      </style>

      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Tabs
            type="editable-card"
            size="small"
            hideAdd
            items={items}
            activeKey={activeKey}
            onChange={k => navigate(k)}
            onEdit={(targetKey, action) => action === 'remove' && typeof targetKey === 'string' && closeTab(targetKey)}
            tabBarExtraContent={{
              right: (
                <Dropdown menu={{ items: menu, onClick: onMenuClick }} trigger={['click']}>
                  <a style={{ padding: '0 8px', fontSize: 12 }}>标签操作 ▾</a>
                </Dropdown>
              ),
            }}
          />
        </div>
      </div>
    </div>
  )
}
