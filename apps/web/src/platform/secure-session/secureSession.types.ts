export type StoredNativeSession = {
  accessToken: string
  mode: 'session' | 'local' | '7d'
  expiresAt: number | null
}

export interface SecureSessionAdapter {
  read(): Promise<StoredNativeSession | null>
  write(session: StoredNativeSession): Promise<void>
  clear(): Promise<void>
}
