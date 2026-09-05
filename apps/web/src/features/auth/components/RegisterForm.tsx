import React from 'react'
import { Alert, Button, Checkbox, Form, Input, Space, Typography } from 'antd'
import { UserOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone, MailOutlined } from '@ant-design/icons'
import { PasswordStrengthBar } from './PasswordStrengthBar'
import type { RegisterValues } from '../../auth/hooks/useRegister'
import { translate } from '@/shared/utils/i18n'
import { Link } from 'react-router-dom'
import { AccountRegionField } from './AccountRegionField'
import { writePreferredDataRegion } from '@/platform/region/accountRegion'

const { Text } = Typography

type Props = {
  loading: boolean
  onSubmit: (values: RegisterValues) => void
  // 可选：注入 i18n 文案
  t?: (key: string) => string
}

export const RegisterForm: React.FC<Props> = ({ loading, onSubmit, t }) => {
  const [form] = Form.useForm<RegisterValues>()

  return (
    <Form<RegisterValues>
      form={form}
      disabled={loading}
      layout="vertical"
      initialValues={{
        email: '',
        password: '',
        confirmPassword: '',
        nickname: '',
        dataRegion: 'CN',
        countryCode: 'CN',
        dateOfBirth: '',
        agree: false,
      }}
      onFinish={onSubmit}
      onValuesChange={changed => {
        if (changed.dataRegion === 'CN' || changed.dataRegion === 'GLOBAL') {
          writePreferredDataRegion(changed.dataRegion)
          form.setFieldValue('countryCode', changed.dataRegion === 'CN' ? 'CN' : '')
        }
      }}
      requiredMark={false}
    >
      <Form.Item name="dataRegion" rules={[{ required: true }]}>
        <AccountRegionField value="CN" onChange={() => undefined} />
      </Form.Item>

      <Form.Item noStyle shouldUpdate={(prev, current) => prev.dataRegion !== current.dataRegion}>
        {({ getFieldValue }) => {
          const mainland = getFieldValue('dataRegion') === 'CN'
          return (
            <Form.Item
              name="countryCode"
              label="常住国家或地区代码"
              normalize={value => String(value || '').trim().toUpperCase()}
              rules={[
                { required: true, message: '请输入两位国家或地区代码' },
                { pattern: /^[A-Z]{2}$/, message: '请输入 ISO 两位代码，例如 CN、US、SG' },
              ]}
              extra={mainland ? '中国大陆区域固定为 CN。' : '请输入 ISO 两位代码，例如 US、SG、JP、GB。'}
            >
              <Input
                size="large"
                maxLength={2}
                disabled={mainland || loading}
                autoCapitalize="characters"
                placeholder="例如 US"
              />
            </Form.Item>
          )
        }}
      </Form.Item>

      <Form.Item
        name="dateOfBirth"
        label="出生日期"
        rules={[{ required: true, message: '请选择出生日期' }]}
        extra="用于适用未成年人保护规则；不会展示在公开资料中。"
      >
        <Input type="date" size="large" max={new Date().toISOString().slice(0, 10)} />
      </Form.Item>

      <Form.Item noStyle shouldUpdate={(prev, current) => prev.dataRegion !== current.dataRegion}>
        {({ getFieldValue }) => getFieldValue('dataRegion') === 'CN' ? (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 20 }}
            message="中国大陆未满 14 周岁的个人账号需先完成监护人同意流程。"
          />
        ) : null}
      </Form.Item>

      {/* 邮箱 */}
      <Form.Item
        name="email"
        label={translate('auto.652c75bd29')}
        rules={[
          { required: true, message: translate('auto.3f649d6040') },
          { type: 'email', message: translate('auto.25d22e5309') },
        ]}
      >
        <Input prefix={<MailOutlined />} type="email" placeholder={translate('auth.email_placeholder')} size="large" autoComplete="email" />
      </Form.Item>

      {/* 昵称（可选） */}
      <Form.Item name="nickname" label={translate('profile.nickname')}>
        <Input prefix={<UserOutlined />} placeholder={translate('auto.a9ee70fb24')} size="large" maxLength={30} />
      </Form.Item>

      {/* 密码 */}
      <Form.Item
        name="password"
        label={translate('auto.c425ae17a4')}
        rules={[
          { required: true, message: translate('auto.713b738250') },
          { min: 6, message: translate('auto.3add9a5261') },
        ]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder={t?.('auth.password_placeholder') ?? translate('auto.713b738250')}
          size="large"
          iconRender={v => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
          autoComplete="new-password"
          onChange={() => {
            // 触发重新渲染强度条
            const v = form.getFieldValue('password') || ''
            form.setFieldsValue({ password: v })
          }}
        />
      </Form.Item>

      {/* 密码强度条 */}
      <PasswordStrengthBar password={Form.useWatch('password', form) || ''} />

      {/* 确认密码 */}
      <Form.Item
        name="confirmPassword"
        label={t?.('auth.confirm_password') ?? translate('visible.37b3d03176')}
        dependencies={['password']}
        rules={[
          { required: true, message: translate('auth.confirm_password_placeholder') },
          ({ getFieldValue }) => ({
            validator(_, value) {
              if (!value || getFieldValue('password') === value) return Promise.resolve()
              return Promise.reject(new Error(translate('auto.3e2b222d98')))
            },
          }),
        ]}
      >
        <Input.Password
          prefix={<LockOutlined />}
          placeholder={t?.('auth.confirm_password_placeholder') ?? translate('auth.confirm_password_placeholder')}
          size="large"
          iconRender={v => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
          autoComplete="new-password"
        />
      </Form.Item>

      {/* 用户协议 */}
      <Form.Item
        name="agree"
        valuePropName="checked"
        rules={[
          {
            validator: (_, v) => (v ? Promise.resolve() : Promise.reject(new Error(translate('auto.f1b4a9c1d6')))),
          },
        ]}
      >
        <Checkbox>
          <Text style={{ fontSize: 14 }}>
            {t?.('auth.agree_terms') ?? translate('visible.141d8c4dfc')}
            <Link to="/legal/terms" target="_blank" style={{ color: '#1890ff', margin: '0 4px' }}>
              {t?.('auth.terms') ?? translate('auth.terms')}
            </Link>
            {translate('auto.9a3eb34097')}<Link to="/legal/privacy" target="_blank" style={{ color: '#1890ff', margin: '0 4px' }}>
              {t?.('auth.privacy') ?? translate('auth.privacy')}
            </Link>
            。
          </Text>
        </Checkbox>
      </Form.Item>

      {/* 提交 */}
      <Form.Item style={{ marginBottom: 0 }}>
        <Space direction="vertical" style={{ width: '100%' }} size={16}>
          <Button type="primary" htmlType="submit" loading={loading} size="large" block>
            {translate('auto.9ec360d41d')}</Button>
        </Space>
      </Form.Item>
    </Form>
  )
}
