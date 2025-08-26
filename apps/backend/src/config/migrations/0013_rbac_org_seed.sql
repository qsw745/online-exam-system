-- 0013_rbac_org_seed.sql
SET NAMES utf8mb4;
SET @db := DATABASE();

/*****************************************************************
 * A) 基础字典与默认机构/角色/菜单
 *****************************************************************/

-- 1) 默认组织（机构）
INSERT INTO organizations (name, code, parent_id, is_active, created_at, updated_at)
VALUES ('默认机构', 'default', NULL, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  name=VALUES(name), is_active=VALUES(is_active), updated_at=VALUES(updated_at);

-- 拿到默认机构ID
SET @org_default_id := (
  SELECT id FROM organizations WHERE code='default' LIMIT 1
);

-- 2) 角色（admin/teacher/student）
INSERT INTO roles (name, code, is_system, is_disabled, sort_order, created_at, updated_at) VALUES
('管理员','admin',1,0,1,NOW(),NOW()),
('教师','teacher',1,0,2,NOW(),NOW()),
('学生','student',1,0,3,NOW(),NOW())
ON DUPLICATE KEY UPDATE
  name=VALUES(name),
  is_system=VALUES(is_system),
  is_disabled=VALUES(is_disabled),
  sort_order=VALUES(sort_order),
  updated_at=VALUES(updated_at);

-- 角色ID们
SET @role_admin_id   := (SELECT id FROM roles WHERE code='admin'   LIMIT 1);
SET @role_teacher_id := (SELECT id FROM roles WHERE code='teacher' LIMIT 1);
SET @role_student_id := (SELECT id FROM roles WHERE code='student' LIMIT 1);

-- 3) 菜单（最小可用：仪表盘、题目练习、机构管理）
-- parent 菜单（系统管理，可选）
INSERT INTO menus (name, title, path, icon, parent_id, is_hidden, sort_order, created_at, updated_at)
VALUES ('system', '系统管理', '/admin', 'Settings', NULL, 0, 900, NOW(), NOW())
ON DUPLICATE KEY UPDATE title=VALUES(title), path=VALUES(path), icon=VALUES(icon), updated_at=VALUES(updated_at);

SET @menu_system_id := (SELECT id FROM menus WHERE name='system' LIMIT 1);

-- 业务菜单
INSERT INTO menus (name, title, path, icon, parent_id, is_hidden, sort_order, created_at, updated_at) VALUES
('dashboard',         '仪表盘',     '/dashboard',           'Gauge',     NULL,           0, 1, NOW(), NOW()),
('question_practice', '题目练习',   '/questions/practice',  'BookOpen',  NULL,           0, 2, NOW(), NOW()),
('org_management',    '机构管理',   '/orgs',                'Building',  @menu_system_id,0, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE
  title=VALUES(title), path=VALUES(path), icon=VALUES(icon), parent_id=VALUES(parent_id), updated_at=VALUES(updated_at);

SET @menu_dashboard_id  := (SELECT id FROM menus WHERE name='dashboard' LIMIT 1);
SET @menu_practice_id   := (SELECT id FROM menus WHERE name='question_practice' LIMIT 1);
SET @menu_org_mgmt_id   := (SELECT id FROM menus WHERE name='org_management' LIMIT 1);

-- 4) 角色-菜单映射
-- 管理员：全有
INSERT IGNORE INTO role_menus (role_id, menu_id) VALUES
(@role_admin_id,   @menu_dashboard_id),
(@role_admin_id,   @menu_practice_id),
(@role_admin_id,   @menu_org_mgmt_id);

-- 教师/学生：只给仪表盘+练习
INSERT IGNORE INTO role_menus (role_id, menu_id) VALUES
(@role_teacher_id, @menu_dashboard_id),
(@role_teacher_id, @menu_practice_id),
(@role_student_id, @menu_dashboard_id),
(@role_student_id, @menu_practice_id);

-- 5) 默认机构 → 默认角色（新注册落到默认机构时会自动发 student）
INSERT IGNORE INTO org_default_roles (org_id, role_id) VALUES
(@org_default_id, @role_student_id);

/*****************************************************************
 * B) 兼容迁移（把已有用户加入默认机构 + 赋默认角色）
 * - 已经在任何组织里的用户跳过
 * - 赋默认机构的默认角色（student）
 * - 约定：若有 email/username 含 'admin' 字样，则也给 admin 角色（可按需修改）
 *****************************************************************/

-- 把没有任何组织关系的用户，挂到默认机构（主组织）
INSERT IGNORE INTO user_organizations (user_id, org_id, is_primary, title, assigned_at)
SELECT u.id, @org_default_id, 1, NULL, NOW()
FROM users u
LEFT JOIN user_organizations uo ON uo.user_id = u.id
WHERE uo.user_id IS NULL;

-- 这些用户赋默认角色 student
INSERT IGNORE INTO user_org_roles (user_id, org_id, role_id, assigned_at)
SELECT uo.user_id, uo.org_id, @role_student_id, NOW()
FROM user_organizations uo
LEFT JOIN user_org_roles uor
  ON uor.user_id=uo.user_id AND uor.org_id=uo.org_id AND uor.role_id=@role_student_id
WHERE uor.user_id IS NULL;

-- 简单识别“管理员”账号（可替换为具体 user_id=1）
INSERT IGNORE INTO user_org_roles (user_id, org_id, role_id, assigned_at)
SELECT uo.user_id, uo.org_id, @role_admin_id, NOW()
FROM user_organizations uo
JOIN users u ON u.id = uo.user_id
LEFT JOIN user_org_roles uor
  ON uor.user_id=uo.user_id AND uor.org_id=uo.org_id AND uor.role_id=@role_admin_id
WHERE uor.user_id IS NULL
  AND (u.email LIKE '%admin%' OR u.username LIKE '%admin%');

-- 可选：教师识别（如 username/email 包含 'teacher'）
INSERT IGNORE INTO user_org_roles (user_id, org_id, role_id, assigned_at)
SELECT uo.user_id, uo.org_id, @role_teacher_id, NOW()
FROM user_organizations uo
JOIN users u ON u.id = uo.user_id
LEFT JOIN user_org_roles uor
  ON uor.user_id=uo.user_id AND uor.org_id=uo.org_id AND uor.role_id=@role_teacher_id
WHERE uor.user_id IS NULL
  AND (u.email LIKE '%teacher%' OR u.username LIKE '%teacher%');
