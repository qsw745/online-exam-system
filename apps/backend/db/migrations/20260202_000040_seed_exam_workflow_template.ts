import type { Knex } from 'knex'

const TABLE = 'workflow_templates'

const definition = {
  nodes: [
    { id: 'start', type: 'start', name: '开始' },
    {
      id: 'review',
      type: 'approval',
      name: '多教师审核',
      approvers_from: 'payload.reviewer_ids',
      approval_rule: 'count',
      required_approvals: 'payload.required_approvals',
      reject_rule: 'any',
    },
    { id: 'end', type: 'end', name: '结束' },
  ],
  edges: [
    { from: 'start', to: 'review' },
    { from: 'review', to: 'end' },
  ],
}

export async function up(knex: Knex): Promise<void> {
  const exists = await knex(TABLE).where({ entity_type: 'exam', name: '考试审核流程', version: 1 }).first()
  if (exists) return
  await knex(TABLE).insert({
    name: '考试审核流程',
    entity_type: 'exam',
    version: 1,
    status: 'published',
    definition: JSON.stringify(definition),
    created_by: 1,
    created_at: knex.fn.now(),
    updated_at: knex.fn.now(),
  })
}

export async function down(knex: Knex): Promise<void> {
  await knex(TABLE).where({ entity_type: 'exam', name: '考试审核流程', version: 1 }).delete()
}
