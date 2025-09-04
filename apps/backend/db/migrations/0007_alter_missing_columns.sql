-- 0007_alter_missing_columns.sql
-- 补齐缺失列：logs.resource_id、papers.total_score、menus.component
-- 兼容 MySQL 5.7/8.0：通过 INFORMATION_SCHEMA 判断后按需 ALTER，幂等执行

-- logs.resource_id（建议字符串以适配多类型资源 ID）
SET @col_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'logs'
    AND COLUMN_NAME = 'resource_id'
);
SET @sql := IF(@col_exists > 0,
  'SELECT 1',
  'ALTER TABLE `logs` ADD COLUMN `resource_id` VARCHAR(100) NULL AFTER `resource_type`;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- papers.total_score（默认 100 分）
SET @col_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'papers'
    AND COLUMN_NAME = 'total_score'
);
SET @sql := IF(@col_exists > 0,
  'SELECT 1',
  'ALTER TABLE `papers` ADD COLUMN `total_score` INT NOT NULL DEFAULT 100 AFTER `description`;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- menus.component（有的早期表结构没这个列）
SET @col_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'menus'
    AND COLUMN_NAME = 'component'
);
SET @sql := IF(@col_exists > 0,
  'SELECT 1',
  'ALTER TABLE `menus` ADD COLUMN `component` VARCHAR(200) NULL AFTER `path`;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
