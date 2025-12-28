// server/internal/data/admin_init.go
package data

import (
	"context"
	"time"

	"server/internal/conf"
	"server/internal/data/model/ent/user"

	"golang.org/x/crypto/bcrypt"
)

func InitAdminIfNeeded(ctx context.Context, d *Data, cfg *conf.Data) error {
	if cfg.Auth == nil || cfg.Auth.Admin == nil {
		return nil
	}

	username := cfg.Auth.Admin.Username
	password := cfg.Auth.Admin.Password

	if username == "" || password == "" {
		return nil
	}

	// 已存在就不管
	_, err := d.mysql.User.
		Query().
		Where(user.Username(username)).
		First(ctx)

	if err == nil {
		return nil
	}

	// 不存在 → 创建
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	now := time.Now()
	_, err = d.mysql.User.
		Create().
		SetUsername(username).
		SetPasswordHash(string(hash)).
		SetRole(1). // admin
		SetUpdatedAt(now).
		SetCreatedAt(now).
		Save(ctx)

	if err != nil {
		return nil
	}

	return nil
}
