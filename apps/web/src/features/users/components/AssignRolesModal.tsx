import React, { useEffect, useMemo, useState } from 'react'
import { App, Form, Input, Modal, Select } from 'antd'
import type { SelectProps } from 'antd'
import { rolesApi } from '@/shared/api/endpoints/roles'
import { useLanguage } from '@/shared/contexts/LanguageContext'

type AntdLV = { value: number; label: string }

type Role = {
  id: number
  name: string
  code: string
  is_disabled?: boolean | 0 | 1
}

interface Props {
  open: boolean
  user: { id: number; username?: string; real_name?: string; nickname?: string } | null
  /** 当前机构；若传入则优先取机构内角色，否则取全局角色 */
  orgId?: number
  onOk?: () => void
  onCancel?: () => void
}

const AssignRolesModal: React.FC<Props> = ({ open, user, orgId, onOk, onCancel }) => {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const { t } = useLanguage()
  const formatMessage = React.useCallback(
    (template: string, vars: Record<string, string | number> = {}) =>
      template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] !== undefined ? String(vars[key]) : '')),
    []
  )

  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  const [allRoles, setAllRoles] = useState<Role[]>([])
  const [selected, setSelected] = useState<AntdLV[]>([]) // labelInValue 形式，保证显示“名称”

  // 小工具：解包 ApiResult
  const unwrap = <T,>(r: any): T => {
    if (r && typeof r === 'object' && 'success' in r) {
      if (r.success) return r.data as T
      throw new Error(r?.message || r?.error || t('users.roles.request_failed'))
    }
    return r as T
  }

  // 拉取可选角色 & 用户现有角色
  useEffect(() => {
    if (!open || !user?.id) return
    ;(async () => {
      setLoading(true)
      try {
        const resp = await rolesApi.getRolesForUserAssign(user.id, orgId ?? undefined)
        const data = unwrap<{ roles?: Role[]; selected?: number[] }>(resp)
        const baseList = Array.isArray(data?.roles) ? data.roles : []
        const selectedIds = Array.isArray(data?.selected) ? data.selected : []

        const roleMap = new Map<number, Role>()
        baseList.forEach(r => roleMap.set(r.id, r))
        const fullList: Role[] = [...baseList]
        selectedIds.forEach(id => {
          if (!roleMap.has(id)) {
            const placeholder: Role = { id, name: formatMessage(t('users.roles.placeholder'), { id }), code: `role-${id}` }
            roleMap.set(id, placeholder)
            fullList.push(placeholder)
          }
        })

        setAllRoles(fullList)

        const initialSelected: AntdLV[] = selectedIds.map(id => {
          const r = roleMap.get(id)
          return r
            ? { value: r.id, label: r.name }
            : { value: id, label: formatMessage(t('users.roles.placeholder'), { id }) }
        })

        setSelected(initialSelected)
        form.setFieldsValue({
          nickname: user.nickname || user.real_name || user.username || '',
          roles: initialSelected,
        })
      } catch (e: any) {
        console.error(e)
        message.error(e?.message || t('users.roles.load_failed'))
      } finally {
        setLoading(false)
      }
    })()
  }, [open, user?.id, orgId, form, message, user?.nickname, user?.real_name, user?.username])

  const options: SelectProps['options'] = useMemo(
    () => allRoles.map(r => ({ value: r.id, label: r.name, disabled: !!r.is_disabled })),
    [allRoles]
  )

  const handleOk = async () => {
    try {
      const vals = await form.validateFields()
      const roleIds = (vals.roles as AntdLV[]).map(v => Number(v.value)).filter(n => Number.isFinite(n))
      setSaving(true)
      const res = await rolesApi.setUserRoles(Number(user?.id), roleIds)
      const ok = !('success' in (res as any)) || (res as any).success !== false
      if (!ok) {
        throw new Error((res as any)?.message || t('users.roles.save_failed'))
      }
      message.success(t('users.roles.updated'))
      onOk?.()
    } catch (e: any) {
      if (e?.errorFields) return // 表单校验错误
      console.error(e)
      message.error(e?.message || t('users.roles.save_failed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title={formatMessage(t('users.roles.title'), {
        name: user?.real_name || user?.nickname || user?.username || '',
      })}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={saving}
      destroyOnHidden
      maskClosable={false}
    >
      <Form form={form} layout="vertical">
        <Form.Item label={t('users.form.nickname')} name="nickname">
          <Input disabled />
        </Form.Item>

        <Form.Item
          label={t('users.form.roles')}
          name="roles"
          rules={[{ required: true, message: t('users.form.roles_required') }]}
          required
        >
          <Select
            mode="multiple"
            labelInValue
            value={selected}
            onChange={vals => setSelected(vals as AntdLV[])}
            options={options}
            placeholder={t('users.form.roles_placeholder')}
            optionFilterProp="label"
            showSearch
            allowClear
            loading={loading}
            style={{ width: '100%' }}
          />
        </Form.Item>
      </Form>
    </Modal>
  )
}

export default AssignRolesModal
