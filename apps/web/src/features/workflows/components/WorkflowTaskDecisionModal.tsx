import { App, Button, Descriptions, Modal, Select, Space, Spin, Tag, Typography, Input } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { workflowsApi, type WorkflowInstanceDetail, type WorkflowTask } from '@/shared/api/endpoints/workflows'
import { usersApi } from '@/shared/api/endpoints/users'
import { workflowStatusLabel } from '@/shared/utils/workflow'
import { useAuth } from '@/shared/contexts/AuthContext'
import { RuntimeSummary } from '@/features/workflows/components/WorkflowRuntimeView'
import WorkflowProcessTable from '@/features/workflows/components/WorkflowProcessTable'
import { translate } from '@/shared/utils/i18n'

const { Text, Title } = Typography
const { TextArea } = Input

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

const buildSrcDoc = (source: FormSource, permissions: Record<string, string>, initialValues: Record<string, any>) => {
  const perms = JSON.stringify(permissions || {})
  const init = JSON.stringify(initialValues || {})
  const patchScript = `
  <script>
    const PERMS = ${perms};
    const INIT = ${init};
    const applyValues = () => {
      Object.keys(INIT || {}).forEach(name => {
        const els = document.querySelectorAll('[name="' + name + '"]');
        els.forEach(el => {
          if (el.type === 'checkbox') {
            const list = Array.isArray(INIT[name]) ? INIT[name] : [INIT[name]];
            el.checked = list.map(String).includes(String(el.value)) || (list.includes(true) && el.value === 'on');
            return;
          }
          if (el.type === 'radio') {
            el.checked = String(el.value) === String(INIT[name]);
            return;
          }
          el.value = INIT[name];
        });
      });
    };
    const applyPerms = () => {
      Object.keys(PERMS || {}).forEach(name => {
        const mode = PERMS[name];
        const els = document.querySelectorAll('[name="' + name + '"]');
        els.forEach(el => {
          const wrap = el.closest('.wf-field') || el.parentElement;
          if (mode === 'hidden') {
            if (wrap) wrap.style.display = 'none';
            else el.style.display = 'none';
          } else if (mode === 'read') {
            el.setAttribute('disabled', 'true');
            el.setAttribute('readonly', 'true');
          } else {
            el.removeAttribute('disabled');
            el.removeAttribute('readonly');
          }
        });
      });
    };
    window.addEventListener('DOMContentLoaded', () => {
      applyValues();
      applyPerms();
    });
  </script>
  `
  return `<!doctype html><html><head><meta charset="utf-8"/><style>${source.css || ''}</style></head><body>${source.html || ''}<script>${source.js || ''}</script>${collectScript}${patchScript}</body></html>`
}

const formSourceFromDefinition = (def: any): FormSource | null => {
  if (!def || typeof def !== 'object') return null
  const raw = def.form_source || { html: def.form_html, css: def.form_css, js: def.form_js }
  const html = typeof raw?.html === 'string' ? raw.html : ''
  const css = typeof raw?.css === 'string' ? raw.css : ''
  const js = typeof raw?.js === 'string' ? raw.js : ''
  if (!html && !css && !js) return null
  return { html, css, js }
}

export default function WorkflowTaskDecisionModal({
  open,
  task,
  onClose,
  onDone,
}: {
  open: boolean
  task: WorkflowTask | null
  onClose: () => void
  onDone: () => void
}) {
  const { message } = App.useApp()
  const { user } = useAuth()
  const navigate = useNavigate()
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<WorkflowInstanceDetail | null>(null)
  const [comment, setComment] = useState('')
  const [pickerMode, setPickerMode] = useState<'transfer' | 'addSign' | null>(null)
  const [pickerUser, setPickerUser] = useState<number | null>(null)
  const [userOpts, setUserOpts] = useState<Array<{ label: string; value: number }>>([])
  const [userLoading, setUserLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const fetchUsers = async (keyword?: string) => {
    setUserLoading(true)
    try {
      const data = await usersApi.list({ page: 1, limit: 20, search: keyword || undefined })
      setUserOpts(
        (data.users || []).map((u: any) => ({
          label: `${u.nickname || u.username || u.email}（${u.email || u.username || u.id}）`,
          value: Number(u.id),
        }))
      )
    } catch (e: any) {
      message.error(e?.message || translate('workflowTemplates.errors.load_users_failed'))
    } finally {
      setUserLoading(false)
    }
  }

  const openPicker = (mode: 'transfer' | 'addSign') => {
    setPickerUser(null)
    setPickerMode(mode)
    if (!userOpts.length) fetchUsers()
  }

  const confirmPicker = async () => {
    if (!task || !pickerUser || !pickerMode) return
    setSubmitting(true)
    try {
      if (pickerMode === 'transfer') await workflowsApi.transferTask(task.id, pickerUser, comment)
      else await workflowsApi.addSignTask(task.id, pickerUser, comment)
      message.success(pickerMode === 'transfer' ? translate('auto.5994ce9ae8') : translate('auto.62febbf644'))
      setPickerMode(null)
      onDone()
      onClose()
    } catch (e: any) {
      message.error(e?.message || translate('app.operation_failed'))
    } finally {
      setSubmitting(false)
    }
  }

  useEffect(() => {
    if (!open || !task?.instance_id) return
    setLoading(true)
    workflowsApi
      .getInstance(task.instance_id)
      .then(res => setDetail(res))
      .catch(err => message.error(err?.message || translate('papers.wf_load_detail_failed')))
      .finally(() => setLoading(false))
  }, [message, open, task?.instance_id])

  useEffect(() => {
    if (!open) {
      setComment('')
      setDetail(null)
    }
  }, [open])

  const nodePermissions = useMemo(() => {
    if (!detail || !task?.node_id) return {}
    const def = detail.template?.definition as any
    const node = Array.isArray(def?.nodes) ? def.nodes.find((n: any) => n.id === task.node_id) : null
    return (node?.form_permissions as Record<string, string>) || {}
  }, [detail, task?.node_id])

  const initialValues = useMemo(() => {
    const payload = detail?.instance?.payload || {}
    return (payload as any).form_values || {}
  }, [detail])

  const formSource = useMemo(() => (detail ? formSourceFromDefinition(detail.template?.definition) : null), [detail])
  const previewDoc = useMemo(
    () => (formSource ? buildSrcDoc(formSource, nodePermissions, initialValues) : ''),
    [formSource, nodePermissions, initialValues]
  )
  const entityInfo = useMemo(() => {
    const entityType = detail?.instance?.entity_type
    const entityId = detail?.instance?.entity_id
    if (!entityType || !entityId) return null
    if (entityType === 'paper') return { label: translate('papers.col_paper'), path: `/admin/paper-detail/${entityId}` }
    if (entityType === 'exam') return { label: translate('nav.exams'), path: `/exam/${entityId}` }
    return { label: translate('auto.4fea859859'), path: null }
  }, [detail])

  const formatStamp = (value: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(
      value.getMinutes()
    )}`
  }

  const buildSignedComment = (raw: string) => {
    const trimmed = raw.trim()
    if (!trimmed) return ''
    const displayName = (user?.nickname || user?.email || '').split('@')[0] || '我'
    const stamp = formatStamp(new Date())
    return `${trimmed}\n${displayName} ${stamp}`
  }

  const submit = async (action: 'approve' | 'reject') => {
    if (!task) return
    let formValues: Record<string, any> = {}
    if (formSource && iframeRef.current?.contentWindow) {
      try {
        const win = iframeRef.current.contentWindow as any
        const collected = typeof win.__collectFormValues === 'function' ? win.__collectFormValues() : {}
        if (collected && typeof collected === 'object') formValues = collected
      } catch {}
    }
    try {
      const signedComment = buildSignedComment(comment)
      if (action === 'approve') {
        await workflowsApi.approveTask(task.id, { comment: signedComment, form_values: formValues })
      } else {
        await workflowsApi.rejectTask(task.id, { comment: signedComment, form_values: formValues })
      }
      message.success(translate('auto.7213b294cd'))
      onDone()
      onClose()
    } catch (e: any) {
      message.error(e?.message || translate('auto.f03ea1c181'))
    }
  }

  const canAct = task?.status === 'pending'

  return (
    <>
    <Modal
      open={open}
      onCancel={onClose}
      title={translate('auto.9f5fc4871c')}
      width={860}
      footer={[
        <Button key="cancel" onClick={onClose}>
          {translate('app.cancel')}</Button>,
        <Button key="transfer" disabled={!canAct} onClick={() => openPicker('transfer')}>
          {translate('auto.a52c169137')}</Button>,
        <Button key="addsign" disabled={!canAct} onClick={() => openPicker('addSign')}>
          {translate('auto.f2218c36a4')}</Button>,
        <Button key="reject" danger disabled={!canAct} onClick={() => submit('reject')}>
          {translate('auto.21ec781468')}</Button>,
        <Button key="approve" type="primary" disabled={!canAct} onClick={() => submit('approve')}>
          {translate('results.passed')}</Button>,
      ]}
    >
      {loading ? (
        <Spin />
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={5} style={{ marginBottom: 4 }}>
              {detail?.template?.name || translate('workflow.col_flow')}
            </Title>
            <Space>
              <Text>{translate('workflow.col_node')}</Text>
              <Tag>{task?.node_name}</Tag>
              <Text>{translate('users.columns.status')}</Text>
              <Tag>{workflowStatusLabel(task?.status)}</Tag>
              {entityInfo?.path && (
                <Button size="small" onClick={() => navigate(entityInfo.path)}>
                  {translate('workflow.btn_view')}{entityInfo.label}
                </Button>
              )}
            </Space>
          </div>

          {formSource ? (
            <iframe
              ref={iframeRef}
              title="task-form"
              sandbox="allow-scripts allow-same-origin allow-forms"
              srcDoc={previewDoc}
              style={{ width: '100%', height: 360, border: '1px solid #e5e7eb', borderRadius: 6 }}
            />
          ) : (
            <Descriptions bordered size="small" column={1}>
              {Object.entries(initialValues).map(([key, value]) => (
                <Descriptions.Item key={key} label={key}>
                  {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                </Descriptions.Item>
              ))}
            </Descriptions>
          )}

          <div>
            <Text strong>{translate('auto.801ab0896b')}</Text>
            <TextArea rows={3} value={comment} onChange={e => setComment(e.target.value)} />
          </div>

          {detail && (
            <div>
              <Text strong>{translate('auto.cc1549689e')}</Text>
              <div style={{ marginTop: 12 }}>
                <RuntimeSummary detail={detail} />
                <WorkflowProcessTable tasks={detail.tasks || []} />
              </div>
            </div>
          )}
        </Space>
      )}
    </Modal>

    <Modal
      open={!!pickerMode}
      title={pickerMode === 'transfer' ? translate('visible.a7b576ceb8') : translate('visible.c4349fffa7')}
      okText={pickerMode === 'transfer' ? translate('visible.0ecb47a6cc') : translate('visible.78e1418384')}
      confirmLoading={submitting}
      okButtonProps={{ disabled: !pickerUser }}
      onOk={confirmPicker}
      onCancel={() => setPickerMode(null)}
      destroyOnHidden
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <Text type="secondary">
          {pickerMode === 'transfer' ? translate('visible.259dc4fd65') : translate('visible.b2dcd95e05')}
        </Text>
        <Select
          showSearch
          style={{ width: '100%' }}
          placeholder={translate('auto.628b997b46')}
          loading={userLoading}
          options={userOpts}
          value={pickerUser ?? undefined}
          onChange={v => setPickerUser(v)}
          onSearch={kw => fetchUsers(kw)}
          filterOption={false}
          notFoundContent={userLoading ? <Spin size="small" /> : null}
        />
      </Space>
    </Modal>
    </>
  )
}
