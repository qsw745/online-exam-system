-- 0002_alter_menus_add_columns.sql
-- 给 menus 表补充缺失的列：sort_order, level, menu_type, permission_code, redirect, meta, is_disabled
-- 兼容 MySQL 5.7/8.0：按需添加（存在则跳过）

SET @db := DATABASE();

-- sort_order INT NOT NULL DEFAULT 1
SET @sql := IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA=@db AND TABLE_NAME='menus' AND COLUMN_NAME='sort_order'),
  'SELECT 1',
  'ALTER TABLE `menus` ADD COLUMN `sort_order` INT NOT NULL DEFAULT 1 AFTER `parent_id`;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- level INT NULL
SET @sql := IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA=@db AND TABLE_NAME='menus' AND COLUMN_NAME='level'),
  'SELECT 1',
  'ALTER TABLE `menus` ADD COLUMN `level` INT NULL AFTER `sort_order`;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- menu_type ENUM('menu','button','link') DEFAULT 'menu'
SET @sql := IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA=@db AND TABLE_NAME='menus' AND COLUMN_NAME='menu_type'),
  'SELECT 1',
  "ALTER TABLE `menus` ADD COLUMN `menu_type` ENUM('menu','button','link') DEFAULT 'menu' AFTER `level`;"
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- permission_code VARCHAR(100) NULL
SET @sql := IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA=@db AND TABLE_NAME='menus' AND COLUMN_NAME='permission_code'),
  'SELECT 1',
  'ALTER TABLE `menus` ADD COLUMN `permission_code` VARCHAR(100) NULL AFTER `menu_type`;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- redirect VARCHAR(200) NULL
SET @sql := IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA=@db AND TABLE_NAME='menus' AND COLUMN_NAME='redirect'),
  'SELECT 1',
  'ALTER TABLE `menus` ADD COLUMN `redirect` VARCHAR(200) NULL AFTER `permission_code`;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- meta JSON NULL  （MySQL 5.7.8+ 支持 JSON；若更低版本，请把 JSON 改成 TEXT）
SET @sql := IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA=@db AND TABLE_NAME='menus' AND COLUMN_NAME='meta'),
  'SELECT 1',
  'ALTER TABLE `menus` ADD COLUMN `meta` JSON NULL AFTER `redirect`;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- is_disabled TINYINT(1) NOT NULL DEFAULT 0
SET @sql := IF(
  EXISTS(SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA=@db AND TABLE_NAME='menus' AND COLUMN_NAME='is_disabled'),
  'SELECT 1',
  'ALTER TABLE `menus` ADD COLUMN `is_disabled` TINYINT(1) NOT NULL DEFAULT 0 AFTER `meta`;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
