// src/shared/components/TabsBar.tsx
import React, { useMemo } from 'react'
import { Tabs, Dropdown, type MenuProps } from 'antd'
import { useTabs } from '@/shared/contexts/TabsContext'

const DASHBOARD_CANON = '/dashboard'
const isDash = (k?: string) => k === '/' || k === DASHBOARD_CANON
const norm = (k?: string) => (isDash(k) ? DASHBOARD_CANON : k || '/')

export const TabsBar: React.FC = () => {
  const { tabs, activeKey, setActiveKey, remove, clear, closeOthers } = useTabs()

  // 左侧固定：仪表盘（从 tabs 列表里剥离）
  const dashTitle = tabs.find(t => isDash(t.key))?.title || '仪表盘'
  const nonDashTabs = useMemo(() => tabs.filter(t => !isDash(t.key)), [tabs])

  const items = useMemo(
    () =>
      nonDashTabs.map(t => ({
        key: t.key,
        label: t.title,
        closable: t.closable !== false,
      })),
    [nonDashTabs]
  )

  const menu: MenuProps['items'] = [
    { key: 'close-current', label: '关闭当前' },
    { key: 'close-others', label: '关闭其它' },
    { key: 'close-all', label: '关闭全部' },
  ]

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'close-current') remove(activeKey)
    else if (key === 'close-others') closeOthers(activeKey)
    else if (key === 'close-all') clear()
  }

  const isDashActive = isDash(activeKey)

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
          .app-tabs-bar .dash-chip {
            height: 30px;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 0 12px;
            margin: 8px 8px 8px 12px; /* 左固定胶囊的外边距 */
            border: 1px solid var(--app-colorSplit, #f0f0f0);
            border-radius: 8px;
            background: #fff;
            cursor: pointer;
            user-select: none;
            white-space: nowrap;
            font-size: 14px;
          }
          .app-tabs-bar .dash-chip.active {
            color: var(--app-colorPrimary, #1677ff);
            border-color: var(--app-colorPrimaryBorder, #91caff);
            background: var(--app-colorPrimaryBg, #e6f4ff);
          }

          /* Tabs 自身样式微调：贴近 dash-chip，并给每个标签一点间距 */
          .app-tabs-bar .ant-tabs-nav { margin: 0; }
          .app-tabs-bar .ant-tabs-nav-wrap { padding-right: 12px; }
          .app-tabs-bar .ant-tabs-editable-card .ant-tabs-tab { margin-right: 8px; }
          .app-tabs-bar .ant-tabs-nav .ant-tabs-nav-operations { margin: 0 2px; }
        `}
      </style>

      <div style={{ display: 'flex', alignItems: 'center' }}>
        {/* 左侧固定“仪表盘” */}
        <button
          type="button"
          className={`dash-chip ${isDashActive ? 'active' : ''}`}
          onClick={() => setActiveKey(DASHBOARD_CANON)}
          title={dashTitle}
        >
          {dashTitle}
        </button>

        {/* 右侧滚动 Tabs（不包含仪表盘） */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Tabs
            type="editable-card"
            size="small"
            hideAdd
            items={items}
            // 仪表盘被选中时，Tabs 内没有激活项；传一个不存在的 key 可避免 Tabs 误选
            activeKey={isDashActive ? '__none__' : norm(activeKey)}
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
        </div>
      </div>
    </div>
  )
}
