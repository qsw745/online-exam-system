import React, { useEffect, useMemo, useState } from 'react'
import { App, Form, Input, Modal, Select } from 'antd'
import type { SelectProps } from 'antd'
import { rolesApi } from '@/shared/api/endpoints/roles'

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

  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  const [allRoles, setAllRoles] = useState<Role[]>([])
  const [selected, setSelected] = useState<AntdLV[]>([]) // labelInValue 形式，保证显示“名称”

  // 小工具：解包 ApiResult
  const unwrap = <T,>(r: any): T =>
    r && typeof r === 'object' && 'success' in r ? (r.success ? (r.data as T) : ([] as any)) : (r as T)

  // 拉取可选角色 & 用户现有角色
  useEffect(() => {
    if (!open || !user?.id) return
    ;(async () => {
      setLoading(true)
      try {
        // 1) 角色选项：优先取机构内角色
        let list: Role[] = []
        if (orgId != null) {
          const r = await rolesApi.listInOrg(orgId, { page: 1, pageSize: 1000 })
          const data = unwrap<{ roles: Role[]; total: number }>(r)
          list = Array.isArray(data?.roles) ? data.roles : []
        } else {
          const r = await rolesApi.list({ page: 1, pageSize: 1000 })
          const data = unwrap<{ roles: Role[]; total: number } | Role[]>(r)
          list = Array.isArray((data as any)?.roles) ? (data as any).roles : (data as Role[])
        }

        // 2) 用户当前角色
        const cur = await rolesApi.getUserRoles(user.id)
        const curRoles = unwrap<Role[]>(cur)

        // 3) 统一设定
        setAllRoles(list)

        // 让已选在 options 未出现也能展示正确名称（例如全局角色）
        const mergedMap = new Map<number, Role>()
        ;[...list, ...curRoles].forEach(r => mergedMap.set(r.id, r))

        const initialSelected: AntdLV[] = curRoles
          .map(r => mergedMap.get(r.id))
          .filter(Boolean)
          .map(r => ({ value: (r as Role).id, label: (r as Role).name }))

        setSelected(initialSelected)
        form.setFieldsValue({
          nickname: user.nickname || user.real_name || user.username || '',
          roles: initialSelected,
        })
      } catch (e: any) {
        console.error(e)
        message.error(e?.message || '加载角色数据失败')
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
        throw new Error((res as any)?.message || '保存失败')
      }
      message.success('角色已更新')
      onOk?.()
    } catch (e: any) {
      if (e?.errorFields) return // 表单校验错误
      console.error(e)
      message.error(e?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      title={`分配 ${user?.real_name || user?.nickname || user?.username || ''} 用户的角色`}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={saving}
      destroyOnHidden
      maskClosable={false}
    >
      <Form form={form} layout="vertical">
        <Form.Item label="用户昵称" name="nickname">
          <Input disabled />
        </Form.Item>

        <Form.Item label="角色列表" name="roles" rules={[{ required: true, message: '请选择至少一个角色' }]} required>
          <Select
            mode="multiple"
            labelInValue
            value={selected}
            onChange={vals => setSelected(vals as AntdLV[])}
            options={options}
            placeholder="请选择角色"
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
