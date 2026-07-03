import type { UploadFile } from 'antd'
import { useMemo, useState } from 'react'

import { api, isSuccess } from '@/shared/api/http'
import { ensureArrayFromMaybeCsv, parseFile } from '@/shared/utils/fileParser'
import { buildExportHeaders, compactObject, exportToXlsx, getMsg } from '@/shared/utils/q-helpers'
import { DownloadOutlined, InboxOutlined } from '@ant-design/icons'
import type { UploadProps } from 'antd'
import { Alert, App, Button, Checkbox, Divider, Modal, Progress, Radio, Space, Table, Typography, Upload } from 'antd'
import { useLanguage } from '@/shared/contexts/LanguageContext'

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
  const { message } = App.useApp()
  const { t } = useLanguage()
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

  // 受控文件列表 + 强制重挂载 key（为了解决同名文件不触发 onChange 的问题）
  const [fileList, setFileList] = useState<UploadFile<any>[]>([])
  const [uploadKey, setUploadKey] = useState(0)
  const resetUploader = () => {
    setFile(null)
    setFileList([])
    setUploadKey(k => k + 1)
  }

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
    accept: '.xlsx,.csv',
    fileList,
    beforeUpload: f => {
      setFileList([f])
      const raw = (f as any).originFileObj ?? (f as unknown as File)
      setFile(raw)
      return false
    },
    onChange(info) {
      const latestList = info.fileList.slice(-1)
      setFileList(latestList)
      const latest = latestList[0]
      const raw = (latest as any)?.originFileObj ?? (latest as unknown as File)
      setFile(raw ?? null)
    },
    onRemove: () => {
      resetUploader()
      // 清空预览
      setParsed({ rows: [], errors: [], total: 0 })
      return true
    },
  }

  const doParse = async () => {
    if (!file) return message.error(t('questions.select_file_first'))
    setLoading(true)
    setProgress(20)
    try {
      const r = await parseFile(file)
      setProgress(60)
      if (!r.success) throw new Error((r.errors || []).join('\n') || t('questions.parse_failed'))

      // 预览前 50 行，并给每行稳定的 _idx 作为 rowKey
      const rows = (r.data || []).map((x, i) => ({ _idx: i, ...x }))
      setParsed({ rows, errors: r.errors || [], total: r.total ?? rows.length })
      message.success(t('questions.parse_done').replace('{total}', String(r.total ?? rows.length)).replace('{preview}', String(Math.min(50, rows.length))))
      setProgress(80)
    } catch (e: any) {
      message.error(e?.message || t('questions.parse_failed'))
    } finally {
      setLoading(false)
      setProgress(0)
      // ✅ 只重置上传控件，**不要清空 parsed**，否则预览会消失
      resetUploader()
      // ❌ 千万不要在这里 setParsed({ rows: [], ... })
    }
  }

  const startImport = async () => {
    if (!parsed.rows.length) return message.error(t('questions.no_import_data'))
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
          title: q.title || t('questions.item_n').replace('{n}', String(idx + 1)),
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
      //   const res: any = await api.post('/questions/bulk-import', payload, { params: { upsert: mode === 'upsert' } })
      // ✅ 修复点：后端期望 { questions: [...] }，不是数组本体
      const res: any = await api.post(
        '/questions/bulk-import',
        { questions: payload },
        { params: { upsert: mode === 'upsert' } }
      )
      setProgress(90)
      if (!isSuccess(res)) return message.error(getMsg(res, t('questions.import_failed')))

      const ok = Number(res.data?.success_count ?? res.data?.success ?? 0)
      const fail = Number(res.data?.fail_count ?? res.data?.failed ?? 0)
      message.success(t('questions.import_done').replace('{ok}', String(ok)).replace('{failPart}', fail ? t('questions.import_fail_part').replace('{fail}', String(fail)) : ''))

      // 通知父组件刷新列表/标签，然后关闭弹窗
      onImported?.()
      reloadTags?.()
      onClose?.()

      // 清空本地状态
      setFile(null)
      setParsed({ rows: [], errors: [], total: 0 })
      resetUploader()
    } catch (e: any) {
      message.error(e?.message || t('questions.import_failed'))
    } finally {
      setLoading(false)
      setProgress(0)
    }
  }

  return (
    <Modal
      title={t('questions.import_title')}
      open={open}
      maskClosable={false}
      onCancel={onClose}
      onOk={startImport}
      okText={loading ? (progress ? t('questions.importing_pct').replace('{pct}', String(Math.round(progress))) : t('questions.importing')) : t('questions.import_start')}
      confirmLoading={loading}
      width={980}
      destroyOnHidden
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Dragger key={uploadKey} {...props} disabled={loading}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">{t('questions.upload_hint')}</p>
          <p className="ant-upload-hint">
            {t('questions.template_hint')}
          </p>
        </Dragger>

        <Space align="center" wrap>
          <Radio.Group value={mode} onChange={e => setMode(e.target.value)} disabled={loading}>
            <Radio.Button value="insert">{t('questions.mode_insert')}</Radio.Button>
            <Radio.Button value="upsert">{t('questions.mode_upsert')}</Radio.Button>
          </Radio.Group>

          <Checkbox checked={dedupe} onChange={e => setDedupe(e.target.checked)} disabled={loading}>
            {t('questions.dedup_before_import')}
          </Checkbox>

          <Button
            type="link"
            icon={<DownloadOutlined />}
            onClick={async () => {
              const headers = buildExportHeaders()
              await exportToXlsx([{ content: '', question_type: 'single_choice' }], t('questions.template_filename'), headers)
            }}
          >
            {t('questions.download_template')}
          </Button>

          <Button type="link" onClick={doParse} disabled={!file}>
            {t('questions.parse_preview')}
          </Button>

          {loading && <Progress percent={Math.round(progress)} style={{ width: 200 }} />}
        </Space>

        {parsed.errors.length > 0 && (
          <Alert
            type="warning"
            message={t('questions.parse_warning')}
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
          {t('questions.preview_rows').replace('{shown}', String(Math.min(50, parsed.rows.length))).replace('{total}', String(parsed.total))}
        </Text>
        <Table
          size="small"
          rowKey="_idx"
          dataSource={parsed.rows.slice(0, 50)}
          columns={columns as any}
          pagination={false}
          scroll={{ x: true, y: 260 }}
        />
      </Space>
    </Modal>
  )
}
