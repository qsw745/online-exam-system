-- 0004_users_profile_columns.sql  （MySQL 5.7/8.0 通用）
-- 给 users 表补充：nickname, school, class_name, experience_points, level, avatar_url
-- 会先判断列是否已存在，存在就跳过

SET @db := DATABASE();

-- nickname
SET @sql := IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA=@db AND TABLE_NAME='users' AND COLUMN_NAME='nickname'),
  'SELECT 1',
  'ALTER TABLE `users` ADD COLUMN `nickname` VARCHAR(50) NULL AFTER `role`;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- school
SET @sql := IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA=@db AND TABLE_NAME='users' AND COLUMN_NAME='school'),
  'SELECT 1',
  'ALTER TABLE `users` ADD COLUMN `school` VARCHAR(100) NULL AFTER `nickname`;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- class_name
SET @sql := IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA=@db AND TABLE_NAME='users' AND COLUMN_NAME='class_name'),
  'SELECT 1',
  'ALTER TABLE `users` ADD COLUMN `class_name` VARCHAR(100) NULL AFTER `school`;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- experience_points
SET @sql := IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA=@db AND TABLE_NAME='users' AND COLUMN_NAME='experience_points'),
  'SELECT 1',
  'ALTER TABLE `users` ADD COLUMN `experience_points` INT NOT NULL DEFAULT 0 AFTER `class_name`;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- level
SET @sql := IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA=@db AND TABLE_NAME='users' AND COLUMN_NAME='level'),
  'SELECT 1',
  'ALTER TABLE `users` ADD COLUMN `level` INT NOT NULL DEFAULT 1 AFTER `experience_points`;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- avatar_url
SET @sql := IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA=@db AND TABLE_NAME='users' AND COLUMN_NAME='avatar_url'),
  'SELECT 1',
  'ALTER TABLE `users` ADD COLUMN `avatar_url` VARCHAR(255) NULL AFTER `level`;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
