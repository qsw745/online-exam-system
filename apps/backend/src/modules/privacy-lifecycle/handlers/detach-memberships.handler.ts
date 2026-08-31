import { createFixedTableHandler, defaultLifecycleHandlerDatabase, type LifecycleHandlerDatabase } from './handler-support'

const MEMBERSHIP_TABLES = [
  'user_roles', 'user_organizations', 'user_org_roles', 'task_assignments',
  'leaderboard_entries', 'leaderboard_records', 'competition_participants',
].map(table => ({ table, subjectColumn: 'user_id' }))

export const createDetachMembershipsHandler = (database: LifecycleHandlerDatabase = defaultLifecycleHandlerDatabase) =>
  createFixedTableHandler({
    stepCode: 'detach_memberships_rankings', category: 'MEMBERSHIPS_AND_RANKINGS', database, specs: MEMBERSHIP_TABLES,
  })
