import { useNavigate } from 'react-router-dom'

import AccountDeletionRequestCard from '@/features/account/components/AccountDeletionRequestCard'
import { useAuth } from '@/shared/contexts/AuthContext'

export default function AccountDeletionCard() {
  const { signOut } = useAuth()
  const navigate = useNavigate()

  return (
    <AccountDeletionRequestCard
      onAccepted={async () => {
        navigate('/account-deletion', { replace: true })
        await signOut()
      }}
    />
  )
}
