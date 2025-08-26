-- 0009_alter_logs_add_status.sql
-- 为 logs 表补充业务状态字段及失败原因（若不存在）

-- status：业务结果（success/failed），独立于 level(info/error…)
SET @col_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'logs'
    AND COLUMN_NAME = 'status'
);
SET @sql := IF(@col_exists > 0,
  'SELECT 1',
  "ALTER TABLE `logs` ADD COLUMN `status` ENUM('success','failed') NULL AFTER `level`;"
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- failure_reason：失败原因（可空）
SET @col_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'logs'
    AND COLUMN_NAME = 'failure_reason'
);
SET @sql := IF(@col_exists > 0,
  'SELECT 1',
  "ALTER TABLE `logs` ADD COLUMN `failure_reason` VARCHAR(255) NULL AFTER `status`;"
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- （可选）创建按 status 的索引，便于筛选成功/失败日志
SET @idx := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME='logs'
    AND INDEX_NAME='idx_logs_status'
);
SET @sql := IF(@idx>0,
  'SELECT 1',
  'CREATE INDEX `idx_logs_status` ON `logs`(`status`);'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
