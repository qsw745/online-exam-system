import React from 'react'
import { App, Avatar, Modal, Space, Upload, type UploadFile } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useLanguage } from '@/shared/contexts/LanguageContext'

export const UploadAvatarModal: React.FC<{
  open: boolean
  user?: { nickname?: string; username?: string; avatar_url?: string | null; avatar?: string | null }
  loading?: boolean
  onCancel: () => void
  onSubmit: (file: File) => Promise<void> | void
}> = ({ open, user, loading, onCancel, onSubmit }) => {
  const { message } = App.useApp()
  const { t } = useLanguage()
  const [fileList, setFileList] = React.useState<UploadFile[]>([])
  const fileRef = React.useRef<File | null>(null)

  React.useEffect(() => {
    if (!open) {
      setFileList([])
      fileRef.current = null
    }
  }, [open])

  const beforeUpload = (file: File) => {
    if (!file.type?.startsWith?.('image/')) {
      message.error(t('users.avatar.only_image'))
      return Upload.LIST_IGNORE
    }
    const limit = 5 * 1024 * 1024
    if (file.size > limit) {
      message.error(t('users.avatar.size_limit'))
      return Upload.LIST_IGNORE
    }
    return false
  }

  const handleChange = ({ fileList: list }: { fileList: UploadFile[] }) => {
    const latest = list.slice(-1)
    setFileList(latest)
    const origin = latest[0]?.originFileObj
    fileRef.current = origin instanceof File ? origin : null
  }

  const handleRemove = () => {
    fileRef.current = null
    setFileList([])
    return true
  }

  const handleOk = async () => {
    const file = fileRef.current
    if (!file) {
      message.warning(t('users.avatar.select_first'))
      return
    }
    await onSubmit(file)
  }

  const uploadButton = (
    <div>
      <PlusOutlined />
      <div style={{ marginTop: 8 }}>{t('users.avatar.upload')}</div>
    </div>
  )

  return (
    <Modal
      open={open}
      title={t('users.avatar.title').replace('{name}', user?.nickname || user?.username || '')}
      onCancel={onCancel}
      onOk={handleOk}
      okButtonProps={{ loading }}
      maskClosable={false}
      destroyOnHidden
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {user?.avatar_url || user?.avatar ? (
          <Space>
            <span style={{ color: '#6b7280' }}>{t('users.avatar.current')}</span>
            <Avatar size={64} src={user.avatar_url || user.avatar} />
          </Space>
        ) : null}
        <Upload
          listType="picture-card"
          accept="image/*"
          maxCount={1}
          fileList={fileList}
          beforeUpload={beforeUpload}
          onChange={handleChange}
          onRemove={handleRemove}
          showUploadList={{ showPreviewIcon: false }}
        >
          {fileList.length >= 1 ? null : uploadButton}
        </Upload>
        <div style={{ color: '#9ca3af' }}>{t('users.avatar.tip')}</div>
      </Space>
    </Modal>
  )
}

export default UploadAvatarModal
