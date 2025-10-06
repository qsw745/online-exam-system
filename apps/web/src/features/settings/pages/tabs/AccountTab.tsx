import React, { useEffect, useMemo, useState } from 'react'
import { Card, Typography, Button, Modal, Form, Input, Space } from 'antd'
import { useAuth } from '@/shared/contexts/AuthContext'
// 如需接后端，解开这行并按你的接口路径替换：
// import { api } from '@/shared/api/http'

const { Title, Text } = Typography

/* ---------- 小工具 ---------- */
const maskPhone = (v?: string | null) => {
  if (!v) return '未绑定手机号'
  const s = String(v).replace(/\D/g, '')
  if (s.length < 7) return s
  return `${s.slice(0, 3)}****${s.slice(-4)}`
}
const maskEmail = (v?: string | null) => {
  if (!v) return '未绑定邮箱'
  const m = String(v).split('@')
  if (m.length !== 2) return v!
  const name = m[0]
  const head = name.slice(0, Math.min(3, name.length))
  return `${head}${name.length > 3 ? '***' : ''}@${m[1]}`
}
const pwdStrength = (pwd: string) => {
  let s = 0
  if (/[a-z]/.test(pwd)) s++
  if (/[A-Z]/.test(pwd)) s++
  if (/\d/.test(pwd)) s++
  if (/[^a-zA-Z0-9]/.test(pwd)) s++
  if (pwd.length >= 12) s++
  if (s <= 2) return { label: '弱', color: '#ef4444' }
  if (s === 3) return { label: '中', color: '#f59e0b' }
  return { label: '强', color: '#16a34a' }
}

/* ---------- 行组件 ---------- */
function RowItem({ title, desc, onEdit }: { title: React.ReactNode; desc: React.ReactNode; onEdit: () => void }) {
  return (
    <div
      style={{
        padding: '20px 0',
        borderBottom: '1px solid var(--app-colorSplit, rgba(0,0,0,.06))',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <div style={{ width: 140, flexShrink: 0 }}>
        <Text strong style={{ fontSize: 18 }}>
          {title}
        </Text>
      </div>
      <div style={{ color: 'var(--app-colorTextSecondary,#6b7280)' }}>{desc}</div>
      <div style={{ marginLeft: 'auto' }}>
        <Button type="link" onClick={onEdit}>
          修改
        </Button>
      </div>
    </div>
  )
}

/* ---------- 主页面 ---------- */
export default function AccountTab() {
  const { user } = useAuth()

  // 这些值可以从后端状态初始化；这里从 user 兜底
  const [boundPhone, setBoundPhone] = useState<string | undefined>((user as any)?.phone)
  const [securitySet, setSecuritySet] = useState<boolean>((user as any)?.security_set ?? false)
  const [backupEmail, setBackupEmail] = useState<string | undefined>((user as any)?.backup_email)

  /* ======= 修改密码 ======= */
  const [pwdOpen, setPwdOpen] = useState(false)
  const [pwdForm] = Form.useForm<{ current: string; next: string; confirm: string }>()
  const nextPwd = Form.useWatch('next', pwdForm)
  const strength = useMemo(() => pwdStrength(nextPwd || ''), [nextPwd])

  const submitPassword = async () => {
    const values = await pwdForm.validateFields()
    // TODO: 接后端
    // await api.put('/account/password', values)
    Modal.success({ title: '已更新密码' })
    setPwdOpen(false)
    pwdForm.resetFields()
  }

  /* ======= 绑定手机 ======= */
  const [phoneOpen, setPhoneOpen] = useState(false)
  const [phoneForm] = Form.useForm<{ phone: string; code: string }>()
  const [phoneCountdown, setPhoneCountdown] = useState(0)
  useEffect(() => {
    if (phoneCountdown <= 0) return
    const t = setInterval(() => setPhoneCountdown(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [phoneCountdown])
  const sendPhoneCode = async () => {
    const phone = phoneForm.getFieldValue('phone')
    if (!/^1\d{10}$/.test(phone || '')) {
      phoneForm.validateFields(['phone'])
      return
    }
    // await api.post('/account/phone/send-code', { phone })
    setPhoneCountdown(60)
  }
  const submitPhone = async () => {
    const values = await phoneForm.validateFields()
    // await api.put('/account/phone', values)
    setBoundPhone(values.phone)
    Modal.success({ title: '已更新密保手机' })
    setPhoneOpen(false)
  }

  /* ======= 密保问题 ======= */
  const [qaOpen, setQaOpen] = useState(false)
  const [qaForm] = Form.useForm<{ q: string; a: string }>()
  const submitQA = async () => {
    const values = await qaForm.validateFields()
    // await api.put('/account/security-question', values)
    setSecuritySet(true)
    Modal.success({ title: '已设置密保问题' })
    setQaOpen(false)
  }

  /* ======= 备用邮箱 ======= */
  const [emailOpen, setEmailOpen] = useState(false)
  const [emailForm] = Form.useForm<{ email: string; code: string }>()
  const [emailCountdown, setEmailCountdown] = useState(0)
  useEffect(() => {
    if (emailCountdown <= 0) return
    const t = setInterval(() => setEmailCountdown(s => s - 1), 1000)
    return () => clearInterval(t)
  }, [emailCountdown])
  const sendEmailCode = async () => {
    const email = emailForm.getFieldValue('email')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) {
      emailForm.validateFields(['email'])
      return
    }
    // await api.post('/account/backup-email/send-code', { email })
    setEmailCountdown(60)
  }
  const submitEmail = async () => {
    const values = await emailForm.validateFields()
    // await api.put('/account/backup-email', values)
    setBackupEmail(values.email)
    Modal.success({ title: '已更新备用邮箱' })
    setEmailOpen(false)
  }

  return (
    <div style={{ maxWidth: 980 }}>
      <Title level={2} style={{ marginBottom: 16 }}>
        账户管理
      </Title>

      <Card>
        {/* 账户密码 */}
        <RowItem
          title="账户密码"
          desc={
            <span>
              当前密码强度：
              <b style={{ color: strength.color }}>{strength.label}</b>
            </span>
          }
          onEdit={() => setPwdOpen(true)}
        />

        {/* 密保手机 */}
        <RowItem
          title="密保手机"
          desc={<span>{boundPhone ? `已经绑定手机：${maskPhone(boundPhone)}` : '未绑定手机号'}</span>}
          onEdit={() => {
            setPhoneOpen(true)
            phoneForm.setFieldsValue({ phone: boundPhone })
          }}
        />

        {/* 密保问题 */}
        <RowItem
          title="密保问题"
          desc={securitySet ? '已设置密保问题' : '未设置密保问题，密保问题可有效保护账号安全'}
          onEdit={() => setQaOpen(true)}
        />

        {/* 备用邮箱 */}
        <RowItem
          title="备用邮箱"
          desc={<span>{backupEmail ? `已绑定邮箱：${maskEmail(backupEmail)}` : '未绑定备用邮箱'}</span>}
          onEdit={() => {
            setEmailOpen(true)
            emailForm.setFieldsValue({ email: backupEmail })
          }}
        />
      </Card>

      {/* ======= 弹窗们 ======= */}

      {/* 修改密码 */}
      <Modal
        open={pwdOpen}
        onCancel={() => setPwdOpen(false)}
        title="修改密码"
        onOk={submitPassword}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={pwdForm} layout="vertical">
          <Form.Item name="current" label="当前密码" rules={[{ required: true, message: '请输入当前密码' }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            name="next"
            label="新密码"
            rules={[
              { required: true, message: '请输入新密码' },
              { min: 8, message: '至少 8 位' },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <div style={{ margin: '-8px 0 12px', color: strength.color, fontSize: 12 }}>
            密码强度：{strength.label}（包含大小写/数字/符号更安全）
          </div>
          <Form.Item
            name="confirm"
            label="确认新密码"
            dependencies={['next']}
            rules={[
              { required: true, message: '请再次输入新密码' },
              ({ getFieldValue }) => ({
                validator(_, v) {
                  if (!v || getFieldValue('next') === v) return Promise.resolve()
                  return Promise.reject(new Error('两次输入不一致'))
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 密保手机 */}
      <Modal
        open={phoneOpen}
        onCancel={() => setPhoneOpen(false)}
        title="密保手机"
        onOk={submitPhone}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={phoneForm} layout="vertical">
          <Form.Item
            name="phone"
            label="手机号"
            rules={[
              { required: true, message: '请输入手机号' },
              { pattern: /^1\d{10}$/, message: '请输入有效的 11 位手机号' },
            ]}
          >
            <Input inputMode="numeric" maxLength={11} />
          </Form.Item>
          <Form.Item label="验证码" required>
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item
                name="code"
                noStyle
                rules={[
                  { required: true, message: '请输入验证码' },
                  { len: 6, message: '6 位验证码' },
                ]}
              >
                <Input maxLength={6} />
              </Form.Item>
              <Button onClick={sendPhoneCode} disabled={phoneCountdown > 0} style={{ flexShrink: 0 }}>
                {phoneCountdown > 0 ? `${phoneCountdown}s` : '发送验证码'}
              </Button>
            </Space.Compact>
          </Form.Item>
        </Form>
      </Modal>

      {/* 密保问题 */}
      <Modal
        open={qaOpen}
        onCancel={() => setQaOpen(false)}
        title="密保问题"
        onOk={submitQA}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={qaForm} layout="vertical">
          <Form.Item
            name="q"
            label="问题"
            rules={[{ required: true, message: '请输入密保问题（例如：我第一只宠物的名字？）' }]}
          >
            <Input placeholder="请输入密保问题" maxLength={64} />
          </Form.Item>
          <Form.Item name="a" label="答案" rules={[{ required: true, message: '请输入答案' }]}>
            <Input.Password placeholder="请输入答案" maxLength={64} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 备用邮箱 */}
      <Modal
        open={emailOpen}
        onCancel={() => setEmailOpen(false)}
        title="备用邮箱"
        onOk={submitEmail}
        okText="保存"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={emailForm} layout="vertical">
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email' as const, message: '邮箱格式不正确' },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item label="验证码" required>
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="code" noStyle rules={[{ required: true, message: '请输入验证码' }]}>
                <Input maxLength={6} />
              </Form.Item>
              <Button onClick={sendEmailCode} disabled={emailCountdown > 0} style={{ flexShrink: 0 }}>
                {emailCountdown > 0 ? `${emailCountdown}s` : '发送验证码'}
              </Button>
            </Space.Compact>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
