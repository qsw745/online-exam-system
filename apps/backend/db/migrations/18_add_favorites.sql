-- ========== 切换到你的业务库 ==========
-- USE your_database_name;

-- ========== favorites：列 ==========
SET @tbl := 'favorites';

-- description
SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = @tbl AND COLUMN_NAME = 'description'),
    'SELECT 1', 'ALTER TABLE `favorites` ADD COLUMN `description` TEXT NULL AFTER `name`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- is_public
SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = @tbl AND COLUMN_NAME = 'is_public'),
    'SELECT 1', 'ALTER TABLE `favorites` ADD COLUMN `is_public` TINYINT(1) NOT NULL DEFAULT 0 AFTER `description`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- category_id
SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = @tbl AND COLUMN_NAME = 'category_id'),
    'SELECT 1', 'ALTER TABLE `favorites` ADD COLUMN `category_id` INT NULL AFTER `is_public`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- created_at
SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = @tbl AND COLUMN_NAME = 'created_at'),
    'SELECT 1', 'ALTER TABLE `favorites` ADD COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- updated_at
SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = @tbl AND COLUMN_NAME = 'updated_at'),
    'SELECT 1', 'ALTER TABLE `favorites` ADD COLUMN `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========== favorite_items：列 ==========
SET @tbl := 'favorite_items';

-- title
SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = @tbl AND COLUMN_NAME = 'title'),
    'SELECT 1', 'ALTER TABLE `favorite_items` ADD COLUMN `title` VARCHAR(255) NOT NULL DEFAULT '''' AFTER `item_id`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- description
SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = @tbl AND COLUMN_NAME = 'description'),
    'SELECT 1', 'ALTER TABLE `favorite_items` ADD COLUMN `description` TEXT NULL AFTER `title`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- tags（JSON；若你的 5.7 版本不支持 JSON，可把 `JSON` 改为 `TEXT`）
SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = @tbl AND COLUMN_NAME = 'tags'),
    'SELECT 1', 'ALTER TABLE `favorite_items` ADD COLUMN `tags` JSON NULL AFTER `description`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- notes
SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = @tbl AND COLUMN_NAME = 'notes'),
    'SELECT 1', 'ALTER TABLE `favorite_items` ADD COLUMN `notes` TEXT NULL AFTER `tags`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- sort_order
SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = @tbl AND COLUMN_NAME = 'sort_order'),
    'SELECT 1', 'ALTER TABLE `favorite_items` ADD COLUMN `sort_order` INT NOT NULL DEFAULT 0 AFTER `notes`'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- created_at
SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = @tbl AND COLUMN_NAME = 'created_at'),
    'SELECT 1', 'ALTER TABLE `favorite_items` ADD COLUMN `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- updated_at
SET @sql := (
  SELECT IF(
    EXISTS(SELECT 1 FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE()
             AND TABLE_NAME = @tbl AND COLUMN_NAME = 'updated_at'),
    'SELECT 1', 'ALTER TABLE `favorite_items` ADD COLUMN `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
  )
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ========== 索引（5.7 无 IF NOT EXISTS：先判断再创建） ==========
-- favorites(user_id, updated_at)
SET @need := (
  SELECT COUNT(*) = 0 FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'favorites'
     AND INDEX_NAME = 'idx_favorites_user'
);
SET @sql := IF(@need, 'CREATE INDEX `idx_favorites_user` ON `favorites`(`user_id`, `updated_at`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- favorite_items(favorite_id, sort_order)
SET @need := (
  SELECT COUNT(*) = 0 FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'favorite_items'
     AND INDEX_NAME = 'idx_fi_fav'
);
SET @sql := IF(@need, 'CREATE INDEX `idx_fi_fav` ON `favorite_items`(`favorite_id`, `sort_order`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- favorite_items(favorite_id, item_type, item_id)
SET @need := (
  SELECT COUNT(*) = 0 FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE()
     AND TABLE_NAME = 'favorite_items'
     AND INDEX_NAME = 'idx_fi_lookup'
);
SET @sql := IF(@need, 'CREATE INDEX `idx_fi_lookup` ON `favorite_items`(`favorite_id`, `item_type`, `item_id`)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

ALTER TABLE `favorites`
  MODIFY COLUMN `question_id` INT NULL DEFAULT NULL;

-- 如表不存在则创建
CREATE TABLE IF NOT EXISTS `favorite_categories` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(64) NOT NULL,
  `color` VARCHAR(16) NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 如缺少 color 列则补齐
ALTER TABLE `favorite_categories`
  ADD COLUMN `color` VARCHAR(16) NULL AFTER `name`;
