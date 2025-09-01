-- 0) 选库（如果没选）
-- USE exam_system;

-- 1) 准备角色（已存在没关系，0 行受影响说明已经有了）
INSERT INTO roles (name, code, description, sort_order, is_system, is_disabled)
VALUES ('管理员','admin','系统管理员',1,1,0),
       ('教师','teacher','教师角色',2,0,0),
       ('学生','student','学生角色',3,0,0)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 2) 准备一个组织（如果已有，就会更新名字）
INSERT INTO organizations (id, name, parent_id)
VALUES (1, '默认组织', NULL)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 3) 设定管理员用户 ID（两种方式，二选一）：
-- 3A) 如果知道 id，直接设：
-- SET @ADMIN_ID := 3;

-- 3B) 如果知道邮箱，用邮箱查询：
SET @ADMIN_ID := (SELECT id FROM users WHERE email='youremail@example.com' LIMIT 1);

-- 可选：看一下拿到的 id
SELECT @ADMIN_ID AS admin_id;

-- 4) 把管理员加入组织，并设为主组织
--   若 user_organizations 上有 UNIQUE(user_id, org_id)，ON DUPLICATE KEY 才会生效；
--   如果没有唯一键，建议先加：ALTER TABLE user_organizations ADD UNIQUE KEY uk_user_org (user_id, org_id);
INSERT INTO user_organizations (user_id, org_id, is_primary, created_at, updated_at)
VALUES (@ADMIN_ID, 1, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE is_primary=1, updated_at=NOW();

-- 5) 拿到 admin 角色 ID
SET @ADMIN_ROLE_ID := (SELECT id FROM roles WHERE code='admin' LIMIT 1);

-- 6) 赋予管理员在组织 1 下的 admin 角色
INSERT INTO user_org_roles (user_id, org_id, role_id, assigned_at)
VALUES (@ADMIN_ID, 1, @ADMIN_ROLE_ID, NOW())
ON DUPLICATE KEY UPDATE role_id=@ADMIN_ROLE_ID, assigned_at=NOW();

-- 7) （可选）为了全局兜底，把 users.role 也标成 'admin'
UPDATE users SET role='admin' WHERE id=@ADMIN_ID;

-- 8) 验证：查看这个用户在组织 1 下的角色
SELECT u.id, u.email, r.code AS role_code
FROM user_org_roles uor
JOIN roles r ON r.id=uor.role_id
JOIN users u ON u.id=uor.user_id
WHERE uor.user_id=@ADMIN_ID AND uor.org_id=1;

-- 9) 验证：确认这个人的主组织是 1
SELECT * FROM user_organizations WHERE user_id=@ADMIN_ID;
