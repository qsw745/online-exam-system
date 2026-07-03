import React, { useMemo } from 'react'
import { Form, Input, Modal, Select, TreeSelect } from 'antd'
import { useLanguage } from '@/shared/contexts/LanguageContext'
import UserFaceSection from './UserFaceSection'
import { translate } from '@/shared/utils/i18n'
const { Option } = Select

// 转 TreeSelect 数据（只取有 id 的）
function toTreeOptions(tree: any[] = []): any[] {
  const dfs = (n: any): any | null => {
    if (!n || n.id == null) return null
    const children = Array.isArray(n.children) ? n.children.map(dfs).filter(Boolean) : undefined
    return { value: Number(n.id), label: n.name, children }
  }
  return (tree || []).map(dfs).filter(Boolean) as any[]
}

export const EditUserModal: React.FC<{
  open: boolean
  user: any | null
  tree: any[]
  onCancel: () => void
  onSubmit: (payload: {
    username: string
    nickname?: string
    phone?: string
    email?: string
    gender?: '男' | '女' | '保密'
    orgId?: number | null
    remark?: string
    description?: string
  }) => Promise<void> | void
}> = ({ open, user, tree, onCancel, onSubmit }) => {
  const [form] = Form.useForm()
  const { t } = useLanguage()

  // —— 回显映射 —— //
  const mapped = useMemo(() => {
    if (!user) return undefined
    const originalOrgId =
      typeof user.orgId === 'number' ? user.orgId : typeof user.org_id === 'number' ? user.org_id : undefined
    const g = (user.gender || '').toString()
    const gender =
      g === 'male' || g === '男'
        ? '男'
        : g === 'female' || g === '女'
          ? '女'
          : g === '保密' || g === 'secret' || g === 'unknown'
            ? '保密'
            : undefined
    return {
      nickname: user.nickname ?? user.real_name ?? '',
      username: user.username ?? '',
      phone: user.phone ?? '',
      email: user.email ?? '',
      gender,
      orgId: originalOrgId,
      remark: user.remark ?? user.description ?? '',
      __originalOrgId: originalOrgId,
    }
  }, [user])

  const handleOk = async () => {
    const v = await form.validateFields()
    // 原始 orgId
    const originalOrgId: number | undefined = form.getFieldValue('__originalOrgId')
    // 当前选择 orgId：不改则保持原值
    let nextOrgId: number | null | undefined =
      typeof v.orgId === 'number' ? v.orgId : v.orgId == null ? undefined : Number(v.orgId)
    if (typeof nextOrgId === 'undefined') nextOrgId = typeof originalOrgId === 'number' ? originalOrgId : undefined

    const gender =
      v.gender === '男' || v.gender === '女' || v.gender === '保密'
        ? (v.gender as '男' | '女' | '保密')
        : undefined

    const payload: any = {
      username: String(v.username || '').trim(),
      nickname: (v.nickname || '').trim(),
      phone: v.phone?.trim() || undefined,
      email: v.email?.trim() || undefined,
      gender,
      remark: v.remark?.trim() || undefined,
      description: v.remark?.trim() || undefined, // 兼容后端字段
    }
    if (typeof nextOrgId !== 'undefined') payload.orgId = nextOrgId

    await onSubmit(payload)
  }

  return (
    <Modal
      title={t('users.edit.title')}
      open={open}
      maskClosable={false}
      onCancel={() => {
        form.resetFields()
        onCancel()
      }}
      onOk={handleOk}
      okText={t('app.confirm')}
      cancelText={t('app.cancel')}
      width={720}
      // ⛳️ antd 新 API：用 destroyOnHidden 替代 destroyOnClose
      destroyOnHidden
      afterOpenChange={opened => {
        if (opened && mapped) form.setFieldsValue(mapped)
        if (!opened) form.resetFields()
      }}
    >
      <Form form={form} layout="vertical" initialValues={mapped} preserve={false}>
        {/* 两列区域 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            columnGap: 16,
            rowGap: 8,
          }}
        >
          <Form.Item
            label={t('users.form.nickname')}
            name="nickname"
            rules={[{ required: true, message: t('users.form.nickname_required') }, { max: 50 }]}
          >
            <Input placeholder={t('users.form.nickname_placeholder')} />
          </Form.Item>

          <Form.Item label={t('users.form.phone')} name="phone" rules={[{ max: 32 }]}>
            <Input placeholder={t('users.form.phone_placeholder')} />
          </Form.Item>

          <Form.Item
            label={t('users.form.email')}
            name="email"
            rules={[{ type: 'email', message: t('users.form.email_invalid') }, { max: 128 }]}
          >
            <Input placeholder={t('users.form.email_placeholder')} />
          </Form.Item>

          <Form.Item label={t('users.form.gender')} name="gender">
            <Select placeholder={t('users.form.gender_placeholder')}>
              <Option value={translate('users.gender.male')}>{t('users.gender.male')}</Option>
              <Option value={translate('users.gender.female')}>{t('users.gender.female')}</Option>
              <Option value={translate('users.gender.secret')}>{t('users.gender.secret')}</Option>
            </Select>
          </Form.Item>

          <Form.Item label={t('users.form.org')} name="orgId">
            <TreeSelect
              allowClear
              treeData={toTreeOptions(tree)}
              placeholder={t('users.form.org_placeholder')}
              treeDefaultExpandAll={false}
              showSearch
              dropdownStyle={{ maxHeight: 360, overflow: 'auto' }}
            />
          </Form.Item>

          {/* 备注独占两列 */}
          <Form.Item
            label={t('users.form.remark')}
            name="remark"
            style={{ gridColumn: '1 / span 2' }}
            rules={[{ max: 500, message: t('users.form.remark_max') }]}
          >
            <Input.TextArea rows={4} placeholder={t('users.form.remark_optional')} />
          </Form.Item>

          {/* 隐藏：原 orgId，用于保留逻辑 */}
          <Form.Item name="__originalOrgId" hidden>
            <Input />
          </Form.Item>
        </div>
      </Form>

      {user?.id ? <UserFaceSection userId={user.id} /> : null}
    </Modal>
  )
}

export default EditUserModal
