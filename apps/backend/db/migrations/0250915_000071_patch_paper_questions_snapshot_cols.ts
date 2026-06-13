import type { Knex } from 'knex'

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('paper_questions'))) return

  const cols = await Promise.all([
    knex.schema.hasColumn('paper_questions', 'question_type'),
    knex.schema.hasColumn('paper_questions', 'question_content'),
    knex.schema.hasColumn('paper_questions', 'question_options'),
    knex.schema.hasColumn('paper_questions', 'question_answer'),
  ])

  const [hasType, hasContent, hasOptions, hasAnswer] = cols
  if (!hasType || !hasContent || !hasOptions || !hasAnswer) {
    await knex.schema.alterTable('paper_questions', t => {
      if (!hasType) t.string('question_type', 50).nullable()
      if (!hasContent) t.text('question_content').nullable()
      if (!hasOptions) t.json('question_options').nullable()
      if (!hasAnswer) t.text('question_answer').nullable()
    })
  }
}

export async function down(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('paper_questions'))) return
  const dropIf = async (name: string) => {
    if (await knex.schema.hasColumn('paper_questions', name)) {
      await knex.schema.alterTable('paper_questions', t => t.dropColumn(name))
    }
  }
  await dropIf('question_type')
  await dropIf('question_content')
  await dropIf('question_options')
  await dropIf('question_answer')
}
