// apps/backend/src/modules/orgs/domain/org-user.model.ts

export type OrgUserListItem = {
  id: number
  username: string
  email?: string | null
  real_name?: string | null
  phone?: string | null
  is_active?: 0 | 1
  status?: 'active' | 'disabled'
  created_at?: Date
  updated_at?: Date
  org_id?: number | null
  org_name?: string | null
  role_codes: string[]
}

export type OrgUserListData = {
  items: OrgUserListItem[]
  total: number
  page: number
  limit: number
}
