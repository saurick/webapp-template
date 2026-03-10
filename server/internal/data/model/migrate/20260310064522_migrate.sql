-- Modify "admin_users" table
ALTER TABLE `admin_users` DROP COLUMN `level`, DROP COLUMN `parent_id`;
-- Modify "users" table
ALTER TABLE `users` DROP COLUMN `invite_code`, DROP COLUMN `role`, DROP COLUMN `admin_id`, DROP COLUMN `points`, DROP COLUMN `expires_at`;
-- Drop "invite_codes" table
DROP TABLE `invite_codes`;
