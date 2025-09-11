import { App } from 'antd'

export function useNotice() {
  const { message, notification, modal } = App.useApp()
  return {
    success: (content: string) => message.success(content),
    error: (content: string) => message.error(content),
    info: (content: string) => message.info(content),
    warn: (content: string) => message.warning(content),
    confirm: modal.confirm,
    notification,
  }
}
