// apps/backend/src/modules/orgs/domain/org.model.ts
import type { RowDataPacket } from 'mysql2/promise'

export interface IOrg extends RowDataPacket {
  id: number
  name: string
  code?: string | null
  parent_id?: number | null
  is_active: 0 | 1
  created_at: Date
  updated_at: Date
}

export type OrgListData = {
  orgs: IOrg[]
  total: number
  page: number
  limit: number
}

export type OrgTreeNode = IOrg & { children: OrgTreeNode[] }
