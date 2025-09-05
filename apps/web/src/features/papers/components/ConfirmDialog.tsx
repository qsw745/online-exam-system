// features/papers/components/ConfirmDialog.tsx
import { Modal } from 'antd'

export default function ConfirmDialog({
  open,
  title,
  content,
  onOk,
  onCancel,
  okText = '确认',
  cancelText = '取消',
}: {
  open: boolean
  title: string
  content?: string
  onOk: () => void
  onCancel: () => void
  okText?: string
  cancelText?: string
}) {
  return (
    <Modal title={title} open={open} onOk={onOk} onCancel={onCancel} okText={okText} cancelText={cancelText}>
      {content ? <p>{content}</p> : null}
    </Modal>
  )
}
