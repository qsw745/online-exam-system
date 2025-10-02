import React from 'react'
import { Drawer, Divider, Switch, Tooltip } from 'antd'
import { useLayout } from '@/shared/contexts/LayoutContext'
import { Info } from 'lucide-react'

type Props = { open: boolean; onClose: () => void }

function ModeCard({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 56, // 稍微放大，比例更像截图
        height: 44,
      
        overflow: 'hidden',
        border: active ? '2px solid #1677ff' : '1px solid rgba(0,0,0,.08)',
        boxShadow: active ? '0 0 0 4px rgba(22,119,255,.15)' : '0 2px 8px rgba(0,0,0,.06)',
        background: '#fff',
        padding: 0,
        cursor: 'pointer',
      }}
    >
      <div style={{ width: '100%', height: '100%' }}>{children}</div>
    </button>
  )
}

/** 小方块预览（按截图重绘） */
function Preview({ mode }: { mode: 'side' | 'top' | 'mix' }) {
  const DARK = '#19243A' // 顶部深色条 & 侧栏深色
  const BG = '#EEF1F5' // 内容灰背景
  const HEADER_H = 12 // 顶部条高度
  const CONTENT_TOOLBAR_H = 8 // side 模式右侧顶栏（白色条）高度
  const SIDEBAR_W = 12 // 左侧栏宽度（在小缩略里刚好）

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: BG }}>
      {/* side：左深色侧栏 + 右侧顶部白条 */}
      {mode === 'side' && (
        <>
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: SIDEBAR_W,
              background: DARK,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: SIDEBAR_W,
              right: 0,
              top: 0,
              height: CONTENT_TOOLBAR_H,
              background: '#fff',
              boxShadow: 'inset 0 -1px 0 rgba(0,0,0,.12)', // 细分隔线
            }}
          />
        </>
      )}

      {/* top：整宽顶部深色条 */}
      {mode === 'top' && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: HEADER_H,
            background: DARK,
          }}
        />
      )}

      {/* mix：整宽顶部深色条 + 下方左侧浅色栏（带分隔线） */}
      {mode === 'mix' && (
        <>
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height: HEADER_H,
              background: DARK,
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: HEADER_H,
              bottom: 0,
              width: SIDEBAR_W,
              background: '#fff',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: SIDEBAR_W,
              top: HEADER_H,
              bottom: 0,
              width: 1,
              background: 'rgba(0,0,0,.16)',
            }}
          />
        </>
      )}
    </div>
  )
}

export default function LayoutSwitchDrawer({ open, onClose }: Props) {
  const {
    mode,
    setMode,
    collapsed,
    toggleCollapsed,
    showBrand,
    setShowBrand,
    showTabs,
    setShowTabs,
    persistTabs,
    setPersistTabs,
  } = useLayout()

  const ModeItem = ({ m, title, label }: { m: 'side' | 'top' | 'mix'; title: string; label: string }) => (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 6 }}>
      <ModeCard active={mode === m} onClick={() => setMode(m)} title={title}>
        <Preview mode={m} />
      </ModeCard>
      <div style={{ fontSize: 12, color: 'rgba(0,0,0,.65)' }}>{label}</div>
    </div>
  )

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={280}
      title="系统配置"
      destroyOnHidden
      styles={{ body: { paddingBottom: 24 } }}
    >
      {/* 导航模式 */}
      <div>
        <div style={{ fontWeight: 600, marginBottom: 12 }}>导航模式</div>
        <div style={{ display: 'grid', gridAutoFlow: 'column', gap: 14, width: 'max-content' }}>
          <ModeItem m="side" title="左侧菜单" label="左侧菜单" />
          <ModeItem m="top" title="顶部菜单" label="顶部菜单" />
          <ModeItem m="mix" title="混合菜单" label="混合菜单" />
        </div>
      </div>

      <Divider />

      {/* 侧栏折叠（仅 side/mix 有意义） */}
      {mode !== 'top' && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontWeight: 600 }}>侧栏折叠</div>
            <div style={{ color: 'rgba(0,0,0,.45)', fontSize: 12 }}>控制左侧菜单的展开/收起</div>
          </div>
          <Switch checkedChildren="开启" unCheckedChildren="关闭" checked={collapsed} onChange={toggleCollapsed} />
        </div>
      )}

      {/* 显示 Logo & 项目名 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <div>
          <div style={{ fontWeight: 600 }}>显示 Logo 与项目名称</div>
          <div style={{ color: 'rgba(0,0,0,.45)', fontSize: 12 }}>Header 左侧同时显示/隐藏 Logo 与标题</div>
        </div>
        <Switch checkedChildren="开启" unCheckedChildren="关闭" checked={showBrand} onChange={setShowBrand} />
      </div>

      <Divider />

      {/* 标签页显示 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600 }}>显示标签页</div>
          <div style={{ color: 'rgba(0,0,0,.45)', fontSize: 12 }}>关闭后隐藏顶部标签栏</div>
        </div>
        <Switch checkedChildren="开启" unCheckedChildren="关闭" checked={showTabs} onChange={setShowTabs} />
      </div>

      {/* 标签页持久化 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div>
            <div style={{ fontWeight: 600 }}>标签页持久化</div>
            <div style={{ color: 'rgba(0,0,0,.45)', fontSize: 12 }}>刷新页面后是否保留已打开的标签</div>
          </div>
          <Tooltip title="关闭后不再往本地缓存标签页数据（不会影响当前会话内的标签使用）">
            <Info size={16} color="rgba(0,0,0,.45)" />
          </Tooltip>
        </div>
        <Switch checkedChildren="开启" unCheckedChildren="关闭" checked={persistTabs} onChange={setPersistTabs} />
      </div>
    </Drawer>
  )
}
