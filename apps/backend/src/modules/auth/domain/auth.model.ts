import type { RowDataPacket } from 'mysql2'
import type { AgeBand, DataRegion } from './account-region.policy'

export interface IUser extends RowDataPacket {
  id: number

  email: string
  password: string
  status: 'active' | 'disabled'
  public_id?: string
  data_region?: DataRegion
  country_code?: string | null
  account_type?: 'PERSONAL' | 'INSTITUTION'
  date_of_birth?: string | Date | null
  age_band?: AgeBand | 'UNKNOWN'
  deletion_status?: 'ACTIVE' | 'PENDING' | 'CANCELLED' | 'COMPLETED'
  created_at: Date
  updated_at: Date
}

export interface IRoleRow extends RowDataPacket {
  id: number
  code: string
}

export interface IPasswordResetToken extends RowDataPacket {
  id: number
  user_id: number
  token: string
  expires_at: Date
  used?: number | boolean
  created_at: Date
  updated_at: Date
}

export type JwtRole = { id: number; code: string }

export type AuthResponseData = {
  token: string
  user?: Omit<IUser, 'password'> & { org_id?: number | null }
}

export type JwtPayload = {
  id: number
  email: string
  role_ids?: number[]
  roles?: JwtRole[]
  type?: 'access' | 'refresh'
  jti?: string
  sid?: string
  public_id?: string
  data_region?: DataRegion
}
