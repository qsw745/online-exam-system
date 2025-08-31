ALTER TABLE menus ADD UNIQUE KEY uk_menus_name (name);
-- 看你需要的取值，常见：menu / page / button / link / iframe / dir
ALTER TABLE menus 
  MODIFY menu_type VARCHAR(20) NOT NULL DEFAULT 'menu';

