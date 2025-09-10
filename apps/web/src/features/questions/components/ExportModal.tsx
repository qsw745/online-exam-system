import React, { useMemo, useState } from 'react'
import { Modal, Radio, Space, message, Select } from 'antd'
import { exportToCsv, exportToXlsx, buildRowsForExport, buildExportHeaders } from '@/shared/utils/q-helpers'

export default function ExportModal({
  open,
  onClose,
  itemsOnPage,
  selectedIds,
  total,
  pageSize,
  fetchPage,
}: {
  open: boolean
  onClose: () => void
  itemsOnPage: any[]
  selectedIds: string[]
  total: number
  pageSize: number
  fetchPage: (page: number, limit: number) => Promise<{ items: any[]; total: number }>
}) {
  const [scope, setScope] = useState<'selected' | 'page' | 'all'>(selectedIds.length ? 'selected' : 'page')
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx')
  const headers = useMemo(() => buildExportHeaders(), [])

  const doExport = async () => {
    try {
      let data: any[] = []
      if (scope === 'selected' && selectedIds.length) {
        const set = new Set(selectedIds)
        data = itemsOnPage.filter(x => set.has(String(x.id)))
      } else if (scope === 'page') {
        data = itemsOnPage
      } else {
        // all：循环分页取数（按当前筛选参数，父组件已封装在 fetchPage）
        let page = 1
        let acc: any[] = []
        // 至多导出 50 页防止意外（可按需调大）
        for (let i = 0; i < 50; i++) {
          const r = await fetchPage(page, pageSize)
          acc = acc.concat(r.items || [])
          if (acc.length >= (r.total || 0)) break
          page++
        }
        data = acc
      }

      if (!data.length) return message.info('没有可导出的数据')

      const rows = buildRowsForExport(data)
      const filename = `题目导出_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${format}`
      if (format === 'xlsx') await exportToXlsx(rows, filename, headers)
      else await exportToCsv(rows, filename, headers)
      onClose()
    } catch (e: any) {
      message.error(e?.message || '导出失败')
    }
  }

  return (
    <Modal title="批量导出" open={open} onCancel={onClose} onOk={doExport} okText="导出" destroyOnHidden>
      <Space direction="vertical" size="middle">
        <div>
          导出范围：
          <Radio.Group value={scope} onChange={e => setScope(e.target.value)} optionType="button" buttonStyle="solid">
            <Radio.Button value="selected" disabled={!selectedIds.length}>
              选中（{selectedIds.length}）
            </Radio.Button>
            <Radio.Button value="page">当前页（{itemsOnPage.length}）</Radio.Button>
            <Radio.Button value="all">全部（约 {total} ）</Radio.Button>
          </Radio.Group>
        </div>
        <div>
          导出格式：
          <Select
            value={format}
            onChange={v => setFormat(v)}
            options={[
              { label: 'Excel（.xlsx）', value: 'xlsx' },
              { label: 'CSV（.csv）', value: 'csv' },
            ]}
            style={{ width: 180 }}
          />
        </div>
      </Space>
    </Modal>
  )
}
