ALTER TABLE roles
  ADD UNIQUE KEY uniq_roles_code (code);

CREATE TABLE IF NOT EXISTS role_orgs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  role_id BIGINT NOT NULL,
  org_id  BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_role_org (role_id, org_id),
  KEY idx_role_id (role_id),
  KEY idx_org_id (org_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 可选：如果你有 roles / orgs 表，可加外键（根据你的表名调整）
-- ALTER TABLE role_orgs
--   ADD CONSTRAINT fk_role_orgs_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
--   ADD CONSTRAINT fk_role_orgs_org  FOREIGN KEY (org_id)  REFERENCES orgs(id)  ON DELETE CASCADE;
