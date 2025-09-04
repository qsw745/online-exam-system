-- 0011_create_favorites.sql
-- 创建收藏夹分类 + 收藏表，并确保与 users.id / questions.id 类型匹配
SET NAMES utf8mb4;

-- 分类表
CREATE TABLE IF NOT EXISTS `favorite_categories` (
  `id` INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT            NOT NULL,        -- 与 users.id 一致（你的 users.id 是 INT 有符号）
  `name` VARCHAR(100)      NOT NULL,
  `sort_order` INT         NOT NULL DEFAULT 1,
  `is_default` TINYINT(1)  NOT NULL DEFAULT 0,
  `is_active`  TINYINT(1)  NOT NULL DEFAULT 1,
  `created_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX `idx_fc_user`(`user_id`),
  CONSTRAINT `fk_fc_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 收藏表
CREATE TABLE IF NOT EXISTS `favorites` (
  `id` INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  `user_id` INT            NOT NULL,        -- 与 users.id 一致（INT）
  `question_id` INT        NOT NULL,        -- 与 questions.id 一致（INT）
  `category_id` INT UNSIGNED NULL,
  `created_at` DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,

  UNIQUE KEY `uniq_user_question` (`user_id`,`question_id`),
  INDEX `idx_fav_user`(`user_id`),
  INDEX `idx_fav_question`(`question_id`),
  INDEX `idx_fav_category`(`category_id`),

  CONSTRAINT `fk_fav_user`     FOREIGN KEY (`user_id`)    REFERENCES `users`(`id`)               ON DELETE CASCADE,
  CONSTRAINT `fk_fav_question` FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`)           ON DELETE CASCADE,
  CONSTRAINT `fk_fav_category` FOREIGN KEY (`category_id`) REFERENCES `favorite_categories`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
