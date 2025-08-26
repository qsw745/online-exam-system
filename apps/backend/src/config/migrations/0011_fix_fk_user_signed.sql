-- 0011_fix_fk_user_signed.sql
-- 目标：将所有引用 users(id) 的外键列统一为 INT（有符号），在缺列时自动补列；
--       所有操作做存在性判断，可重复执行；统一 INFORMATION_SCHEMA 比较的 collation。

SET NAMES utf8mb4;

-- 统一当前库名在 utf8mb3_general_ci 下做比较，避免 Illegal mix of collations
SET @db  := DATABASE();
SET @dbc := CONVERT(@db USING utf8mb3) COLLATE utf8mb3_general_ci;

-- =========================
-- 通用辅助：判断表是否存在
-- =========================
-- favorite_categories 存在吗
SET @fc_tbl_exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.TABLES
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='favorite_categories'
);
-- favorites 存在吗
SET @fav_tbl_exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.TABLES
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='favorites'
);
-- discussions 存在吗
SET @disc_tbl_exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.TABLES
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='discussions'
);
-- users 存在吗
SET @users_tbl_exists := (
  SELECT COUNT(1) FROM INFORMATION_SCHEMA.TABLES
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='users'
);

-- =========================
-- 1) favorite_categories.user_id → INT（有符号），并建立外键 fk_fc_user
-- =========================
-- 若表存在才处理
SET @sql := IF(@fc_tbl_exists=0, 'SELECT 1', 'SELECT 1');
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 1.1 列不存在则新增（为避免历史数据约束问题，这里先用 NULL；有需要你再改为 NOT NULL）
SET @col_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='favorite_categories'
    AND COLUMN_NAME='user_id'
);
SET @sql := IF(@fc_tbl_exists=0, 'SELECT 1',
  IF(@col_exists>0, 'SELECT 1',
     'ALTER TABLE `favorite_categories` ADD COLUMN `user_id` INT NULL;'
  )
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 1.2 若列类型不是 INT（有符号），则改为 INT（有符号）
SET @need_alter := (
  SELECT CASE
           WHEN DATA_TYPE='int' AND COLUMN_TYPE NOT LIKE '%unsigned%' THEN 0
           ELSE 1
         END
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='favorite_categories'
    AND COLUMN_NAME='user_id'
  LIMIT 1
);
SET @sql := IF(@fc_tbl_exists=0 OR @col_exists=0, 'SELECT 1',
  IF(@need_alter=1, 'ALTER TABLE `favorite_categories` MODIFY `user_id` INT NULL;', 'SELECT 1')
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 1.3 删已有外键（如有）
SET @fk_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONVERT(CONSTRAINT_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND CONSTRAINT_NAME='fk_fc_user'
);
SET @sql := IF(@fc_tbl_exists=0, 'SELECT 1',
  IF(@fk_exists>0, 'ALTER TABLE `favorite_categories` DROP FOREIGN KEY `fk_fc_user`;', 'SELECT 1')
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 1.4 仅当 users 表存在时，加回外键
SET @sql := IF(@fc_tbl_exists=0 OR @users_tbl_exists=0, 'SELECT 1',
  'ALTER TABLE `favorite_categories`
     ADD CONSTRAINT `fk_fc_user`
     FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
     ON DELETE CASCADE;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- =========================
-- 2) favorites.user_id → INT（有符号），并建立外键 fk_fav_user
-- =========================
-- 2.1 删已有外键（如有）
SET @fk_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONVERT(CONSTRAINT_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND CONSTRAINT_NAME='fk_fav_user'
);
SET @sql := IF(@fav_tbl_exists=0, 'SELECT 1',
  IF(@fk_exists>0,'ALTER TABLE `favorites` DROP FOREIGN KEY `fk_fav_user`;','SELECT 1')
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 2.2 若 favorites.user_id 列不存在则补列
SET @col_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='favorites'
    AND COLUMN_NAME='user_id'
);
SET @sql := IF(@fav_tbl_exists=0, 'SELECT 1',
  IF(@col_exists>0,'SELECT 1','ALTER TABLE `favorites` ADD COLUMN `user_id` INT NULL;')
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 2.3 需要时改为 INT（有符号）
SET @need_alter := (
  SELECT CASE
           WHEN DATA_TYPE='int' AND COLUMN_TYPE NOT LIKE '%unsigned%' THEN 0
           ELSE 1
         END
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='favorites'
    AND COLUMN_NAME='user_id'
  LIMIT 1
);
SET @sql := IF(@fav_tbl_exists=0 OR @col_exists=0, 'SELECT 1',
  IF(@need_alter=1,'ALTER TABLE `favorites` MODIFY `user_id` INT NOT NULL;','SELECT 1')
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 2.4 加回外键（仅当 users 存在）
SET @sql := IF(@fav_tbl_exists=0 OR @users_tbl_exists=0, 'SELECT 1',
  'ALTER TABLE `favorites`
     ADD CONSTRAINT `fk_fav_user`
     FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
     ON DELETE CASCADE;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- =========================
-- 3) discussions.user_id → INT（有符号），并建立外键 fk_disc_user
-- =========================
-- 3.1 删已有外键（如有）
SET @fk_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONVERT(CONSTRAINT_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND CONSTRAINT_NAME='fk_disc_user'
);
SET @sql := IF(@disc_tbl_exists=0, 'SELECT 1',
  IF(@fk_exists>0,'ALTER TABLE `discussions` DROP FOREIGN KEY `fk_disc_user`;','SELECT 1')
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 3.2 若 discussions.user_id 列不存在则补列
SET @col_exists := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='discussions'
    AND COLUMN_NAME='user_id'
);
SET @sql := IF(@disc_tbl_exists=0, 'SELECT 1',
  IF(@col_exists>0,'SELECT 1','ALTER TABLE `discussions` ADD COLUMN `user_id` INT NULL;')
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 3.3 需要时改为 INT（有符号）
SET @need_alter := (
  SELECT CASE
           WHEN DATA_TYPE='int' AND COLUMN_TYPE NOT LIKE '%unsigned%' THEN 0
           ELSE 1
         END
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE CONVERT(TABLE_SCHEMA USING utf8mb3) COLLATE utf8mb3_general_ci = @dbc
    AND TABLE_NAME='discussions'
    AND COLUMN_NAME='user_id'
  LIMIT 1
);
SET @sql := IF(@disc_tbl_exists=0 OR @col_exists=0, 'SELECT 1',
  IF(@need_alter=1,'ALTER TABLE `discussions` MODIFY `user_id` INT NULL;','SELECT 1')
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 3.4 加回外键（仅当 users 存在）
SET @sql := IF(@disc_tbl_exists=0 OR @users_tbl_exists=0, 'SELECT 1',
  'ALTER TABLE `discussions`
     ADD CONSTRAINT `fk_disc_user`
     FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
     ON DELETE CASCADE;'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;
