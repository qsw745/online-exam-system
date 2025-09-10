import { Descriptions, Modal, Typography } from 'antd'
import dayjs from 'dayjs'
import type { LogEntry } from '@/shared/api/endpoints/logs'
const { Text, Paragraph } = Typography

const levelColor = (lv: string) =>
  lv === 'info' ? 'blue' : lv === 'warning' ? 'orange' : lv === 'error' ? 'red' : undefined
const levelText = (lv: string) => (lv === 'info' ? '信息' : lv === 'warning' ? '警告' : lv === 'error' ? '错误' : lv)

export default function LogDetailModal({
  open,
  log,
  onClose,
}: {
  open: boolean
  log: LogEntry | null
  onClose: () => void
}) {
  return (
    <Modal
      title="日志详情"
      open={open}
      onOk={onClose}
      onCancel={onClose}
      width={800}
      okText="关闭"
      cancelButtonProps={{ style: { display: 'none' } }}
    >
      {log ? (
        <>
          <Descriptions column={2} size="small" bordered style={{ marginBottom: 12 }}>
            <Descriptions.Item label="时间" span={2}>
              {dayjs(log.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="级别">
              <span style={{ color: levelColor(String(log.level)) }}>{levelText(String(log.level))}</span>
            </Descriptions.Item>
            <Descriptions.Item label="用户">
              {log.username ? (
                <>
                  {log.username} <Text type="secondary">（ID: {log.user_id}）</Text>
                </>
              ) : (
                '系统'
              )}
            </Descriptions.Item>
            <Descriptions.Item label="操作">{log.action}</Descriptions.Item>
            <Descriptions.Item label="资源">{log.resource}</Descriptions.Item>
            <Descriptions.Item label="IP">{log.ip_address}</Descriptions.Item>
            <Descriptions.Item label="类型">{log.log_type}</Descriptions.Item>
            <Descriptions.Item label="状态">{log.status ?? '-'}</Descriptions.Item>

            {/* 新增：客户端解析 */}
            <Descriptions.Item label="客户端" span={2}>
              {log.client?.label || '-'}
            </Descriptions.Item>
            <Descriptions.Item label="系统">{log.client?.os || '-'}</Descriptions.Item>
            <Descriptions.Item label="浏览器">{log.client?.browser || '-'}</Descriptions.Item>
            <Descriptions.Item label="设备">{log.client?.device || '-'}</Descriptions.Item>
            <Descriptions.Item label="User-Agent" span={2}>
              <Text type="secondary" copyable>
                {log.user_agent || '-'}
              </Text>
            </Descriptions.Item>
          </Descriptions>

          <Text strong>原始数据</Text>
          <Paragraph copyable style={{ marginTop: 8 }}>
            <pre style={{ background: '#f6f6f6', borderRadius: 8, padding: 12, maxHeight: 360, overflow: 'auto' }}>
              {(() => {
                try {
                  return JSON.stringify(
                    { ...log, created_at: dayjs(log.created_at).format('YYYY-MM-DD HH:mm:ss') },
                    null,
                    2
                  )
                } catch {
                  return String(log.details ?? '')
                }
              })()}
            </pre>
          </Paragraph>
        </>
      ) : (
        <Text type="secondary">暂无数据</Text>
      )}
    </Modal>
  )
}
