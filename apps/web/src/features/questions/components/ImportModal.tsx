import React, { useMemo, useState } from 'react'
import { Alert, Modal, Radio, Table, Upload, message, Progress, Space, Typography, Divider, Checkbox } from 'antd'
import type { UploadProps } from 'antd'
import { InboxOutlined } from '@ant-design/icons'
import { parseFile, buildExportHeaders, ensureArrayFromMaybeCsv } from '@/shared/utils/fileParser'
import { api, isSuccess } from '@/shared/api/http'
import { compactObject, getMsg } from '@/shared/utils/q-helpers'

const { Dragger } = Upload
const { Text } = Typography

type Row = any

export default function ImportModal({
  open,
  onClose,
  onImported,
  reloadTags,
}: {
  open: boolean
  onClose: () => void
  onImported: () => void
  reloadTags: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<{ rows: Row[]; errors: string[]; total: number }>({
    rows: [],
    errors: [],
    total: 0,
  })
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [mode, setMode] = useState<'insert' | 'upsert'>('upsert')
  const [dedupe, setDedupe] = useState(true)

  const columns = useMemo(
    () =>
      buildExportHeaders().map(h => ({
        title: h.label,
        dataIndex: h.key,
        width: h.key.startsWith('option_') ? 140 : undefined,
        ellipsis: true,
      })),
    []
  )

  const props: UploadProps = {
    multiple: false,
    accept: '.xlsx,.xls,.csv',
    beforeUpload: () => false,
    onRemove: () => {
      setFile(null)
      setParsed({ rows: [], errors: [], total: 0 })
    },
    onChange(info) {
      const f = info.file as any
      if (f?.originFileObj) {
        setFile(f.originFileObj as File)
      }
    },
  }

  const doParse = async () => {
    if (!file) return message.error('请先选择文件')
    setLoading(true)
    setProgress(20)
    try {
      const r = await parseFile(file)
      setProgress(60)
      if (!r.success) throw new Error((r.errors || []).join('\n') || '文件解析失败')
      setParsed({ rows: r.data || [], errors: r.errors || [], total: r.total || (r.data || []).length })
      message.success(`解析完成：共 ${r.total} 行，预览 ${Math.min(50, r.data?.length || 0)} 行`)
      setProgress(80)
    } catch (e: any) {
      message.error(e?.message || '文件解析失败')
    } finally {
      setLoading(false)
      setProgress(0)
    }
  }

  const startImport = async () => {
    if (!parsed.rows.length) return message.error('没有可导入的数据，请先解析文件')
    setLoading(true)
    setProgress(10)
    try {
      // 客户端去重：按 content + question_type + options 正规化
      let rows = parsed.rows
      if (dedupe) {
        const seen = new Set<string>()
        rows = rows.filter((q: any) => {
          const key = JSON.stringify({
            c: String(q.content || '').trim(),
            t: q.question_type,
            opts: Array.isArray(q.options)
              ? q.options.map((o: any) => [String(o.content || '').trim(), !!o.is_correct])
              : [],
          })
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
      }

      setProgress(40)
      // 组装 payload（仅保留有效字段）
      const payload = rows.map((q: any, idx: number) =>
        compactObject({
          title: q.title || `题目${idx + 1}`,
          content: q.content,
          question_type: q.question_type,
          difficulty: q.difficulty || 'medium',
          options: q.options,
          correct_answer: q.correct_answer ?? q.answer ?? '',
          knowledge_points: ensureArrayFromMaybeCsv(q.knowledge_points),
          tags: ensureArrayFromMaybeCsv(q.tags),
          explanation: q.explanation || '',
          score: Number.isFinite(+q.score) ? +q.score : 1,
        })
      )

      setProgress(60)
      const res: any = await api.post('/questions/bulk-import', payload, { params: { upsert: mode === 'upsert' } })
      setProgress(90)
      if (!isSuccess(res)) {
        return message.error(getMsg(res, '批量导入失败'))
      }
      const ok = Number(res.data?.success_count ?? res.data?.success ?? 0)
      const fail = Number(res.data?.fail_count ?? res.data?.failed ?? 0)
      message.success(`导入完成：成功 ${ok} 条${fail ? `，失败 ${fail} 条` : ''}`)
      onImported()
      reloadTags()
    } catch (e: any) {
      message.error(e?.message || '批量导入失败')
    } finally {
      setLoading(false)
      setProgress(0)
      setFile(null)
      setParsed({ rows: [], errors: [], total: 0 })
    }
  }

  return (
    <Modal
      title="批量导入题目"
      open={open}
      onCancel={onClose}
      onOk={startImport}
      okText={loading ? (progress ? `导入中… ${Math.round(progress)}%` : '导入中…') : '开始导入'}
      confirmLoading={loading}
      width={980}
      destroyOnHidden
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Dragger {...props} disabled={loading}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">点击或拖拽文件到此处上传（支持 .xlsx / .xls / .csv）</p>
          <p className="ant-upload-hint">
            建议使用提供的模板，表头会自动识别（题目内容、类型、选项A~F、正确答案、标签、知识点、解析、难度、分值）
          </p>
        </Dragger>

        <Space align="center" wrap>
          <Radio.Group value={mode} onChange={e => setMode(e.target.value)} disabled={loading}>
            <Radio.Button value="insert">仅新增</Radio.Button>
            <Radio.Button value="upsert">存在则更新（根据内容/类型）</Radio.Button>
          </Radio.Group>
          <Checkbox checked={dedupe} onChange={e => setDedupe(e.target.checked)} disabled={loading}>
            导入前去重
          </Checkbox>
          <a
            onClick={async () => {
              // 生成下载模板（只含表头）
              const { exportToXlsx } = await import('@/shared/utils/q-helpers')
              const headers = buildExportHeaders()
              await exportToXlsx([{ content: '', question_type: 'single_choice' }], '题目导入模板.xlsx', headers)
            }}
          >
            下载导入模板
          </a>
          <a onClick={doParse}>解析文件预览</a>
          {loading && <Progress percent={Math.round(progress)} style={{ width: 200 }} />}
        </Space>

        {parsed.errors.length > 0 && (
          <Alert
            type="warning"
            message="解析警告"
            description={
              <div style={{ maxHeight: 150, overflow: 'auto' }}>
                {parsed.errors.map((e, i) => (
                  <div key={i}>
                    <Text type="warning">{e}</Text>
                  </div>
                ))}
              </div>
            }
            showIcon
          />
        )}

        <Divider style={{ margin: '8px 0' }} />
        <Text type="secondary">
          预览前 {Math.min(50, parsed.rows.length)} / 共 {parsed.total} 行
        </Text>
        <Table
          size="small"
          rowKey={(_, i) => String(i)}
          dataSource={parsed.rows.slice(0, 50)}
          columns={columns as any}
          pagination={false}
          scroll={{ x: true, y: 260 }}
        />
      </Space>
    </Modal>
  )
}
