// server/internal/data/admin_user_init.go
package data

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"server/internal/conf"

	"github.com/go-kratos/kratos/v2/log"
	"golang.org/x/crypto/bcrypt"
)

func InitAdminUsersIfNeeded(ctx context.Context, d *Data, cfg *conf.Data, l *log.Helper) error {
	if d == nil || d.sqldb == nil {
		return errors.New("InitAdminUsersIfNeeded: missing db")
	}

	if cfg == nil || cfg.Auth == nil || cfg.Auth.Admin == nil {
		return nil
	}

	username := cfg.Auth.Admin.Username
	password := cfg.Auth.Admin.Password

	if username == "" || password == "" {
		return nil
	}

	var id int
	err := d.sqldb.QueryRowContext(
		ctx,
		"SELECT id FROM admin_users WHERE username = ? LIMIT 1",
		username,
	).Scan(&id)
	if err == nil {
		_, _ = d.sqldb.ExecContext(
			ctx,
			"UPDATE admin_users SET level = 0, parent_id = NULL WHERE id = ?",
			id,
		)
		return nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	now := time.Now()
	_, err = d.sqldb.ExecContext(
		ctx,
		"INSERT INTO admin_users (username, password_hash, level, parent_id, disabled, created_at, updated_at) VALUES (?, ?, 0, NULL, 0, ?, ?)",
		username,
		string(hash),
		now,
		now,
	)
	if err != nil {
		return err
	}

	l.Info("create admin_users admin success")
	return nil
}
