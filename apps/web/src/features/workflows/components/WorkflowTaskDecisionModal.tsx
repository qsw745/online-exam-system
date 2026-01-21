import { App, Button, Descriptions, Modal, Space, Spin, Tag, Typography, Input } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { workflowsApi, type WorkflowInstanceDetail, type WorkflowTask } from '@/shared/api/endpoints/workflows'
import { workflowStatusLabel } from '@/shared/utils/workflow'
import { useAuth } from '@/shared/contexts/AuthContext'

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

  useEffect(() => {
    if (!open || !task?.instance_id) return
    setLoading(true)
    workflowsApi
      .getInstance(task.instance_id)
      .then(res => setDetail(res))
      .catch(err => message.error(err?.message || '加载流程详情失败'))
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
    if (entityType === 'paper') return { label: '试卷', path: `/admin/paper-detail/${entityId}` }
    if (entityType === 'exam') return { label: '考试', path: `/exam/${entityId}` }
    return { label: '业务', path: null }
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
      message.success('审批已提交')
      onDone()
      onClose()
    } catch (e: any) {
      message.error(e?.message || '审批失败')
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="处理审批"
      width={840}
      footer={[
        <Button key="cancel" onClick={onClose}>
          取消
        </Button>,
        <Button key="reject" danger onClick={() => submit('reject')}>
          驳回
        </Button>,
        <Button key="approve" type="primary" onClick={() => submit('approve')}>
          通过
        </Button>,
      ]}
    >
      {loading ? (
        <Spin />
      ) : (
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={5} style={{ marginBottom: 4 }}>
              {detail?.template?.name || '流程'}
            </Title>
            <Space>
              <Text>节点</Text>
              <Tag>{task?.node_name}</Tag>
              <Text>状态</Text>
              <Tag>{workflowStatusLabel(task?.status)}</Tag>
              {entityInfo?.path && (
                <Button size="small" onClick={() => navigate(entityInfo.path)}>
                  查看{entityInfo.label}
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
            <Text strong>审批意见</Text>
            <TextArea rows={3} value={comment} onChange={e => setComment(e.target.value)} />
          </div>
        </Space>
      )}
    </Modal>
  )
}
