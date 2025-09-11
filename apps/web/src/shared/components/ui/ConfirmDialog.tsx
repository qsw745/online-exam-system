import React from 'react'
import { ExclamationCircleOutlined } from '@ant-design/icons'
import { Typography } from 'antd'
import Modal from './Modal'
import Button from './Button'

const { Paragraph } = Typography

export interface ConfirmDialogProps {
  open: boolean
  title?: React.ReactNode
  content?: React.ReactNode
  okText?: string
  cancelText?: string
  okDanger?: boolean
  confirmLoading?: boolean
  onOk?: () => void | Promise<void>
  onCancel?: () => void
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title = '确认操作',
  content,
  okText = '确定',
  cancelText = '取消',
  okDanger,
  confirmLoading,
  onOk,
  onCancel,
}) => {
  return (
    <Modal
      open={open}
      title={
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <ExclamationCircleOutlined />
          {title}
        </span>
      }
      onCancel={onCancel}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onCancel}>{cancelText}</Button>
          <Button preset={okDanger ? 'danger' : 'primary'} loading={confirmLoading} onClick={onOk}>
            {okText}
          </Button>
        </div>
      }
      destroyOnHidden
    >
      {typeof content === 'string' ? <Paragraph>{content}</Paragraph> : content}
    </Modal>
  )
}

export default ConfirmDialog
