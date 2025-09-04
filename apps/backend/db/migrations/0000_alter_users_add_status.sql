-- 0000_alter_users_add_status.sql
-- 给 users 表补充 status 列（若不存在），用于启用/禁用用户登录

SET @col_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'status'
);

SET @sql := IF(@col_exists > 0,
  'SELECT 1',
  "ALTER TABLE `users` ADD COLUMN `status` ENUM('active','disabled') NOT NULL DEFAULT 'active' AFTER `role`;"
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
