-- 0010_optional_modules.sql
-- 补齐收藏夹、讨论区、排行榜等表；所有指向 users(id) 的列统一为 INT（有符号）

SET NAMES utf8mb4;
SET @db := DATABASE();

/*****************************************************************
 * 题库：补充 questions.explanation
 *****************************************************************/
SET @col_exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='questions' AND COLUMN_NAME='explanation'
);
SET @sql := IF(@col_exists>0,
  'SELECT 1',
  'ALTER TABLE `questions` ADD COLUMN `explanation` TEXT NULL AFTER `correct_answer`;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

/*****************************************************************
 * 收藏夹：分类 + 收藏
 *****************************************************************/
CREATE TABLE IF NOT EXISTS `favorite_categories` (
  `id` INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL,                     -- ← 有符号 INT
  `name` VARCHAR(100) NOT NULL,
  `sort_order` INT NOT NULL DEFAULT 1,
  `is_default` TINYINT(1) NOT NULL DEFAULT 0,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_fc_user`(`user_id`),
  CONSTRAINT `fk_fc_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `favorites` (
  `id` INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL,                     -- ← 有符号 INT
 `question_id` INT NOT NULL,

  `category_id` INT UNSIGNED NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uniq_user_question` (`user_id`,`question_id`),
  INDEX `idx_fav_user`(`user_id`),
  INDEX `idx_fav_question`(`question_id`),
  INDEX `idx_fav_category`(`category_id`),
  CONSTRAINT `fk_fav_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fav_question` FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fav_category` FOREIGN KEY (`category_id`) REFERENCES `favorite_categories`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*****************************************************************
 * 讨论区：分类 + 话题
 *****************************************************************/
CREATE TABLE IF NOT EXISTS `discussion_categories` (
  `id` INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `color` VARCHAR(20) NULL,
  `sort_order` INT NOT NULL DEFAULT 1,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `discussions` (
  `id` INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT NOT NULL,                     -- ← 有符号 INT
  `category_id` INT UNSIGNED NULL,
  `title` VARCHAR(200) NOT NULL,
  `content` TEXT NOT NULL,
  `is_pinned` TINYINT(1) NOT NULL DEFAULT 0,
  `last_reply_at` DATETIME NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_disc_user`(`user_id`),
  INDEX `idx_disc_category`(`category_id`),
  INDEX `idx_disc_last_reply`(`last_reply_at`),
  CONSTRAINT `fk_disc_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_disc_category` FOREIGN KEY (`category_id`) REFERENCES `discussion_categories`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

/*****************************************************************
 * 排行榜
 *****************************************************************/
CREATE TABLE IF NOT EXISTS `leaderboards` (
  `id` INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `type` VARCHAR(50) NULL,
  `period` VARCHAR(50) NULL,
  `is_active` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 兼容：有的 MySQL 不支持 CREATE INDEX IF NOT EXISTS，做个判断
SET @idx := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='leaderboards' AND INDEX_NAME='idx_leaderboards_active'
);
SET @sql := IF(@idx>0,'SELECT 1','CREATE INDEX `idx_leaderboards_active` ON `leaderboards`(`is_active`);');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @idx := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA=@db AND TABLE_NAME='leaderboards' AND INDEX_NAME='idx_leaderboards_created_at'
);
SET @sql := IF(@idx>0,'SELECT 1','CREATE INDEX `idx_leaderboards_created_at` ON `leaderboards`(`created_at`);');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
