-- 0001_base_schema.sql — 基线结构（已按现有 users / roles 类型对齐）
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- 这里不再重建 users / roles，它们已经存在
-- users.id     = INT            (SIGNED)
-- roles.id     = INT UNSIGNED   (UNSIGNED)

-- 菜单表（新建，自定为 INT；后续引用它的 menu_id 也用 INT）
CREATE TABLE IF NOT EXISTS menus (
  id         INT PRIMARY KEY AUTO_INCREMENT,
  name       VARCHAR(100) NOT NULL,
  title      VARCHAR(100) NOT NULL,
  path       VARCHAR(200) NULL,
  icon       VARCHAR(50)  NULL,
  parent_id  INT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_parent (parent_id),
  CONSTRAINT fk_menus_parent FOREIGN KEY (parent_id) REFERENCES menus(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户-角色关系（类型对齐：role_id → INT UNSIGNED，user_id → INT）
CREATE TABLE IF NOT EXISTS role_users (
  role_id     INT UNSIGNED NOT NULL,  -- 对齐 roles.id
  user_id     INT NOT NULL,           -- 对齐 users.id
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(role_id, user_id),
  CONSTRAINT fk_ru_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_ru_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 角色-菜单关系（role_id → INT UNSIGNED，menu_id → INT）
CREATE TABLE IF NOT EXISTS role_menus (
  role_id INT UNSIGNED NOT NULL,      -- 对齐 roles.id
  menu_id INT NOT NULL,               -- 对齐 menus.id
  PRIMARY KEY(role_id, menu_id),
  CONSTRAINT fk_rm_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_rm_menu FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 登录日志（user_id → INT）
CREATE TABLE IF NOT EXISTS login_logs (
  id             BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id        INT NULL,            -- 对齐 users.id
  username       VARCHAR(100) NULL,
  status         ENUM('success','failed') NOT NULL,
  failure_reason VARCHAR(255) NULL,
  ip_address     VARCHAR(45) NULL,
  user_agent     VARCHAR(255) NULL,
  created_at     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  CONSTRAINT fk_ll_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
