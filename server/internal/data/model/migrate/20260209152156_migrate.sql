-- Modify "users" table
ALTER TABLE `users` ADD COLUMN `admin_id` bigint NULL AFTER `role`, ADD COLUMN `points` bigint NOT NULL DEFAULT 0 AFTER `last_login_at`, ADD COLUMN `expires_at` timestamp NULL AFTER `points`, ADD INDEX `user_admin_id` (`admin_id`);
-- Create "admin_users" table
CREATE TABLE `admin_users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `username` varchar(64) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `level` tinyint NOT NULL DEFAULT 2,
  `parent_id` bigint NULL,
  `disabled` bool NOT NULL DEFAULT 0,
  `last_login_at` timestamp NULL,
  `created_at` timestamp NOT NULL,
  `updated_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `adminuser_level` (`level`),
  INDEX `adminuser_parent_id` (`parent_id`),
  UNIQUE INDEX `adminuser_username` (`username`)
) CHARSET utf8mb4 COLLATE utf8mb4_bin;
