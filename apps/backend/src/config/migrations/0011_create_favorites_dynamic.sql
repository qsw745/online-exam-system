-- 0011_create_favorites_dynamic.sql
-- 根据实际列类型创建/修复 favorites 表并补外键，避免 UNSIGNED/宽度不一致导致的外键报错

SET NAMES utf8mb4;

-- 先用一个通用定义，若表不存在则创建（含外键；后面仍会按实际类型再对齐一次）
CREATE TABLE IF NOT EXISTS `favorites` (
  `id` INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT            NOT NULL,        -- 与 users(id) 一致：INT（有符号）
  `question_id` INT        NOT NULL,        -- 与 questions(id) 一致：INT（有符号）
  `category_id` INT UNSIGNED NULL,
  `created_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY `uniq_user_question` (`user_id`,`question_id`),
  INDEX `idx_fav_user`(`user_id`),
  INDEX `idx_fav_question`(`question_id`),
  INDEX `idx_fav_category`(`category_id`),

  CONSTRAINT `fk_fav_user`
    FOREIGN KEY (`user_id`)     REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fav_question`
    FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fav_category`
    FOREIGN KEY (`category_id`) REFERENCES `favorite_categories`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 读取被引用列实际类型
SET @users_id_type := (
  SELECT COLUMN_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='users' AND COLUMN_NAME='id'
);

SET @questions_id_type := (
  SELECT COLUMN_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='questions' AND COLUMN_NAME='id'
);

SET @fc_id_type := (
  SELECT COLUMN_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='favorite_categories' AND COLUMN_NAME='id'
);

-- 若 favorites 不存在则创建一个不含外键的通用表（幂等）
SET @favorites_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='favorites'
);
SET @sql := IF(@favorites_exists>0,
  'SELECT 1',
  'CREATE TABLE `favorites` (
     `id` INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
     `user_id` INT NOT NULL,
     `question_id` INT NOT NULL,
     `category_id` INT NULL,
     `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
     UNIQUE KEY `uniq_user_question` (`user_id`,`question_id`)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 将列类型对齐为被引用列的 COLUMN_TYPE
SET @sql := CONCAT('ALTER TABLE `favorites` MODIFY COLUMN `user_id` ', @users_id_type, ' NOT NULL;');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := CONCAT('ALTER TABLE `favorites` MODIFY COLUMN `question_id` ', @questions_id_type, ' NOT NULL;');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

SET @sql := IF(@fc_id_type IS NULL,
  'SELECT 1',
  CONCAT('ALTER TABLE `favorites` MODIFY COLUMN `category_id` ', @fc_id_type, ' NULL;')
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 补必要索引（如果没有）
-- idx_fav_user
SET @idx := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='favorites' AND INDEX_NAME='idx_fav_user'
);
SET @sql := IF(@idx>0,'SELECT 1','CREATE INDEX `idx_fav_user` ON `favorites`(`user_id`);');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- idx_fav_question
SET @idx := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='favorites' AND INDEX_NAME='idx_fav_question'
);
SET @sql := IF(@idx>0,'SELECT 1','CREATE INDEX `idx_fav_question` ON `favorites`(`question_id`);');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- idx_fav_category
SET @idx := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='favorites' AND INDEX_NAME='idx_fav_category'
);
SET @sql := IF(@idx>0,'SELECT 1','CREATE INDEX `idx_fav_category` ON `favorites`(`category_id`);');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 仅在不存在时添加外键（避免重复执行出错）
-- fk_fav_user
SET @fk := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME='fk_fav_user'
);
SET @sql := IF(@fk>0,'SELECT 1',
  'ALTER TABLE `favorites` ADD CONSTRAINT `fk_fav_user`
     FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- fk_fav_question
SET @fk := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME='fk_fav_question'
);
SET @sql := IF(@fk>0,'SELECT 1',
  'ALTER TABLE `favorites` ADD CONSTRAINT `fk_fav_question`
     FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE CASCADE;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- fk_fav_category
SET @fk := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME='fk_fav_category'
);
SET @sql := IF(@fk>0,'SELECT 1',
  'ALTER TABLE `favorites` ADD CONSTRAINT `fk_fav_category`
     FOREIGN KEY (`category_id`) REFERENCES `favorite_categories`(`id`) ON DELETE SET NULL;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
