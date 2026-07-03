// src/features/settings/pages/tabs/AccountTab.tsx
import { api } from '@/shared/api/http'
import { useAuth } from '@/shared/contexts/AuthContext'
import { App, Button, Card, Form, Input, Modal, Space, Typography } from 'antd'
import React, { useEffect, useMemo, useState } from 'react'
import { isSuccess, getErr, type ApiResult } from '@/shared/api/core/types'
import { useLanguage } from '@/shared/contexts/LanguageContext'

const { Title, Text } = Typography

/* ---------- 小工具 ---------- */
const maskPhone = (v?: string | null, fallback = '') => {
  if (!v) return fallback
  const s = String(v).replace(/\D/g, '')
  if (s.length < 7) return s
  return `${s.slice(0, 3)}****${s.slice(-4)}`
}
const maskEmail = (v?: string | null, fallback = '') => {
  if (!v) return fallback
  const m = String(v).split('@')
  if (m.length !== 2) return v!
  const name = m[0]
  const head = name.slice(0, Math.min(3, name.length))
  return `${head}${name.length > 3 ? '***' : ''}@${m[1]}`
}
const pwdStrength = (pwd: string, t: (key: string) => string) => {
  let s = 0
  if (/[a-z]/.test(pwd)) s++
  if (/[A-Z]/.test(pwd)) s++
  if (/\d/.test(pwd)) s++
  if (/[^a-zA-Z0-9]/.test(pwd)) s++
  if (pwd.length >= 12) s++
  if (s <= 2) return { label: t('account.password_weak'), color: '#ef4444' }
  if (s === 3) return { label: t('account.password_medium'), color: '#f59e0b' }
  return { label: t('account.password_strong'), color: '#16a34a' }
}

/* ---------- 行组件 ---------- */
function RowItem({ title, desc, onEdit }: { title: React.ReactNode; desc: React.ReactNode; onEdit: () => void }) {
  const { t } = useLanguage()
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
          {t('app.edit')}
        </Button>
      </div>
    </div>
  )
}

/* ---------- 主页面 ---------- */
export default function AccountTab() {
  const { message, modal } = App.useApp()
  const { user } = useAuth()
  const { t } = useLanguage()

  // 这些值来源两处：1) user_settings（推荐），2) user 兜底
  // 为减少额外查询，这里先用 user 兜底，保存时写 user_settings
  const [boundPhone, setBoundPhone] = useState<string | undefined>((user as any)?.phone)
  const [securitySet, setSecuritySet] = useState<boolean>((user as any)?.security_set ?? false)
  const [backupEmail, setBackupEmail] = useState<string | undefined>((user as any)?.backup_email)

  /* ======= 修改密码 ======= */
  const [pwdOpen, setPwdOpen] = useState(false)
  const [pwdForm] = Form.useForm<{ current: string; next: string; confirm: string }>()
  const nextPwd = Form.useWatch('next', pwdForm)
  const strength = useMemo(() => pwdStrength(nextPwd || '', t), [nextPwd, t])

 const submitPassword = async () => {
   const v = await pwdForm.validateFields()
   try {
     const r = await api.put<ApiResult<unknown>>('/users/me/password', { current: v.current, next: v.next })
     if (!isSuccess(r)) throw new Error(getErr(r, t('account.password_update_failed')))
     Modal.success({ title: t('account.password_updated'), content: t('account.password_updated_desc') })
     setPwdOpen(false)
     pwdForm.resetFields()
   } catch (e: any) {
     message.error(e?.message || t('account.password_update_failed'))
   }
 }

  /* ======= 密保手机 ======= */
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
    // 如果你有短信服务端点，在此调用；没有就直接允许保存
    // await api.post('/verification/sms', { phone, scene: 'bind_phone' })
    setPhoneCountdown(60)
    message.success(t('account.code_sent_demo'))
  }
  const submitPhone = async () => {
    const values = await phoneForm.validateFields()
    try {
      await api.post('/users/settings', {
        security: { phone: values.phone }, // 建议放 user_settings.security 下
      })
      setBoundPhone(values.phone)
      Modal.success({ title: t('account.phone_updated') })
      setPhoneOpen(false)
    } catch (e: any) {
      message.error(e?.message || t('account.phone_update_failed'))
    }
  }

  /* ======= 密保问题 ======= */
  const [qaOpen, setQaOpen] = useState(false)
  const [qaForm] = Form.useForm<{ q: string; a: string }>()
  const submitQA = async () => {
    const values = await qaForm.validateFields()
    try {
      await api.post('/users/settings', {
        security: { question: values.q, answer: values.a },
      })
      setSecuritySet(true)
      Modal.success({ title: t('account.qa_updated') })
      setQaOpen(false)
    } catch (e: any) {
      message.error(e?.message || t('account.qa_update_failed'))
    }
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
    // 如果你有邮箱验证码端点，在此调用
    // await api.post('/verification/email', { email, scene: 'bind_backup_email' })
    setEmailCountdown(60)
    message.success(t('account.code_sent_demo'))
  }
  const submitEmail = async () => {
    const values = await emailForm.validateFields()
    try {
      await api.post('/users/settings', {
        security: { backup_email: values.email },
      })
      setBackupEmail(values.email)
      Modal.success({ title: t('account.email_updated') })
      setEmailOpen(false)
    } catch (e: any) {
      message.error(e?.message || t('account.email_update_failed'))
    }
  }

  return (
    <div style={{ maxWidth: 980 }}>
      <Title level={2} style={{ marginBottom: 16 }}>
        {t('settings.account')}
      </Title>

      <Card>
        <RowItem
          title={t('account.password')}
          desc={
            <span>
              {t('account.current_strength_prefix')}<b style={{ color: strength.color }}>{strength.label}</b>
            </span>
          }
          onEdit={() => setPwdOpen(true)}
        />

        <RowItem
          title={t('account.security_phone')}
          desc={
            <span>
              {boundPhone
                ? t('account.bound_phone').replace('{phone}', maskPhone(boundPhone))
                : t('account.phone_unbound')}
            </span>
          }
          onEdit={() => {
            setPhoneOpen(true)
            phoneForm.setFieldsValue({ phone: boundPhone })
          }}
        />

        <RowItem
          title={t('account.security_question')}
          desc={securitySet ? t('account.qa_set') : t('account.qa_unset_desc')}
          onEdit={() => setQaOpen(true)}
        />

        <RowItem
          title={t('account.backup_email')}
          desc={
            <span>
              {backupEmail
                ? t('account.bound_email').replace('{email}', maskEmail(backupEmail))
                : t('account.email_unbound')}
            </span>
          }
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
        title={t('account.change_password')}
        onOk={submitPassword}
        okText={t('app.save')}
        cancelText={t('app.cancel')}
        destroyOnHidden
      >
        <Form form={pwdForm} layout="vertical">
          <Form.Item name="current" label={t('account.current_password')} rules={[{ required: true, message: t('account.current_password_required') }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            name="next"
            label={t('account.new_password')}
            rules={[
              { required: true, message: t('account.new_password_required') },
              { min: 8, message: t('account.password_min_8') },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <div style={{ margin: '-8px 0 12px', color: strength.color, fontSize: 12 }}>
            {t('account.password_strength_prefix')}{strength.label}{t('account.password_strength_suffix')}
          </div>
          <Form.Item
            name="confirm"
            label={t('account.confirm_new_password')}
            dependencies={['next']}
            rules={[
              { required: true, message: t('account.confirm_new_password_required') },
              ({ getFieldValue }) => ({
                validator(_, v) {
                  if (!v || getFieldValue('next') === v) return Promise.resolve()
                  return Promise.reject(new Error(t('account.password_mismatch')))
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
        title={t('account.security_phone')}
        onOk={submitPhone}
        okText={t('app.save')}
        cancelText={t('app.cancel')}
        destroyOnHidden
      >
        <Form form={phoneForm} layout="vertical">
          <Form.Item
            name="phone"
            label={t('account.phone')}
            rules={[
              { required: true, message: t('account.phone_required') },
              { pattern: /^1\d{10}$/, message: t('account.phone_invalid') },
            ]}
          >
            <Input inputMode="numeric" maxLength={11} />
          </Form.Item>
          <Form.Item label={t('account.verification_code')} required>
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item
                name="code"
                noStyle
                rules={[
                  { required: true, message: t('account.code_required') },
                  { len: 6, message: t('account.code_len_6') },
                ]}
              >
                <Input maxLength={6} />
              </Form.Item>
              <Button onClick={sendPhoneCode} disabled={phoneCountdown > 0} style={{ flexShrink: 0 }}>
                {phoneCountdown > 0 ? `${phoneCountdown}s` : t('account.send_code')}
              </Button>
            </Space.Compact>
          </Form.Item>
        </Form>
      </Modal>

      {/* 密保问题 */}
      <Modal
        open={qaOpen}
        onCancel={() => setQaOpen(false)}
        title={t('account.security_question')}
        onOk={submitQA}
        okText={t('app.save')}
        cancelText={t('app.cancel')}
        destroyOnHidden
      >
        <Form form={qaForm} layout="vertical">
          <Form.Item
            name="q"
            label={t('account.question')}
            rules={[{ required: true, message: t('account.question_required') }]}
          >
            <Input placeholder={t('account.question_placeholder')} maxLength={64} />
          </Form.Item>
          <Form.Item name="a" label={t('account.answer')} rules={[{ required: true, message: t('account.answer_required') }]}>
            <Input.Password placeholder={t('account.answer_placeholder')} maxLength={64} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 备用邮箱 */}
      <Modal
        open={emailOpen}
        onCancel={() => setEmailOpen(false)}
        title={t('account.backup_email')}
        onOk={submitEmail}
        okText={t('app.save')}
        cancelText={t('app.cancel')}
        destroyOnHidden
      >
        <Form form={emailForm} layout="vertical">
          <Form.Item
            name="email"
            label={t('auth.email')}
            rules={[
              { required: true, message: t('account.email_required') },
              { type: 'email' as const, message: t('account.email_invalid') },
            ]}
          >
            <Input />
          </Form.Item>
          <Form.Item label={t('account.verification_code')} required>
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item name="code" noStyle rules={[{ required: true, message: t('account.code_required') }]}>
                <Input maxLength={6} />
              </Form.Item>
              <Button onClick={sendEmailCode} disabled={emailCountdown > 0} style={{ flexShrink: 0 }}>
                {emailCountdown > 0 ? `${emailCountdown}s` : t('account.send_code')}
              </Button>
            </Space.Compact>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
