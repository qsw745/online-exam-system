-- 如果没有 is_primary 就新增
SET @sql := IF (
  (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = 'user_organizations'
       AND COLUMN_NAME  = 'is_primary') = 0,
  'ALTER TABLE user_organizations ADD COLUMN is_primary TINYINT(1) NOT NULL DEFAULT 0;',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 如果没有 created_at 就新增
SET @sql := IF (
  (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = 'user_organizations'
       AND COLUMN_NAME  = 'created_at') = 0,
  'ALTER TABLE user_organizations ADD COLUMN created_at DATETIME NULL;',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 如果没有 updated_at 就新增
SET @sql := IF (
  (SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = 'user_organizations'
       AND COLUMN_NAME  = 'updated_at') = 0,
  'ALTER TABLE user_organizations ADD COLUMN updated_at DATETIME NULL;',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- 如果没有唯一键 (user_id, org_id) 就新增
SET @sql := IF (
  (SELECT COUNT(*) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = 'user_organizations'
       AND INDEX_NAME   = 'uq_user_org') = 0,
  'ALTER TABLE user_organizations ADD CONSTRAINT uq_user_org UNIQUE (user_id, org_id);',
  'SELECT 1'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
