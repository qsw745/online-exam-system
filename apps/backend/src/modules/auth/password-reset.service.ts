// src/modules/auth/password-reset.service.ts
import { pool } from '@config/database.js'
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'

export const PasswordResetRepo = {
  findUserByEmail(email: string) {
    return pool.query<RowDataPacket[]>('SELECT id, username, email FROM users WHERE email = ?', [email])
  },
  // ...把 controller 里的 SQL 逐步搬过来
}
