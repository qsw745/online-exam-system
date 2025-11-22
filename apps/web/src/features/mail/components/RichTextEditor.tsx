import {
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  AlignLeftOutlined,
  AlignCenterOutlined,
  AlignRightOutlined,
  RedoOutlined,
  UndoOutlined,
  StrikethroughOutlined,
  ClearOutlined,
} from '@ant-design/icons'
import { Button, Input, Select, Space, Tooltip } from 'antd'
import { useEffect, useRef, useState } from 'react'

type Props = {
  value?: string
  onChange?: (value: string) => void
}

const FONT_SIZES: Record<string, string> = {
  '12px': '2',
  '14px': '3',
  '16px': '4',
  '18px': '5',
  '24px': '6',
  '32px': '7',
}

const FONT_FAMILIES = ['宋体', '微软雅黑', '黑体', 'Arial', 'Tahoma', 'Times New Roman']

export default function RichTextEditor({ value, onChange }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const selectionRef = useRef<Range | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!editorRef.current) return
    if (value !== undefined && value !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = value || ''
    }
  }, [value])

  const exec = (command: string, arg?: string) => {
    try {
      document.execCommand(command, false, arg)
      if (editorRef.current) onChange?.(editorRef.current.innerHTML)
    } catch {
      // ignore execCommand failures
    }
  }

  const handleInput = () => {
    if (editorRef.current) onChange?.(editorRef.current.innerHTML)
  }

  const handleFontSizeSelect = (label: string) => {
    const preset = FONT_SIZES[label]
    if (preset) exec('fontSize', preset)
  }

  const handleFontFamilySelect = (family: string) => {
    exec('fontName', family)
  }

  const clearDocument = () => {
    if (!editorRef.current) return
    editorRef.current.innerHTML = ''
    onChange?.('')
    hideContextMenu()
  }

  const restoreSelection = () => {
    const range = selectionRef.current
    if (!range) return
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }

  const insertParagraph = (position: 'before' | 'after') => {
    restoreSelection()
    const range = selectionRef.current
    if (!range || !editorRef.current) return
    let node: Node | null = range.startContainer
    if (node.nodeType === Node.TEXT_NODE) node = node.parentNode
    while (node && node !== editorRef.current && !(node instanceof HTMLElement && /^(P|DIV|LI|H[1-6])$/.test(node.tagName))) {
      node = node.parentNode
    }
    const target = node instanceof HTMLElement ? node : editorRef.current
    const para = document.createElement('p')
    para.innerHTML = '<br />'
    if (position === 'before') {
      target.parentNode?.insertBefore(para, target)
    } else {
      target.parentNode?.insertBefore(para, target.nextSibling)
    }
    const sel = window.getSelection()
    if (sel) {
      const newRange = document.createRange()
      newRange.selectNodeContents(para)
      newRange.collapse(true)
      sel.removeAllRanges()
      sel.addRange(newRange)
      selectionRef.current = newRange
    }
    handleInput()
    hideContextMenu()
  }

  const insertTable = (rows: number, cols: number) => {
    restoreSelection()
    const html = `<table style="width:100%;border-collapse:collapse;" border="1">${Array.from({ length: rows })
      .map(() => `<tr>${Array.from({ length: cols }).map(() => '<td style="padding:4px;">&nbsp;</td>').join('')}</tr>`)
      .join('')}</table><p><br /></p>`
    exec('insertHTML', html)
    hideContextMenu()
  }

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) selectionRef.current = sel.getRangeAt(0)
    const rect = wrapperRef.current?.getBoundingClientRect()
    const x = rect ? e.clientX - rect.left : e.clientX
    const y = rect ? e.clientY - rect.top : e.clientY
    setContextMenu({ x, y })
  }

  const hideContextMenu = () => setContextMenu(null)

  useEffect(() => {
    const listener = () => setContextMenu(null)
    document.addEventListener('click', listener)
    return () => document.removeEventListener('click', listener)
  }, [])

  return (
    <div className="rich-text-editor" ref={wrapperRef} onContextMenu={handleContextMenu} style={{ position: 'relative' }}>
      <Space style={{ flexWrap: 'wrap', marginBottom: 8 }}>
        <Tooltip title="撤销">
          <Button icon={<UndoOutlined />} size="small" onClick={() => exec('undo')} />
        </Tooltip>
        <Tooltip title="重做">
          <Button icon={<RedoOutlined />} size="small" onClick={() => exec('redo')} />
        </Tooltip>
        <Select
          size="small"
          style={{ width: 90 }}
          placeholder="字号"
          onSelect={(value: string) => handleFontSizeSelect(value)}
          options={Object.keys(FONT_SIZES).map(size => ({ value: size, label: size }))}
        />
        <Select
          size="small"
          style={{ width: 130 }}
          placeholder="字体"
          onSelect={(value: string) => handleFontFamilySelect(value)}
          options={FONT_FAMILIES.map(font => ({ value: font, label: font }))}
        />
        <Tooltip title="加粗">
          <Button icon={<BoldOutlined />} size="small" onClick={() => exec('bold')} />
        </Tooltip>
        <Tooltip title="斜体">
          <Button icon={<ItalicOutlined />} size="small" onClick={() => exec('italic')} />
        </Tooltip>
        <Tooltip title="下划线">
          <Button icon={<UnderlineOutlined />} size="small" onClick={() => exec('underline')} />
        </Tooltip>
        <Tooltip title="删除线">
          <Button icon={<StrikethroughOutlined />} size="small" onClick={() => exec('strikeThrough')} />
        </Tooltip>
        <Tooltip title="字体颜色">
          <Input
            type="color"
            size="small"
            onChange={e => exec('foreColor', e.target.value)}
            style={{ width: 40, padding: 0, border: 'none', background: 'transparent' }}
          />
        </Tooltip>
        <Tooltip title="背景色">
          <Input
            type="color"
            size="small"
            onChange={e => exec('backColor', e.target.value)}
            style={{ width: 40, padding: 0, border: 'none', background: 'transparent' }}
          />
        </Tooltip>
        <Tooltip title="有序列表">
          <Button icon={<OrderedListOutlined />} size="small" onClick={() => exec('insertOrderedList')} />
        </Tooltip>
        <Tooltip title="无序列表">
          <Button icon={<UnorderedListOutlined />} size="small" onClick={() => exec('insertUnorderedList')} />
        </Tooltip>
        <Tooltip title="左对齐">
          <Button icon={<AlignLeftOutlined />} size="small" onClick={() => exec('justifyLeft')} />
        </Tooltip>
        <Tooltip title="居中">
          <Button icon={<AlignCenterOutlined />} size="small" onClick={() => exec('justifyCenter')} />
        </Tooltip>
        <Tooltip title="右对齐">
          <Button icon={<AlignRightOutlined />} size="small" onClick={() => exec('justifyRight')} />
        </Tooltip>
        <Tooltip title="两端对齐">
          <Button size="small" onClick={() => exec('justifyFull')}>
            齐
          </Button>
        </Tooltip>
        <Tooltip title="增加缩进">
          <Button size="small" onClick={() => exec('indent')}>
            增
          </Button>
        </Tooltip>
        <Tooltip title="减少缩进">
          <Button size="small" onClick={() => exec('outdent')}>
            减
          </Button>
        </Tooltip>
        <Tooltip title="清除格式">
          <Button icon={<ClearOutlined />} size="small" onClick={() => exec('removeFormat')} />
        </Tooltip>
      </Space>
      <div
        ref={editorRef}
        contentEditable
        style={{
          border: '1px solid #d9d9d9',
          borderRadius: 6,
          minHeight: 260,
          padding: 12,
          lineHeight: 1.6,
        }}
        onInput={handleInput}
      />
      {contextMenu && (
        <div
          className="rich-text-editor__context"
          style={{
            position: 'absolute',
            top: contextMenu.y,
            left: contextMenu.x,
            background: '#fff',
            border: '1px solid #e0e0e0',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            zIndex: 10,
            minWidth: 160,
            padding: 4,
          }}
          onClick={e => e.stopPropagation()}
        >
          <div className="context-item" onMouseDown={e => e.preventDefault()}>
            <Button type="text" size="small" onClick={() => { exec('selectAll'); hideContextMenu() }}>
              全选
            </Button>
          </div>
          <div className="context-item" onMouseDown={e => e.preventDefault()}>
            <Button type="text" size="small" onClick={clearDocument}>
              清空文档
            </Button>
          </div>
          <div className="context-item" style={{ padding: '2px 8px', fontSize: 12, color: '#999' }}>
            段落格式
          </div>
          {['正文', '标题1', '标题2', '引用'].map(item => (
            <div className="context-item" key={item} onMouseDown={e => e.preventDefault()}>
              <Button
                type="text"
                size="small"
                onClick={() => {
                  exec('formatBlock', item === '正文' ? '<p>' : item === '标题1' ? '<h1>' : item === '标题2' ? '<h2>' : '<blockquote>')
                  hideContextMenu()
                }}
              >
                {item}
              </Button>
            </div>
          ))}
          <div className="context-item" style={{ padding: '2px 8px', fontSize: 12, color: '#999' }}>
            表格
          </div>
          {[2, 3].map(size => (
            <div className="context-item" key={size} onMouseDown={e => e.preventDefault()}>
              <Button type="text" size="small" onClick={() => insertTable(size, size)}>
                插入{size}x{size}
              </Button>
            </div>
          ))}
          <div className="context-item" onMouseDown={e => e.preventDefault()}>
            <Button type="text" size="small" onClick={() => insertParagraph('before')}>
              前插入段落
            </Button>
          </div>
          <div className="context-item" onMouseDown={e => e.preventDefault()}>
            <Button type="text" size="small" onClick={() => insertParagraph('after')}>
              后插入段落
            </Button>
          </div>
          <div className="context-item" onMouseDown={e => e.preventDefault()}>
            <Button type="text" size="small" onClick={() => { exec('copy'); hideContextMenu() }}>
              复制 (Ctrl + C)
            </Button>
          </div>
          <div className="context-item" onMouseDown={e => e.preventDefault()}>
            <Button type="text" size="small" onClick={() => { exec('paste'); hideContextMenu() }}>
              粘贴 (Ctrl + V)
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
