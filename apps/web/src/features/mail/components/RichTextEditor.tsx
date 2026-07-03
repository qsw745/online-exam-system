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
import { htmlFromPlainText, sanitizeHtml } from '@/shared/utils/sanitizeHtml'
import { useLanguage } from '@/shared/contexts/LanguageContext'

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
  const { t } = useLanguage()
  const editorRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const selectionRef = useRef<Range | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    if (!editorRef.current) return
    const next = sanitizeHtml(value || '')
    if (value !== undefined && next !== editorRef.current.innerHTML) {
      editorRef.current.innerHTML = next
    }
  }, [value])

  const emitChange = () => {
    if (!editorRef.current) return
    onChange?.(sanitizeHtml(editorRef.current.innerHTML))
  }

  const exec = (command: string, arg?: string) => {
    try {
      document.execCommand(command, false, arg)
      emitChange()
    } catch {
      // ignore execCommand failures
    }
  }

  const handleInput = () => {
    emitChange()
  }

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const html = e.clipboardData.getData('text/html')
    const text = e.clipboardData.getData('text/plain')
    exec('insertHTML', sanitizeHtml(html || htmlFromPlainText(text)))
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

  const paragraphFormats = [
    { key: 'body', label: t('richTextEditor.format.body'), block: '<p>' },
    { key: 'heading1', label: t('richTextEditor.format.heading1'), block: '<h1>' },
    { key: 'heading2', label: t('richTextEditor.format.heading2'), block: '<h2>' },
    { key: 'quote', label: t('richTextEditor.format.quote'), block: '<blockquote>' },
  ]

  useEffect(() => {
    const listener = () => setContextMenu(null)
    document.addEventListener('click', listener)
    return () => document.removeEventListener('click', listener)
  }, [])

  return (
    <div className="rich-text-editor" ref={wrapperRef} onContextMenu={handleContextMenu} style={{ position: 'relative' }}>
      <Space style={{ flexWrap: 'wrap', marginBottom: 8 }}>
        <Tooltip title={t('richTextEditor.undo')}>
          <Button icon={<UndoOutlined />} size="small" onClick={() => exec('undo')} />
        </Tooltip>
        <Tooltip title={t('richTextEditor.redo')}>
          <Button icon={<RedoOutlined />} size="small" onClick={() => exec('redo')} />
        </Tooltip>
        <Select
          size="small"
          style={{ width: 90 }}
          placeholder={t('richTextEditor.font_size')}
          onSelect={(value: string) => handleFontSizeSelect(value)}
          options={Object.keys(FONT_SIZES).map(size => ({ value: size, label: size }))}
        />
        <Select
          size="small"
          style={{ width: 130 }}
          placeholder={t('richTextEditor.font_family')}
          onSelect={(value: string) => handleFontFamilySelect(value)}
          options={FONT_FAMILIES.map(font => ({ value: font, label: font }))}
        />
        <Tooltip title={t('richTextEditor.bold')}>
          <Button icon={<BoldOutlined />} size="small" onClick={() => exec('bold')} />
        </Tooltip>
        <Tooltip title={t('richTextEditor.italic')}>
          <Button icon={<ItalicOutlined />} size="small" onClick={() => exec('italic')} />
        </Tooltip>
        <Tooltip title={t('richTextEditor.underline')}>
          <Button icon={<UnderlineOutlined />} size="small" onClick={() => exec('underline')} />
        </Tooltip>
        <Tooltip title={t('richTextEditor.strikethrough')}>
          <Button icon={<StrikethroughOutlined />} size="small" onClick={() => exec('strikeThrough')} />
        </Tooltip>
        <Tooltip title={t('richTextEditor.text_color')}>
          <Input
            type="color"
            size="small"
            onChange={e => exec('foreColor', e.target.value)}
            style={{ width: 40, padding: 0, border: 'none', background: 'transparent' }}
          />
        </Tooltip>
        <Tooltip title={t('richTextEditor.background_color')}>
          <Input
            type="color"
            size="small"
            onChange={e => exec('backColor', e.target.value)}
            style={{ width: 40, padding: 0, border: 'none', background: 'transparent' }}
          />
        </Tooltip>
        <Tooltip title={t('richTextEditor.ordered_list')}>
          <Button icon={<OrderedListOutlined />} size="small" onClick={() => exec('insertOrderedList')} />
        </Tooltip>
        <Tooltip title={t('richTextEditor.unordered_list')}>
          <Button icon={<UnorderedListOutlined />} size="small" onClick={() => exec('insertUnorderedList')} />
        </Tooltip>
        <Tooltip title={t('richTextEditor.align_left')}>
          <Button icon={<AlignLeftOutlined />} size="small" onClick={() => exec('justifyLeft')} />
        </Tooltip>
        <Tooltip title={t('richTextEditor.align_center')}>
          <Button icon={<AlignCenterOutlined />} size="small" onClick={() => exec('justifyCenter')} />
        </Tooltip>
        <Tooltip title={t('richTextEditor.align_right')}>
          <Button icon={<AlignRightOutlined />} size="small" onClick={() => exec('justifyRight')} />
        </Tooltip>
        <Tooltip title={t('richTextEditor.align_justify')}>
          <Button size="small" onClick={() => exec('justifyFull')}>
            {t('richTextEditor.align_justify_short')}
          </Button>
        </Tooltip>
        <Tooltip title={t('richTextEditor.increase_indent')}>
          <Button size="small" onClick={() => exec('indent')}>
            {t('richTextEditor.increase_indent_short')}
          </Button>
        </Tooltip>
        <Tooltip title={t('richTextEditor.decrease_indent')}>
          <Button size="small" onClick={() => exec('outdent')}>
            {t('richTextEditor.decrease_indent_short')}
          </Button>
        </Tooltip>
        <Tooltip title={t('richTextEditor.clear_format')}>
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
        onPaste={handlePaste}
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
              {t('richTextEditor.select_all')}
            </Button>
          </div>
          <div className="context-item" onMouseDown={e => e.preventDefault()}>
            <Button type="text" size="small" onClick={clearDocument}>
              {t('richTextEditor.clear_document')}
            </Button>
          </div>
          <div className="context-item" style={{ padding: '2px 8px', fontSize: 12, color: '#999' }}>
            {t('richTextEditor.paragraph_format')}
          </div>
          {paragraphFormats.map(item => (
            <div className="context-item" key={item.key} onMouseDown={e => e.preventDefault()}>
              <Button
                type="text"
                size="small"
                onClick={() => {
                  exec('formatBlock', item.block)
                  hideContextMenu()
                }}
              >
                {item.label}
              </Button>
            </div>
          ))}
          <div className="context-item" style={{ padding: '2px 8px', fontSize: 12, color: '#999' }}>
            {t('richTextEditor.table')}
          </div>
          {[2, 3].map(size => (
            <div className="context-item" key={size} onMouseDown={e => e.preventDefault()}>
              <Button type="text" size="small" onClick={() => insertTable(size, size)}>
                {t('richTextEditor.insert_table').replace(/\{size\}/g, String(size))}
              </Button>
            </div>
          ))}
          <div className="context-item" onMouseDown={e => e.preventDefault()}>
            <Button type="text" size="small" onClick={() => insertParagraph('before')}>
              {t('richTextEditor.insert_paragraph_before')}
            </Button>
          </div>
          <div className="context-item" onMouseDown={e => e.preventDefault()}>
            <Button type="text" size="small" onClick={() => insertParagraph('after')}>
              {t('richTextEditor.insert_paragraph_after')}
            </Button>
          </div>
          <div className="context-item" onMouseDown={e => e.preventDefault()}>
            <Button type="text" size="small" onClick={() => { exec('copy'); hideContextMenu() }}>
              {t('richTextEditor.copy')}
            </Button>
          </div>
          <div className="context-item" onMouseDown={e => e.preventDefault()}>
            <Button type="text" size="small" onClick={() => { exec('paste'); hideContextMenu() }}>
              {t('richTextEditor.paste')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
