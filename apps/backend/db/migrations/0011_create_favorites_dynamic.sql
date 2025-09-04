-- 0011_create_favorites_dynamic.sql
-- 根据实际列类型创建/修复 favorites 表并补外键，避免 UNSIGNED/宽度不一致导致的外键报错
-- 修正：统一 INFORMATION_SCHEMA 比较时的字符序（collation），避免 Illegal mix of collations

SET NAMES utf8mb4;

-- 统一当前库名在 utf8mb3_general_ci 下做比较
SET @db  := DATABASE();
SET @dbc := CONVERT(@db USING utf8mb3) COLLATE utf8mb3_general_ci;

-- ========= 0) 若不存在，最小化创建 favorite_categories（可选，保证外键引用目标存在）=========
SET @fc_exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.TABLES
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME = 'favorite_categories'
);
SET @sql := IF(@fc_exists>0, 'SELECT 1',
  'CREATE TABLE `favorite_categories` (
     `id` INT PRIMARY KEY AUTO_INCREMENT,
     `name` VARCHAR(100) NOT NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ========= 1) 若 favorites 不存在则创建“最小表”（不含约束；列集合完整）=========
SET @favorites_exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.TABLES
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME = 'favorites'
);
SET @sql := IF(@favorites_exists>0, 'SELECT 1',
  'CREATE TABLE `favorites` (
     `id` INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
     `user_id` INT NULL,
     `question_id` INT NULL,
     `category_id` INT NULL,
     `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ========= 2) 确保需要的列都存在（兼容旧结构缺列情况）=========
-- user_id
SET @has_user := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='favorites' AND COLUMN_NAME='user_id'
);
SET @sql := IF(@has_user>0, 'SELECT 1',
  'ALTER TABLE `favorites` ADD COLUMN `user_id` INT NULL;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- question_id
SET @has_q := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='favorites' AND COLUMN_NAME='question_id'
);
SET @sql := IF(@has_q>0, 'SELECT 1',
  'ALTER TABLE `favorites` ADD COLUMN `question_id` INT NULL;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- category_id
SET @has_cat := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='favorites' AND COLUMN_NAME='category_id'
);
SET @sql := IF(@has_cat>0, 'SELECT 1',
  'ALTER TABLE `favorites` ADD COLUMN `category_id` INT NULL;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ========= 3) 读取被引用列实际类型，并将 favorites.*_id 对齐 =========
SET @users_id_type := (
  SELECT COLUMN_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='users' AND COLUMN_NAME='id'
);
SET @questions_id_type := (
  SELECT COLUMN_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='questions' AND COLUMN_NAME='id'
);
SET @fc_id_type := (
  SELECT COLUMN_TYPE
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='favorite_categories' AND COLUMN_NAME='id'
);

-- 对齐 user_id（若 users.id 类型未知则兜底 INT）
SET @sql := CONCAT(
  'ALTER TABLE `favorites` MODIFY COLUMN `user_id` ',
  IFNULL(@users_id_type, 'INT'), ' NOT NULL;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 对齐 question_id（若 questions.id 类型未知则兜底 INT）
SET @sql := CONCAT(
  'ALTER TABLE `favorites` MODIFY COLUMN `question_id` ',
  IFNULL(@questions_id_type, 'INT'), ' NOT NULL;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 对齐 category_id（只有在 favorite_categories.id 存在时才对齐，否则保留为可空 INT）
SET @sql := IF(@fc_id_type IS NULL,
  'SELECT 1',
  CONCAT('ALTER TABLE `favorites` MODIFY COLUMN `category_id` ', @fc_id_type, ' NULL;')
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ========= 4) 唯一键 & 索引（存在性判断，避免重复创建）=========
-- 唯一键 uniq_user_question（user_id, question_id）
SET @idx := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='favorites' AND INDEX_NAME='uniq_user_question'
);
SET @sql := IF(@idx>0, 'SELECT 1',
  'ALTER TABLE `favorites` ADD UNIQUE KEY `uniq_user_question` (`user_id`,`question_id`);'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- idx_fav_user
SET @idx := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='favorites' AND INDEX_NAME='idx_fav_user'
);
SET @sql := IF(@idx>0,'SELECT 1','CREATE INDEX `idx_fav_user` ON `favorites`(`user_id`);');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- idx_fav_question
SET @idx := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='favorites' AND INDEX_NAME='idx_fav_question'
);
SET @sql := IF(@idx>0,'SELECT 1','CREATE INDEX `idx_fav_question` ON `favorites`(`question_id`);');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- idx_fav_category（仅当 category_id 列存在时考虑）
SET @idx := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.STATISTICS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='favorites' AND INDEX_NAME='idx_fav_category'
);
SET @sql := IF(@has_cat=0, 'SELECT 1',
  IF(@idx>0,'SELECT 1','CREATE INDEX `idx_fav_category` ON `favorites`(`category_id`);')
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- ========= 5) 外键（存在性判断 + 仅当被引用表存在时添加）=========
-- fk_fav_user
SET @fk := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONVERT(CONSTRAINT_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND CONSTRAINT_NAME='fk_fav_user'
);
SET @users_exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.TABLES
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='users'
);
SET @sql := IF(@fk>0 OR @users_exists=0, 'SELECT 1',
  'ALTER TABLE `favorites`
     ADD CONSTRAINT `fk_fav_user`
     FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
     ON DELETE CASCADE;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- fk_fav_question
SET @fk := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONVERT(CONSTRAINT_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND CONSTRAINT_NAME='fk_fav_question'
);
SET @questions_exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.TABLES
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='questions'
);
SET @sql := IF(@fk>0 OR @questions_exists=0, 'SELECT 1',
  'ALTER TABLE `favorites`
     ADD CONSTRAINT `fk_fav_question`
     FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`)
     ON DELETE CASCADE;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- fk_fav_category（仅当列存在且 favorite_categories 存在时添加）
SET @fk := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONVERT(CONSTRAINT_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND CONSTRAINT_NAME='fk_fav_category'
);
SET @sql := IF(@fk>0 OR @has_cat=0 OR @fc_exists=0, 'SELECT 1',
  'ALTER TABLE `favorites`
     ADD CONSTRAINT `fk_fav_category`
     FOREIGN KEY (`category_id`) REFERENCES `favorite_categories`(`id`)
     ON DELETE SET NULL;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
