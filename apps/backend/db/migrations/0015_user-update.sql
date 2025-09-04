-- 1) 确保有 admin/teacher/student 三个角色码
INSERT INTO roles (name, code, description, sort_order, is_system, is_disabled)
VALUES ('管理员','admin','系统管理员',1,1,0),
       ('教师','teacher','教师角色',2,0,0),
       ('学生','student','学生角色',3,0,0)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 2) 准备一个组织（如果你已经有组织，这步可以跳过）
INSERT INTO organizations (id, name, parent_id)
VALUES (1, '默认组织', NULL)
ON DUPLICATE KEY UPDATE name=VALUES(name);

-- 3) 让管理员属于该组织，且设为主组织
--    要求 user_organizations 有 UNIQUE(user_id, org_id)
INSERT INTO user_organizations (user_id, org_id, is_primary, created_at, updated_at)
VALUES (:ADMIN_ID, 1, 1, NOW(), NOW())
ON DUPLICATE KEY UPDATE is_primary=1, updated_at=NOW();

-- 4) 找到角色ID
SELECT id INTO @ADMIN_ROLE_ID FROM roles WHERE code='admin' LIMIT 1;

-- 5) 赋予管理员在该组织下的 admin 角色
INSERT INTO user_org_roles (user_id, org_id, role_id, assigned_at)
VALUES (:ADMIN_ID, 1, @ADMIN_ROLE_ID, NOW())
ON DUPLICATE KEY UPDATE role_id=@ADMIN_ROLE_ID, assigned_at=NOW();
