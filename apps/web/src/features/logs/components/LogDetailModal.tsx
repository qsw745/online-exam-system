import { Descriptions, Modal, Typography } from 'antd'
import dayjs from '@/shared/utils/dayjs'
import type { LogEntry } from '@/shared/api/endpoints/logs'
import React, { useMemo } from 'react'
import { translate } from '@/shared/utils/i18n'
import { formatDateTime } from '@/shared/utils/datetime'

const { Text, Paragraph } = Typography

const levelColor = (lv: string) =>
  lv === 'info' ? 'blue' : lv === 'warning' ? 'orange' : lv === 'error' ? 'red' : undefined
const levelText = (lv: string) => (lv === 'info' ? '信息' : lv === 'warning' ? '警告' : lv === 'error' ? '错误' : lv)

/** 把任意值安全渲染：string/number 直接显示；对象/数组以 JSON 代码块形式显示；null/undefined 显示 '-' */
function renderValueSafe(v: unknown) {
  if (v === null || v === undefined || v === '') return '-'
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v)
  try {
    return <Text code>{JSON.stringify(v, null, 2)}</Text>
  } catch {
    return String(v)
  }
}

export default function LogDetailModal({
  open,
  log,
  onClose,
}: {
  open: boolean
  log: LogEntry | null
  onClose: () => void
}) {
  // 供显示 + 复制用的“原始 JSON 文本”
  const rawText = useMemo(() => {
    if (!log) return ''
    try {
      return JSON.stringify({ ...log, created_at: formatDateTime(log.created_at) }, null, 2)
    } catch {
      // 兜底：details 如果是字符串就直接用，否则尽量 stringify
      const d: any = (log as any)?.details
      if (typeof d === 'string') return d
      try {
        return JSON.stringify(d ?? {}, null, 2)
      } catch {
        return String(d ?? '')
      }
    }
  }, [log])

  return (
    <Modal
      maskClosable={false}
      title={translate('auto.88b864bdf6')}
      open={open}
      onOk={onClose}
      onCancel={onClose}
      width={800}
      okText={translate('app.close')}
      cancelButtonProps={{ style: { display: 'none' } }}
      destroyOnHidden
    >
      {log ? (
        <>
          <Descriptions column={2} size="small" bordered style={{ marginBottom: 12 }}>
            <Descriptions.Item label={translate('workflow.col_time')} span={2}>
              {log.created_at ? formatDateTime(log.created_at) : '-'}
            </Descriptions.Item>

            <Descriptions.Item label={translate('auto.2548499200')}>
              <span style={{ color: levelColor(String(log.level)) }}>{levelText(String(log.level))}</span>
            </Descriptions.Item>

            <Descriptions.Item label={translate('users.tag.user')}>
              {log.username ? (
                <>
                  {renderValueSafe(log.username)} <Text type="secondary">（ID: {renderValueSafe(log.user_id)}）</Text>
                </>
              ) : (
                translate('auto.1a1f6dff78')
              )}
            </Descriptions.Item>

            <Descriptions.Item label={translate('users.columns.actions')}>{renderValueSafe((log as any)?.action)}</Descriptions.Item>
            <Descriptions.Item label={translate('auto.c5ca3950cb')}>{renderValueSafe((log as any)?.resource)}</Descriptions.Item>

            <Descriptions.Item label="IP">{renderValueSafe((log as any)?.ip_address)}</Descriptions.Item>
            <Descriptions.Item label={translate('systemConfig.col_type')}>{renderValueSafe((log as any)?.log_type)}</Descriptions.Item>
            <Descriptions.Item label={translate('users.columns.status')}>{renderValueSafe((log as any)?.status)}</Descriptions.Item>

            {/* 客户端解析（对象字段安全渲染） */}
            <Descriptions.Item label={translate('auto.09afbbcc9b')} span={2}>
              {renderValueSafe((log as any)?.client?.label ?? (log as any)?.client)}
            </Descriptions.Item>
            <Descriptions.Item label={translate('auto.1a1f6dff78')}>{renderValueSafe((log as any)?.client?.os)}</Descriptions.Item>
            <Descriptions.Item label={translate('auto.88d650dd4f')}>{renderValueSafe((log as any)?.client?.browser)}</Descriptions.Item>
            <Descriptions.Item label={translate('auto.01f2c16cda')}>{renderValueSafe((log as any)?.client?.device)}</Descriptions.Item>
            <Descriptions.Item label="User-Agent" span={2}>
              <Text type="secondary" copyable={{ text: String((log as any)?.user_agent ?? '') }}>
                {renderValueSafe((log as any)?.user_agent)}
              </Text>
            </Descriptions.Item>
          </Descriptions>

          <Text strong>{translate('auto.77a6fb9fac')}</Text>
          {/* 关键：copyable 指定 text，复制出来就是 JSON，不会是 [object Object] */}
          <Paragraph copyable={{ text: rawText }} style={{ marginTop: 8 }}>
            <pre
              style={{
                background: '#f6f6f6',
                borderRadius: 8,
                padding: 12,
                maxHeight: 360,
                overflow: 'auto',
                margin: 0,
              }}
            >
              {rawText}
            </pre>
          </Paragraph>
        </>
      ) : (
        <Text type="secondary">{translate('common.no_data')}</Text>
      )}
    </Modal>
  )
}
