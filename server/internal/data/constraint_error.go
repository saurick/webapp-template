package data

import (
	"strings"

	"server/internal/data/model/ent"
)

func isDuplicateUsernameConstraint(err error) bool {
	return isDuplicateUniqueConstraint(err, "user_username", "users.username", "username")
}

func isDuplicateAdminUsernameConstraint(err error) bool {
	return isDuplicateUniqueConstraint(err, "adminuser_username", "admin_users.username", "username")
}

func isDuplicateUniqueConstraint(err error, keys ...string) bool {
	if err == nil || !ent.IsConstraintError(err) {
		return false
	}

	// 仅识别“唯一键冲突”语义，避免把外键等其他约束错误误判为“名称重复”。
	msg := strings.ToLower(err.Error())
	if !strings.Contains(msg, "duplicate") && !strings.Contains(msg, "unique") {
		return false
	}

	for _, key := range keys {
		if strings.Contains(msg, strings.ToLower(key)) {
			return true
		}
	}
	return false
}
