// apps/web/src/features/admin-settings/components/SettingsForm.tsx
import { BgColorsOutlined, CloudOutlined, EditOutlined, KeyOutlined, SaveOutlined } from '@ant-design/icons'
import { Button, Form, Input, InputNumber, Slider, Space, Switch, Divider, Typography, Select, Alert } from 'antd'
import React, { useEffect } from 'react'
import type { SystemSettings } from '@/shared/types/admin-settings'
import dayjs from '@/shared/utils/dayjs'
import { DATETIME_FORMAT_GROUPS, setDateTimeFormat } from '@/shared/utils/datetime'
import { setWatermarkConfig } from '@/shared/utils/watermark'
import { useLanguage } from '@/shared/contexts/LanguageContext'

const { Text } = Typography

// 各厂商默认接口地址（与后端 config/ai.ts 保持一致）；custom 不自动填，由用户输入
const PROVIDER_BASE_URL: Record<string, string> = {
  deepseek: 'https://api.deepseek.com',
  openai: 'https://api.openai.com/v1',
  local: 'http://127.0.0.1:11434/v1',
}

type Props = {
  value?: SystemSettings | null
  loading?: boolean
  onChange?: (v: SystemSettings) => void
  onSubmit?: (v: SystemSettings) => Promise<void> | void
  onReset?: () => void
  disableSave?: boolean
}

export const SettingsForm: React.FC<Props> = ({ value, loading, onChange, onSubmit, onReset, disableSave }) => {
  const { t } = useLanguage()
  const [form] = Form.useForm<SystemSettings>()

  useEffect(() => {
    if (value) form.setFieldsValue(value)
  }, [value, form])

  const handleValuesChange = (_: any, all: SystemSettings) => onChange?.(all)

  const handleFinish = async (values: SystemSettings) => {
    await onSubmit?.(values)
    // 保存成功即时应用全局日期格式与水印，无需刷新
    setDateTimeFormat((values as any)?.dateTimeFormat)
    setWatermarkConfig(values as any)
  }

  const enableStrong = Form.useWatch('enableStrongPassword', form)
  const watermarkEnabled = Form.useWatch('watermarkEnabled', form)
  const enableCaptcha = Form.useWatch('enableCaptcha', form)
  const aiEnabled = Form.useWatch('aiEnabled', form)
  const aiProvider = Form.useWatch('aiProvider', form)
  const aiApiKeySet = Form.useWatch('aiApiKeySet', form)

  const providerOptions = React.useMemo(
    () => [
      { label: 'DeepSeek', value: 'deepseek' },
      { label: 'OpenAI', value: 'openai' },
      { label: t('adminSettings.provider_custom'), value: 'custom' },
      { label: t('adminSettings.provider_local'), value: 'local' },
    ],
    [t]
  )

  const thinkingOptions = React.useMemo(
    () => [
      { label: t('adminSettings.off'), value: 'disabled' },
      { label: t('adminSettings.on'), value: 'enabled' },
    ],
    [t]
  )

  const livenessOptions = React.useMemo(
    () => [
      { label: t('adminSettings.liveness_none'), value: 'none' },
      { label: t('adminSettings.liveness_silent'), value: 'silent' },
      { label: t('adminSettings.liveness_action'), value: 'action' },
    ],
    [t]
  )

  // 分组 + 用当前时间实时预览每种格式
  const dateTimeFormatOptions = React.useMemo(() => {
    const now = dayjs()
    return DATETIME_FORMAT_GROUPS.map(group => ({
      label: t(`adminSettings.datetime_group_${group.key}`),
      options: group.formats.map(fmt => ({ label: now.format(fmt), value: fmt })),
    }))
  }, [t])

  return (
    <Form form={form} layout="vertical" onFinish={handleFinish} onValuesChange={handleValuesChange} disabled={loading}>
      <Form.Item name="aiApiKeySet" valuePropName="checked" hidden>
        <Switch />
      </Form.Item>

      <Form.Item
        label={t('adminSettings.system_name')}
        name="systemName"
        rules={[
          { required: true, message: t('adminSettings.system_name_required') },
          { max: 50, message: t('adminSettings.max_50_chars') },
        ]}
      >
        <Input prefix={<EditOutlined />} placeholder={t('adminSettings.system_name_placeholder')} maxLength={50} />
      </Form.Item>

      <Form.Item
        label={t('adminSettings.datetime_format')}
        name="dateTimeFormat"
        tooltip={t('adminSettings.datetime_format_tooltip')}
      >
        <Select
          showSearch={false}
          placeholder={t('adminSettings.datetime_format_placeholder')}
          options={dateTimeFormatOptions}
          style={{ maxWidth: 320 }}
        />
      </Form.Item>

      {/* 默认密码：仅写不读 */}
      <Form.Item
        label={t('adminSettings.default_password')}
        name="defaultPassword"
        rules={[
          { min: 6, message: t('adminSettings.min_6_chars') },
          { max: 20, message: t('adminSettings.max_20_chars') },
        ]}
      >
        <Input.Password prefix={<KeyOutlined />} placeholder={t('adminSettings.default_password_placeholder')} maxLength={20} />
      </Form.Item>

      <Form.Item label={t('adminSettings.allow_registration')} name="allowUserRegistration" valuePropName="checked">
        <Switch />
      </Form.Item>

      <Form.Item
        label={t('adminSettings.require_email_verification')}
        name="requireEmailVerification"
        valuePropName="checked"
        tooltip={t('adminSettings.require_email_verification_tooltip')}
      >
        <Switch />
      </Form.Item>

      <Form.Item
        label={t('adminSettings.login_liveness_level')}
        name="loginLivenessLevel"
        tooltip={t('adminSettings.login_liveness_tooltip')}
      >
        <Select options={livenessOptions} />
      </Form.Item>

      <Form.Item
        label={t('adminSettings.enroll_liveness_level')}
        name="enrollLivenessLevel"
        tooltip={t('adminSettings.enroll_liveness_tooltip')}
      >
        <Select options={livenessOptions} />
      </Form.Item>

      <Form.Item
        label={t('adminSettings.max_login_attempts')}
        name="maxLoginAttempts"
        rules={[{ required: true, message: t('adminSettings.max_login_attempts_required') }]}
      >
        <InputNumber min={1} max={20} style={{ width: '100%' }} />
      </Form.Item>

      <Divider />

      {/* ✅ 验证码 */}
      <Form.Item label={t('adminSettings.enable_captcha')} name="enableCaptcha" valuePropName="checked">
        <Switch />
      </Form.Item>
      <Form.Item
        label={t('adminSettings.captcha_threshold')}
        name="captchaAfterFailedAttempts"
        tooltip={t('adminSettings.captcha_threshold_tooltip')}
        rules={[
          { required: true, message: t('adminSettings.threshold_required') },
          { type: 'number', min: 1, max: 20, message: t('adminSettings.range_1_20') },
        ]}
      >
        <InputNumber min={1} max={20} style={{ width: '100%' }} disabled={!enableCaptcha} />
      </Form.Item>

      <Divider />

      {/* ✅ 强密码 */}
      <Form.Item label={t('adminSettings.enable_strong_password')} name="enableStrongPassword" valuePropName="checked">
        <Switch />
      </Form.Item>

      <Text type="secondary">{t('adminSettings.strong_password_desc')}</Text>

      <Form.Item label={t('adminSettings.min_length')} name={['strongPasswordRules', 'minLength']} required>
        <InputNumber min={6} max={64} style={{ width: '100%' }} disabled={!enableStrong} />
      </Form.Item>

      <Form.Item label={t('adminSettings.require_upper')} name={['strongPasswordRules', 'requireUpper']} valuePropName="checked">
        <Switch disabled={!enableStrong} />
      </Form.Item>
      <Form.Item label={t('adminSettings.require_lower')} name={['strongPasswordRules', 'requireLower']} valuePropName="checked">
        <Switch disabled={!enableStrong} />
      </Form.Item>
      <Form.Item label={t('adminSettings.require_number')} name={['strongPasswordRules', 'requireNumber']} valuePropName="checked">
        <Switch disabled={!enableStrong} />
      </Form.Item>
      <Form.Item label={t('adminSettings.require_symbol')} name={['strongPasswordRules', 'requireSymbol']} valuePropName="checked">
        <Switch disabled={!enableStrong} />
      </Form.Item>

      <Form.Item
        label={t('adminSettings.forbid_repeated')}
        name={['strongPasswordRules', 'forbidRepeated']}
        valuePropName="checked"
      >
        <Switch disabled={!enableStrong} />
      </Form.Item>
      <Form.Item label={t('adminSettings.forbid_common')} name={['strongPasswordRules', 'forbidCommon']} valuePropName="checked">
        <Switch disabled={!enableStrong} />
      </Form.Item>

      <Divider />

      <Typography.Title level={5} style={{ marginTop: 0 }}>
        <BgColorsOutlined style={{ marginRight: 8 }} />
        {t('adminSettings.watermark_settings')}
      </Typography.Title>

      <Form.Item label={t('adminSettings.watermark_enabled')} name="watermarkEnabled" valuePropName="checked">
        <Switch />
      </Form.Item>

      <Form.Item
        label={t('adminSettings.watermark_server_enabled')}
        name="watermarkServerEnabled"
        valuePropName="checked"
        tooltip={t('adminSettings.watermark_server_tooltip')}
      >
        <Switch disabled={!watermarkEnabled} />
      </Form.Item>

      <Form.Item label={t('adminSettings.watermark_scope')} name="watermarkScope">
        <Select
          disabled={!watermarkEnabled}
          options={[
            { label: t('adminSettings.watermark_scope_all'), value: 'all' },
            { label: t('adminSettings.watermark_scope_exam'), value: 'exam' },
          ]}
          style={{ maxWidth: 320 }}
        />
      </Form.Item>

      <Form.Item
        label={t('adminSettings.watermark_content')}
        name="watermarkContent"
        tooltip={t('adminSettings.watermark_content_tooltip')}
        rules={[{ max: 200, message: t('adminSettings.watermark_content_max') }]}
      >
        <Input disabled={!watermarkEnabled} placeholder="{name} {time}" maxLength={200} />
      </Form.Item>

      <Form.Item label={t('adminSettings.watermark_opacity')} name="watermarkOpacity">
        <Slider disabled={!watermarkEnabled} min={0.02} max={1} step={0.02} style={{ maxWidth: 320 }} />
      </Form.Item>

      <Form.Item label={t('adminSettings.watermark_font_size')} name="watermarkFontSize">
        <InputNumber disabled={!watermarkEnabled} min={10} max={48} style={{ width: '100%' }} />
      </Form.Item>

      <Form.Item label={t('adminSettings.watermark_rotate')} name="watermarkRotate">
        <InputNumber disabled={!watermarkEnabled} min={-90} max={90} style={{ width: '100%' }} />
      </Form.Item>

      <Form.Item label={t('adminSettings.watermark_gap')} name="watermarkGap">
        <InputNumber disabled={!watermarkEnabled} min={20} max={400} style={{ width: '100%' }} />
      </Form.Item>

      <Form.Item label={t('adminSettings.watermark_color')} name="watermarkColor">
        <Input type="color" disabled={!watermarkEnabled} style={{ width: 64, padding: 2 }} />
      </Form.Item>

      <Divider />

      <Typography.Title level={5} style={{ marginTop: 0 }}>
        <CloudOutlined style={{ marginRight: 8 }} />
        {t('adminSettings.ai_settings')}
      </Typography.Title>

      <Form.Item label={t('adminSettings.enable_ai')} name="aiEnabled" valuePropName="checked">
        <Switch />
      </Form.Item>

      <Form.Item label={t('adminSettings.ai_provider')} name="aiProvider" rules={[{ required: true, message: t('adminSettings.ai_provider_required') }]}>
        <Select
          options={providerOptions}
          disabled={!aiEnabled}
          onChange={(v: string) => {
            // 切换厂商时自动填入该厂商默认接口地址（custom 保持用户自填）
            const url = PROVIDER_BASE_URL[v]
            if (url) {
              form.setFieldValue('aiBaseUrl', url)
              onChange?.(form.getFieldsValue(true))
            }
          }}
        />
      </Form.Item>

      <Form.Item
        label={t('adminSettings.base_url')}
        name="aiBaseUrl"
        rules={[
          { required: !!aiEnabled && aiProvider !== 'local', message: t('adminSettings.base_url_required') },
          { max: 300, message: t('adminSettings.max_300_chars') },
        ]}
      >
        <Input placeholder="https://api.deepseek.com" disabled={!aiEnabled} />
      </Form.Item>

      <Form.Item
        label="API Key"
        name="aiApiKey"
        tooltip={t('adminSettings.api_key_tooltip')}
        rules={[{ max: 300, message: t('adminSettings.max_300_chars') }]}
      >
        <Input.Password
          prefix={<KeyOutlined />}
          placeholder={aiApiKeySet ? t('adminSettings.api_key_keep_placeholder') : t('adminSettings.api_key_placeholder')}
          disabled={!aiEnabled || aiProvider === 'local'}
        />
      </Form.Item>

      {aiApiKeySet && aiProvider !== 'local' && (
        <Alert type="success" showIcon message={t('adminSettings.api_key_saved')} style={{ marginBottom: 16 }} />
      )}

      <Form.Item label={t('adminSettings.default_model')} name="aiModel" rules={[{ required: true, message: t('adminSettings.model_required') }]}>
        <Input placeholder="deepseek-v4-flash" disabled={!aiEnabled} />
      </Form.Item>

      <Form.Item
        label={t('adminSettings.allowed_models')}
        name="aiAllowedModels"
        tooltip={t('adminSettings.allowed_models_tooltip')}
      >
        <Input placeholder="deepseek-v4-flash,deepseek-v4-pro" disabled={!aiEnabled} />
      </Form.Item>

      {aiProvider === 'deepseek' && (
        <Form.Item label={t('adminSettings.deepseek_thinking_mode')} name="aiThinkingMode">
          <Select options={thinkingOptions} disabled={!aiEnabled} />
        </Form.Item>
      )}

      <Form.Item
        label={t('adminSettings.temperature')}
        name="aiTemperature"
        rules={[{ type: 'number', min: 0, max: 2, message: t('adminSettings.range_0_2') }]}
      >
        <InputNumber min={0} max={2} step={0.1} style={{ width: '100%' }} disabled={!aiEnabled} />
      </Form.Item>

      <Form.Item
        label={t('adminSettings.max_tokens')}
        name="aiMaxTokens"
        rules={[{ type: 'number', min: 1, max: 100000, message: t('adminSettings.range_1_100000') }]}
      >
        <InputNumber min={1} max={100000} style={{ width: '100%' }} disabled={!aiEnabled} />
      </Form.Item>

      <Form.Item
        label={t('adminSettings.timeout_ms')}
        name="aiTimeoutMs"
        rules={[{ type: 'number', min: 1000, max: 300000, message: t('adminSettings.range_1000_300000') }]}
      >
        <InputNumber min={1000} max={300000} step={1000} style={{ width: '100%' }} disabled={!aiEnabled} />
      </Form.Item>

      <Divider />

      <Form.Item>
        <Space>
          <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />} disabled={disableSave}>
            {t('settings.save')}
          </Button>
          <Button onClick={onReset} disabled={loading}>
            {t('app.reset')}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  )
}
