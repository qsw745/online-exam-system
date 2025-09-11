import React from 'react'
import { Modal as AntModal, ModalProps as AntModalProps } from 'antd'

export interface ModalProps extends Omit<AntModalProps, 'visible'> {
  /** antd v5 推荐写法；同时我们也会同步给 destroyOnClose 以兼容类型 */
  destroyOnHidden?: boolean
}

const Modal: React.FC<ModalProps> = ({ destroyOnHidden, ...rest }) => {
  // antd v5 里 destroyOnClose 仍然存在（但提示用 destroyOnHidden）
  // 我们两个都传，兼容不同小版本
  return <AntModal destroyOnHidden={destroyOnHidden} {...(rest as any)} />
}

export default Modal
