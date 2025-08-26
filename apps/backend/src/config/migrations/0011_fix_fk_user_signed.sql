-- 0011_fix_fk_user_signed.sql
-- 目标：所有引用 users(id) 的外键列改为 INT（有符号），避免与 users.id (INT) 不兼容
SET NAMES utf8mb4;

-- ---------- favorite_categories.user_id -> INT (signed) ----------
-- 1) 如果外键存在就先删
SET @cnt := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'favorite_categories'
    AND CONSTRAINT_NAME = 'fk_fc_user'
);
SET @sql := IF(@cnt>0,
  'ALTER TABLE `favorite_categories` DROP FOREIGN KEY `fk_fc_user`;',
  'SELECT 1'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 2) 只有当列是 unsigned 或非 int 时才改为 INT（有符号）
SET @need_alter := (
  SELECT CASE
           WHEN DATA_TYPE='int' AND COLUMN_TYPE NOT LIKE '%unsigned%' THEN 0
           ELSE 1
         END
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'favorite_categories'
    AND COLUMN_NAME = 'user_id'
  LIMIT 1
);
SET @sql := IF(@need_alter=1,
  'ALTER TABLE `favorite_categories` MODIFY `user_id` INT NOT NULL;',
  'SELECT 1'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 3) 重新加外键
ALTER TABLE `favorite_categories`
  ADD CONSTRAINT `fk_fc_user`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE;

-- ---------- favorites.user_id -> INT (signed) ----------
-- 1) 删外键（如果存在）
SET @cnt := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'favorites'
    AND CONSTRAINT_NAME = 'fk_fav_user'
);
SET @sql := IF(@cnt>0,
  'ALTER TABLE `favorites` DROP FOREIGN KEY `fk_fav_user`;',
  'SELECT 1'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 2) 改列为 INT（有符号）只在需要时
SET @need_alter := (
  SELECT CASE
           WHEN DATA_TYPE='int' AND COLUMN_TYPE NOT LIKE '%unsigned%' THEN 0
           ELSE 1
         END
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'favorites'
    AND COLUMN_NAME = 'user_id'
  LIMIT 1
);
SET @sql := IF(@need_alter=1,
  'ALTER TABLE `favorites` MODIFY `user_id` INT NOT NULL;',
  'SELECT 1'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 3) 重新加外键
ALTER TABLE `favorites`
  ADD CONSTRAINT `fk_fav_user`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE;

-- ---------- discussions.user_id -> INT (signed) ----------
-- 1) 删外键（如果存在）
SET @cnt := (
  SELECT COUNT(1)
  FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND TABLE_NAME = 'discussions'
    AND CONSTRAINT_NAME = 'fk_disc_user'
);
SET @sql := IF(@cnt>0,
  'ALTER TABLE `discussions` DROP FOREIGN KEY `fk_disc_user`;',
  'SELECT 1'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 2) 改列为 INT（有符号）只在需要时
SET @need_alter := (
  SELECT CASE
           WHEN DATA_TYPE='int' AND COLUMN_TYPE NOT LIKE '%unsigned%' THEN 0
           ELSE 1
         END
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'discussions'
    AND COLUMN_NAME = 'user_id'
  LIMIT 1
);
SET @sql := IF(@need_alter=1,
  'ALTER TABLE `discussions` MODIFY `user_id` INT NOT NULL;',
  'SELECT 1'
);
PREPARE s FROM @sql; EXECUTE s; DEALLOCATE PREPARE s;

-- 3) 重新加外键
ALTER TABLE `discussions`
  ADD CONSTRAINT `fk_disc_user`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE;
