// 20250910134113_add_logs_defaults.js
exports.config = { transaction: false };

exports.up = async function up(knex) {
  const hasLogs = await knex.schema.hasTable('logs');
  if (!hasLogs) return; // 如果你确定一定有 logs，也可以 throw

  // 看看索引是否已存在
  const idx = await knex('information_schema.statistics')
      .whereRaw('table_schema = DATABASE()')
      .andWhere('table_name', 'logs')
      .andWhere('index_name', 'idx_logs_created_at')
      .first();

  if (!idx) {
    await knex.schema.alterTable('logs', (t) => {
      t.index(['created_at'], 'idx_logs_created_at');
    });
  }

  // 如你还要改默认值等，也放在这里，记得用 alter()：
  // await knex.schema.alterTable('logs', (t) => {
  //   t.timestamp('created_at', { useTz: false }).notNullable().defaultTo(knex.fn.now()).alter();
  // });
};

exports.down = async function down(knex) {
  const hasLogs = await knex.schema.hasTable('logs');
  if (!hasLogs) return;

  const idx = await knex('information_schema.statistics')
      .whereRaw('table_schema = DATABASE()')
      .andWhere('table_name', 'logs')
      .andWhere('index_name', 'idx_logs_created_at')
      .first();

  if (idx) {
    await knex.schema.alterTable('logs', (t) => {
      t.dropIndex(['created_at'], 'idx_logs_created_at');
    });
  }
};
