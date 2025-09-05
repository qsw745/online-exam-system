import React from 'react'
import { useForgotPassword } from '@features/auth/hooks/useForgotPassword'
import { ForgotPasswordForm } from '@features/auth/components/ForgotPasswordForm'
import { ForgotPasswordSuccess } from '@features/auth/components/ForgotPasswordSuccess'

const ForgotPasswordPage: React.FC = () => {
  const { loading, success, error, submit, clearError } = useForgotPassword()

  if (success) return <ForgotPasswordSuccess />

  return <ForgotPasswordForm loading={loading} error={error} onSubmit={submit} onCloseError={clearError} />
}

export default ForgotPasswordPage
