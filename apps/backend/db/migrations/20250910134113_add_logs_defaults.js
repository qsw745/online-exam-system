// apps/backend/db/migrations/XXXXXXXXXXXX_add_logs_defaults.js
/**
 * MySQL 的 ALTER 支持 .raw()，比链式 .alter() 更稳
 */
exports.up = async function (knex) {
  // 回填空值，避免 NOT NULL 失败
  await knex.raw(`UPDATE logs SET log_type='system' WHERE log_type IS NULL OR log_type=''`)
  await knex.raw(`UPDATE logs SET level='info' WHERE level IS NULL OR level=''`)

  // 统一默认值/约束（按你的表字段名调整；无此列时请去掉相应行）
  await knex.raw(`
    ALTER TABLE logs
      MODIFY COLUMN log_type VARCHAR(20) NOT NULL DEFAULT 'system' COMMENT 'user/system/audit/login/exam',
      MODIFY COLUMN level VARCHAR(10) NOT NULL DEFAULT 'info' COMMENT 'debug/info/warn/error/fatal',
      MODIFY COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  `)

  // details 如果你要改为 JSON （确保现有数据可转 JSON；否则保持 TEXT）
  // await knex.raw(`ALTER TABLE logs MODIFY COLUMN details JSON NULL`);

  // 索引（若不存在）
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at)`)
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_logs_type_level ON logs(log_type, level)`)
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_logs_user ON logs(user_id)`)
}

exports.down = async function (knex) {
  // 保守回滚：去掉默认值（按需）
  await knex.raw(`
    ALTER TABLE logs
      MODIFY COLUMN log_type VARCHAR(20) NULL DEFAULT NULL,
      MODIFY COLUMN level VARCHAR(10) NULL DEFAULT NULL
  `)
  // 索引回滚（可选）
  // await knex.raw(`DROP INDEX idx_logs_created_at ON logs`);
  // await knex.raw(`DROP INDEX idx_logs_type_level ON logs`);
  // await knex.raw(`DROP INDEX idx_logs_user ON logs`);
}
