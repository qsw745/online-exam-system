import { useCallback, useEffect, useState } from 'react'
import { mailApi, type MailMessage } from '@/shared/api/endpoints/mail'

export type Mailbox = 'inbox' | 'sent' | 'drafts'

const loaders: Record<Mailbox, () => Promise<MailMessage[]>> = {
  inbox: () => mailApi.inbox(),
  sent: () => mailApi.sent(),
  drafts: () => mailApi.drafts(),
}

export function useMailList(mailbox: Mailbox) {
  const [data, setData] = useState<MailMessage[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await loaders[mailbox]()
      setData(list)
    } finally {
      setLoading(false)
    }
  }, [mailbox])

  useEffect(() => {
    load()
  }, [load])

  return { data, loading, reload: load, setData }
}
