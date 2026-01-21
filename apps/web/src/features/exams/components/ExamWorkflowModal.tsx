import { App, Button, Input, Modal, Select, Space, Spin, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { examsApi } from '@/shared/api/endpoints'
import { workflowsApi, type WorkflowTemplate } from '@/shared/api/endpoints/workflows'
import { pickLatestTemplates } from '@/shared/utils/workflow'
import { usersApi } from '@/shared/api/endpoints/users'

const { Text, Title } = Typography
const { TextArea } = Input

type ExamWorkflowModalProps = {
  examId: number
  open: boolean
  onClose: () => void
  onSubmitted?: () => void
}

type WorkflowFormField = {
  key: string
  label?: string
  type?: 'text' | 'textarea' | 'select' | 'number' | 'date' | 'switch'
  placeholder?: string
  options?: Array<{ label: string; value: string | number }>
  required?: boolean
}

type FormSource = { html: string; css: string; js: string }

const collectScript = `
<script>
window.__collectFormValues = function () {
  const values = {};
  const fields = document.querySelectorAll('input, select, textarea');
  fields.forEach(el => {
    const name = el.name || el.getAttribute('name');
    if (!name) return;
    if (el.type === 'checkbox') {
      if (!values[name]) values[name] = [];
      if (el.checked) values[name].push(el.value === 'on' ? true : el.value);
      return;
    }
    if (el.type === 'radio') {
      if (el.checked) values[name] = el.value;
      return;
    }
    values[name] = el.value;
  });
  return values;
};
</script>
`

const buildSrcDoc = (source: FormSource) => {
  return `<!doctype html><html><head><meta charset="utf-8"/><style>${source.css || ''}</style></head><body>${source.html || ''}<script>${source.js || ''}</script>${collectScript}</body></html>`
}

export default function ExamWorkflowModal({ examId, open, onClose, onSubmitted }: ExamWorkflowModalProps) {
  const { message } = App.useApp()
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  const [formValues, setFormValues] = useState<Record<string, any>>({})
  const [reviewerIds, setReviewerIds] = useState<number[]>([])
  const [reviewerOptions, setReviewerOptions] = useState<Array<{ value: number; label: string }>>([])
  const [loadingReviewers, setLoadingReviewers] = useState(false)
  const [notes, setNotes] = useState('')
  const [requiredApprovals, setRequiredApprovals] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const loadTemplates = useCallback(async () => {
    setLoadingTemplates(true)
    try {
      const res = await workflowsApi.listTemplates({ entity_type: 'exam', status: 'published' })
      setTemplates(pickLatestTemplates(res.items || []))
    } catch (err: any) {
      message.error(err?.message || '加载流程模板失败')
    } finally {
      setLoadingTemplates(false)
    }
  }, [message])

  useEffect(() => {
    if (!open) return
    loadTemplates()
  }, [loadTemplates, open])

  useEffect(() => {
    if (selectedTemplateId == null) {
      setSelectedTemplate(null)
      setFormValues({})
      setReviewerIds([])
      return
    }
    setLoadingTemplate(true)
    workflowsApi
      .getTemplate(selectedTemplateId)
      .then(template => {
        setSelectedTemplate(template)
        setFormValues({})
        setReviewerIds([])
      })
      .catch(err => {
        message.error(err?.message || '加载流程详情失败')
        setSelectedTemplate(null)
      })
      .finally(() => setLoadingTemplate(false))
  }, [selectedTemplateId, message])

  useEffect(() => {
    if (!open) {
      setSelectedTemplateId(null)
      setSelectedTemplate(null)
      setFormValues({})
      setReviewerIds([])
      setNotes('')
      setRequiredApprovals('')
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    setLoadingReviewers(true)
    usersApi
      .list({ page: 1, limit: 200, role: 'teacher', status: 'active' })
      .then(res => {
        const options = (res.users || []).map(u => ({
          value: Number(u.id),
          label: u.nickname || u.username || `用户#${u.id}`,
        }))
        setReviewerOptions(options)
      })
      .catch(() => {
        setReviewerOptions([])
      })
      .finally(() => setLoadingReviewers(false))
  }, [open])

  const needsReviewerIds = useMemo(() => {
    const nodes = selectedTemplate?.definition?.nodes || []
    return nodes.some((n: any) => {
      if (n?.type !== 'approval') return false
      const from = typeof n?.approvers_from === 'string' ? n.approvers_from : ''
      const expr = typeof n?.approver_expression === 'string' ? n.approver_expression : ''
      return /reviewer_ids/i.test(from) || /reviewer_ids/i.test(expr)
    })
  }, [selectedTemplate])

  const formSchema = useMemo<WorkflowFormField[]>(() => {
    const def = selectedTemplate?.definition
    if (!def || typeof def !== 'object') return []
    const schema = (def as any).form_schema
    if (schema && Array.isArray(schema.fields)) return schema.fields
    if (Array.isArray((def as any).form)) return (def as any).form
    return []
  }, [selectedTemplate])

  const customSource = useMemo<FormSource | null>(() => {
    const def: any = selectedTemplate?.definition
    if (!def || typeof def !== 'object') return null
    const raw = def.form_source || { html: def.form_html, css: def.form_css, js: def.form_js }
    const html = typeof raw?.html === 'string' ? raw.html : ''
    const css = typeof raw?.css === 'string' ? raw.css : ''
    const js = typeof raw?.js === 'string' ? raw.js : ''
    if (!html && !css && !js) return null
    return { html, css, js }
  }, [selectedTemplate])

  const customDoc = useMemo(() => (customSource ? buildSrcDoc(customSource) : ''), [customSource])

  const handleFieldChange = (key: string, value: any) => {
    setFormValues(prev => ({
      ...prev,
      [key]: value,
    }))
  }

  const handleSubmit = async () => {
    if (!selectedTemplateId) {
      message.warning('请选择流程模板')
      return
    }
    if (needsReviewerIds && !reviewerIds.length) {
      message.warning('该模板需要指定审批人')
      return
    }
    setSubmitting(true)
    try {
      let customValues: Record<string, any> = {}
      if (customSource && iframeRef.current?.contentWindow) {
        try {
          const win = iframeRef.current.contentWindow as any
          const collected = typeof win.__collectFormValues === 'function' ? win.__collectFormValues() : {}
          if (collected && typeof collected === 'object') customValues = collected
        } catch {}
      }
      const finalValues = customSource ? customValues : formValues
      await examsApi.submitReview(examId, {
        template_id: selectedTemplateId,
        reviewer_ids: reviewerIds,
        form_values: {
          ...finalValues,
          notes: notes || undefined,
        },
        required_approvals: requiredApprovals ? Number(requiredApprovals) : undefined,
      })
      message.success('审批已发起')
      onSubmitted?.()
      onClose()
    } catch (e: any) {
      message.error(e?.message || '发起审批失败')
    } finally {
      setSubmitting(false)
    }
  }

  const renderField = (field: WorkflowFormField) => {
    const value = formValues[field.key] ?? ''
    switch (field.type) {
      case 'textarea':
        return (
          <TextArea
            value={value}
            placeholder={field.placeholder}
            autoSize
            onChange={e => handleFieldChange(field.key, e.target.value)}
          />
        )
      case 'select':
        return (
          <Select
            value={value || undefined}
            placeholder={field.placeholder}
            options={field.options}
            onChange={val => handleFieldChange(field.key, val)}
          />
        )
      case 'number':
        return (
          <Input
            type="number"
            value={value}
            placeholder={field.placeholder}
            onChange={e => handleFieldChange(field.key, e.target.value)}
          />
        )
      case 'date':
        return (
          <Input
            type="date"
            value={value}
            placeholder={field.placeholder}
            onChange={e => handleFieldChange(field.key, e.target.value)}
          />
        )
      case 'switch':
        return (
          <Select
            value={value ?? undefined}
            placeholder={field.placeholder}
            options={[
              { label: '是', value: true },
              { label: '否', value: false },
            ]}
            onChange={val => handleFieldChange(field.key, val)}
          />
        )
      default:
        return (
          <Input
            value={value}
            placeholder={field.placeholder}
            onChange={e => handleFieldChange(field.key, e.target.value)}
          />
        )
    }
  }

  return (
    <Modal
      open={open}
      title="发起审批流程"
      width={640}
      onCancel={onClose}
      onOk={handleSubmit}
      okButtonProps={{ loading: submitting }}
      cancelButtonProps={{ disabled: submitting }}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Text strong>流程模板</Text>
          <div style={{ marginTop: 8 }}>
            <Select
              style={{ width: '100%' }}
              placeholder="选择已经发布的流程模板"
              value={selectedTemplateId ?? undefined}
              onChange={id => setSelectedTemplateId(id)}
              loading={loadingTemplates}
              options={templates.map(t => ({
                value: t.id,
                label: `${t.name}（版本 ${t.version}）`,
              }))}
              showSearch
              filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
            />
          </div>
          {loadingTemplate && (
            <div style={{ marginTop: 12 }}>
              <Spin size="small" />
            </div>
          )}
          {selectedTemplate && (
            <div style={{ marginTop: 12 }}>
              <Text type="secondary">
                {selectedTemplate.definition?.summary ?? selectedTemplate.definition?.description ?? '该模板会在后台发起审批流程'}
              </Text>
            </div>
          )}
        </div>

        {selectedTemplate && customSource ? (
          <div>
            <Title level={5} style={{ marginBottom: 12 }}>
              审批表单
            </Title>
            <iframe
              ref={iframeRef}
              title="custom-form"
              sandbox="allow-scripts allow-same-origin allow-forms"
              srcDoc={customDoc}
              style={{ width: '100%', height: 360, border: '1px solid #e5e7eb', borderRadius: 6 }}
            />
          </div>
        ) : (
          selectedTemplate &&
          formSchema.length > 0 && (
            <div>
              <Title level={5} style={{ marginBottom: 12 }}>
                审批表单
              </Title>
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {formSchema.map(field => (
                  <div key={field.key}>
                    <Text>{field.label || field.key}</Text>
                    <div style={{ marginTop: 4 }}>{renderField(field)}</div>
                  </div>
                ))}
              </Space>
            </div>
          )
        )}

        <div>
          <Text strong>审批参数</Text>
          <Space direction="vertical" size="small" style={{ width: '100%', marginTop: 8 }}>
            {needsReviewerIds && (
              <Select
                mode="multiple"
                allowClear
                placeholder="选择审批人"
                value={reviewerIds}
                onChange={vals => setReviewerIds(vals as number[])}
                options={reviewerOptions}
                loading={loadingReviewers}
                showSearch
                filterOption={(input, option) => String(option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                dropdownMatchSelectWidth={false}
                dropdownStyle={{ minWidth: 420 }}
                style={{ width: '100%' }}
                maxTagCount="responsive"
              />
            )}
            <Input
              placeholder="需要的提交审批人数（可选）"
              value={requiredApprovals}
              onChange={e => setRequiredApprovals(e.target.value)}
            />
            <TextArea
              placeholder="填写审批说明或补充信息"
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </Space>
        </div>
      </Space>
    </Modal>
  )
}
