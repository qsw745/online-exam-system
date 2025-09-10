-- 可选：切库
-- USE your_database_name;

-- 兜底：如果没有 discussions 表就创建（有的话不会覆盖）
CREATE TABLE IF NOT EXISTS `discussions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NOT NULL,
  `category_id` INT NULL,
  `title` VARCHAR(200) NOT NULL,
  `content` MEDIUMTEXT NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_discussions_cat` (`category_id`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ====== 按需补齐列（兼容 5.7 无 ADD COLUMN IF NOT EXISTS）======
SET @tbl := 'discussions';

-- tags（前端已 JSON.stringify，这里用 TEXT 存）
SET @sql := (
  SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=@tbl AND COLUMN_NAME='tags'),
            'SELECT 1',
            'ALTER TABLE `discussions` ADD COLUMN `tags` TEXT NULL AFTER `content`')
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 关联信息
SET @sql := (
  SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=@tbl AND COLUMN_NAME='related_type'),
            'SELECT 1',
            'ALTER TABLE `discussions` ADD COLUMN `related_type` VARCHAR(20) NOT NULL DEFAULT ''general'' AFTER `tags`')
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (
  SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=@tbl AND COLUMN_NAME='related_id'),
            'SELECT 1',
            'ALTER TABLE `discussions` ADD COLUMN `related_id` INT NULL AFTER `related_type`')
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 状态开关
SET @sql := (
  SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=@tbl AND COLUMN_NAME='is_pinned'),
            'SELECT 1',
            'ALTER TABLE `discussions` ADD COLUMN `is_pinned` TINYINT(1) NOT NULL DEFAULT 0 AFTER `related_id`')
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (
  SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=@tbl AND COLUMN_NAME='is_locked'),
            'SELECT 1',
            'ALTER TABLE `discussions` ADD COLUMN `is_locked` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_pinned`')
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (
  SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=@tbl AND COLUMN_NAME='is_featured'),
            'SELECT 1',
            'ALTER TABLE `discussions` ADD COLUMN `is_featured` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_locked`')
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 计数 & 最近回复
SET @sql := (
  SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=@tbl AND COLUMN_NAME='view_count'),
            'SELECT 1',
            'ALTER TABLE `discussions` ADD COLUMN `view_count` INT NOT NULL DEFAULT 0 AFTER `is_featured`')
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (
  SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=@tbl AND COLUMN_NAME='reply_count'),
            'SELECT 1',
            'ALTER TABLE `discussions` ADD COLUMN `reply_count` INT NOT NULL DEFAULT 0 AFTER `view_count`')
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (
  SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=@tbl AND COLUMN_NAME='like_count'),
            'SELECT 1',
            'ALTER TABLE `discussions` ADD COLUMN `like_count` INT NOT NULL DEFAULT 0 AFTER `reply_count`')
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (
  SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=@tbl AND COLUMN_NAME='last_reply_at'),
            'SELECT 1',
            'ALTER TABLE `discussions` ADD COLUMN `last_reply_at` DATETIME NULL AFTER `like_count`')
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := (
  SELECT IF(EXISTS(SELECT 1 FROM information_schema.COLUMNS
                   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=@tbl AND COLUMN_NAME='last_reply_user_id'),
            'SELECT 1',
            'ALTER TABLE `discussions` ADD COLUMN `last_reply_user_id` INT NULL AFTER `last_reply_at`')
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 索引（按需创建）
SET @need := (
  SELECT COUNT(*) = 0 FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME=@tbl AND INDEX_NAME='idx_discussions_sort'
);
SET @sql := IF(@need,
  'CREATE INDEX `idx_discussions_sort` ON `discussions`(`is_pinned`, `last_reply_at`, `created_at`)', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ====== 分类表也保证可用（用于前端下拉）======
CREATE TABLE IF NOT EXISTS `discussion_categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) NULL,
  `icon` VARCHAR(100) NULL,
  `color` VARCHAR(20) NULL,
  `sort_order` INT NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 基础分类（不存在才插入）
INSERT INTO discussion_categories (name, description, icon, color, sort_order, is_active)
SELECT '学习求助', '学习/作业相关问题求助', 'help-circle', '#1677ff', 1, 1
WHERE NOT EXISTS (SELECT 1 FROM discussion_categories WHERE name='学习求助');

INSERT INTO discussion_categories (name, description, icon, color, sort_order, is_active)
SELECT '经验分享', '备考/学习经验与资料分享', 'share-2', '#52c41a', 2, 1
WHERE NOT EXISTS (SELECT 1 FROM discussion_categories WHERE name='经验分享');

INSERT INTO discussion_categories (name, description, icon, color, sort_order, is_active)
SELECT '题目讨论', '针对具体题目的讨论', 'message-square', '#faad14', 3, 1
WHERE NOT EXISTS (SELECT 1 FROM discussion_categories WHERE name='题目讨论');
