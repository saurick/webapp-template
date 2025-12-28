-- Modify "users" table
ALTER TABLE `users`
  ADD COLUMN `role` tinyint NOT NULL DEFAULT 0 AFTER `invite_code`;
