import React, { ReactNode, useMemo, useState } from 'react'
import { Modal, Form } from 'antd'
import type { FormInstance, FormProps, ModalProps } from 'antd'

export interface FormModalProps<T extends object = any> {
  /** 标题 */
  title?: ReactNode
  /** 打开状态（受控） */
  open: boolean
  /** 受控开关 */
  onOpenChange?: (open: boolean) => void
  /** 提交（返回 Promise 可自动展示 loading） */
  onSubmit: (values: T) => Promise<any> | any
  /** 初始值 */
  initialValues?: Partial<T>
  /** 自定义按钮文案 */
  okText?: string
  cancelText?: string
  /** Modal 宽度 */
  width?: ModalProps['width']
  /** 受控 loading（可选） */
  confirmLoading?: boolean
  /** 关闭后是否销毁，默认 true */
  destroyOnClose?: boolean
  /** 表单布局，默认 vertical */
  layout?: FormProps<T>['layout']
  /** 可传入外部 form 实例 */
  form?: FormInstance<T>
  /** 提交前转换/清洗 */
  beforeSubmit?: (values: T) => Promise<T> | T
  /** 自定义 footer（完全接管） */
  footer?: ModalProps['footer']
  /** Modal 其他 props */
  modalProps?: Omit<ModalProps, 'open' | 'onOk' | 'onCancel' | 'confirmLoading' | 'title' | 'footer' | 'width'>
  /** children 应该是 Form.Item 列表 */
  children: ReactNode
}

function FormModal<T extends object = any>({
  title,
  open,
  onOpenChange,
  onSubmit,
  initialValues,
  okText = '保存',
  cancelText = '取消',
  width = 560,
  confirmLoading,
  destroyOnClose = true,
  layout = 'vertical',
  form: externalForm,
  beforeSubmit,
  footer,
  modalProps,
  children,
}: FormModalProps<T>) {
  const [form] = Form.useForm<T>()
  const formInst = externalForm ?? form
  const [innerLoading, setInnerLoading] = useState(false)

  const loading = useMemo(() => confirmLoading ?? innerLoading, [confirmLoading, innerLoading])

  const handleOk = async () => {
    try {
      const raw = await formInst.validateFields()
      const data = (beforeSubmit ? await beforeSubmit(raw) : raw) as T
      const ret = onSubmit?.(data)
      if (ret && typeof (ret as any).then === 'function') {
        setInnerLoading(true)
        await ret
      }
      onOpenChange?.(false)
      // 提交成功后重置
      setTimeout(() => formInst.resetFields(), 0)
    } catch (e) {
      // 校验不通过或提交异常
    } finally {
      setInnerLoading(false)
    }
  }

  const handleCancel = () => {
    onOpenChange?.(false)
    // 关闭时不自动 reset，等 destroyOnClose 或下次打开时再设置 initial
  }

  return (
    <Modal
      title={title}
      maskClosable={false}
      open={open}
      onOk={handleOk}
      onCancel={handleCancel}
      okText={okText}
      cancelText={cancelText}
      width={width}
      confirmLoading={loading}
      destroyOnHidden={destroyOnClose}
      footer={footer}
      {...modalProps}
    >
      <Form<T> form={formInst} layout={layout} initialValues={initialValues}>
        {children}
      </Form>
    </Modal>
  )
}

export default FormModal
