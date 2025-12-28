-- Create "invite_codes" table
CREATE TABLE `invite_codes` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `code` varchar(32) NOT NULL,
  `max_uses` bigint NOT NULL DEFAULT 1,
  `used_count` bigint NOT NULL DEFAULT 0,
  `expires_at` timestamp NULL,
  `disabled` bool NOT NULL DEFAULT 0,
  `created_at` timestamp NOT NULL,
  `updated_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `invitecode_code` (`code`)
) CHARSET utf8mb4 COLLATE utf8mb4_bin;
-- Create "users" table
CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `username` varchar(32) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `invite_code` varchar(32) NULL,
  `disabled` bool NOT NULL DEFAULT 0,
  `last_login_at` timestamp NULL,
  `created_at` timestamp NOT NULL,
  `updated_at` timestamp NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `user_invite_code` (`invite_code`),
  UNIQUE INDEX `user_username` (`username`)
) CHARSET utf8mb4 COLLATE utf8mb4_bin;
