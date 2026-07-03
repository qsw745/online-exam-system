import { App, Input, Modal, Select, Space, Spin, Typography } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { papersApi } from '@/shared/api/endpoints/papers'
import { workflowsApi, type WorkflowTemplate } from '@/shared/api/endpoints/workflows'
import { pickLatestTemplates } from '@/shared/utils/workflow'
import { usersApi } from '@/shared/api/endpoints/users'
import { useLanguage } from '@/shared/contexts/LanguageContext'

const { Text, Title } = Typography
const { TextArea } = Input

type PaperWorkflowModalProps = {
  paperId: number
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

export default function PaperWorkflowModal({ paperId, open, onClose, onSubmitted }: PaperWorkflowModalProps) {
  const { t } = useLanguage()
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
      const res = await workflowsApi.listTemplates({ entity_type: 'paper', status: 'published' })
      setTemplates(pickLatestTemplates(res.items || []))
    } catch (err: any) {
      message.error(err?.message || t('papers.wf_load_tpl_failed'))
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
        message.error(err?.message || t('papers.wf_load_detail_failed'))
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
          label: u.nickname || u.username || t('common.user_n').replace('{n}', String(u.id)),
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
      message.warning(t('papers.wf_select_tpl_warn'))
      return
    }
    if (needsReviewerIds && !reviewerIds.length) {
      message.warning(t('papers.wf_need_approver'))
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
      await papersApi.submitReview(paperId, {
        template_id: selectedTemplateId,
        reviewer_ids: reviewerIds,
        form_values: {
          ...finalValues,
          notes: notes || undefined,
        },
        required_approvals: requiredApprovals ? Number(requiredApprovals) : undefined,
      })
      message.success(t('papers.wf_started'))
      onSubmitted?.()
      onClose()
    } catch (e: any) {
      message.error(e?.message || t('papers.wf_start_failed'))
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
              { label: t('common.yes'), value: true },
              { label: t('common.no'), value: false },
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
      title={t('papers.wf_title')}
      width={640}
      onCancel={onClose}
      onOk={handleSubmit}
      okButtonProps={{ loading: submitting }}
      cancelButtonProps={{ disabled: submitting }}
    >
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Text strong>{t('papers.wf_template')}</Text>
          <div style={{ marginTop: 8 }}>
            <Select
              style={{ width: '100%' }}
              placeholder={t('papers.wf_select_tpl_ph')}
              value={selectedTemplateId ?? undefined}
              onChange={id => setSelectedTemplateId(id)}
              loading={loadingTemplates}
              options={templates.map(tpl => ({
                value: tpl.id,
                label: t('papers.wf_tpl_option').replace('{name}', tpl.name).replace('{ver}', String(tpl.version)),
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
                {selectedTemplate.definition?.summary ?? selectedTemplate.definition?.description ?? t('papers.wf_default_summary')}
              </Text>
            </div>
          )}
        </div>

        {selectedTemplate && customSource ? (
          <div>
            <Title level={5} style={{ marginBottom: 12 }}>
              {t('papers.wf_form')}
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
                {t('papers.wf_form')}
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
          <Text strong>{t('papers.wf_params')}</Text>
          <Space direction="vertical" size="small" style={{ width: '100%', marginTop: 8 }}>
            {needsReviewerIds && (
              <Select
                mode="multiple"
                allowClear
                placeholder={t('papers.wf_approver_ph')}
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
              placeholder={t('papers.wf_required_count_ph')}
              value={requiredApprovals}
              onChange={e => setRequiredApprovals(e.target.value)}
            />
            <TextArea
              placeholder={t('papers.wf_comment_ph')}
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
