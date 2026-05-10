// server/internal/data/admin_user_init.go
package data

import (
	"context"
	"errors"
	"time"

	"server/internal/biz"
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

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	now := time.Now()
	// 多副本并发启动时，管理员初始化必须保持幂等，避免“先查后插”在唯一键上互相踩踏。
	result, err := d.sqldb.ExecContext(
		ctx,
		"INSERT INTO admin_users (username, password_hash, disabled, created_at, updated_at) VALUES ($1, $2, FALSE, $3, $4) ON CONFLICT (username) DO NOTHING",
		username,
		string(hash),
		now,
		now,
	)
	if err != nil {
		return err
	}

	affected, err := result.RowsAffected()
	if err != nil {
		l.Warnf("admin_users init rows affected unavailable username=%s err=%v", username, err)
		l.Info("admin_users init completed without rows-affected detail")
		return initAdminRBACDefaults(ctx, d, username, l)
	}
	if affected == 0 {
		l.Infof("admin_users admin already exists, skip create username=%s", username)
		return initAdminRBACDefaults(ctx, d, username, l)
	}

	l.Info("create admin_users admin success")
	return initAdminRBACDefaults(ctx, d, username, l)
}

func initAdminRBACDefaults(ctx context.Context, d *Data, adminUsername string, l *log.Helper) error {
	now := time.Now()
	for _, p := range biz.DefaultAdminPermissions {
		_, err := d.sqldb.ExecContext(
			ctx,
			`INSERT INTO admin_permissions (key, name, "group", description, builtin, created_at, updated_at)
			 VALUES ($1, $2, $3, $4, TRUE, $5, $6)
			 ON CONFLICT (key) DO UPDATE SET
			   name = EXCLUDED.name,
			   "group" = EXCLUDED."group",
			   description = EXCLUDED.description,
			   builtin = TRUE,
			   updated_at = EXCLUDED.updated_at`,
			p.Key,
			p.Name,
			p.Group,
			p.Description,
			now,
			now,
		)
		if err != nil {
			return err
		}
	}

	_, err := d.sqldb.ExecContext(
		ctx,
		`INSERT INTO admin_roles (key, name, description, builtin, created_at, updated_at)
		 VALUES ($1, $2, $3, TRUE, $4, $5)
		 ON CONFLICT (key) DO UPDATE SET
		   name = EXCLUDED.name,
		   description = EXCLUDED.description,
		   builtin = TRUE,
		   updated_at = EXCLUDED.updated_at`,
		biz.SuperAdminRoleKey,
		"超级管理员",
		"模板内置最高权限角色，初始化管理员默认绑定",
		now,
		now,
	)
	if err != nil {
		return err
	}

	// RBAC 默认值属于模板基线：已有管理员也要补齐 super_admin，避免迁移后旧账号失权。
	_, err = d.sqldb.ExecContext(
		ctx,
		`INSERT INTO admin_role_permissions (admin_role_id, admin_permission_id, created_at)
		 SELECT r.id, p.id, $1
		 FROM admin_roles r
		 CROSS JOIN admin_permissions p
		 WHERE r.key = $2
		 ON CONFLICT (admin_role_id, admin_permission_id) DO NOTHING`,
		now,
		biz.SuperAdminRoleKey,
	)
	if err != nil {
		return err
	}

	result, err := d.sqldb.ExecContext(
		ctx,
		`INSERT INTO admin_user_roles (admin_user_id, admin_role_id, created_at)
		 SELECT u.id, r.id, $1
		 FROM admin_users u
		 CROSS JOIN admin_roles r
		 WHERE u.username = $2 AND r.key = $3
		 ON CONFLICT (admin_user_id, admin_role_id) DO NOTHING`,
		now,
		adminUsername,
		biz.SuperAdminRoleKey,
	)
	if err != nil {
		return err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		l.Warnf("admin RBAC init rows affected unavailable username=%s err=%v", adminUsername, err)
	} else if affected > 0 {
		l.Infof("admin RBAC init assigned super_admin username=%s", adminUsername)
	} else {
		l.Infof("admin RBAC init super_admin already assigned username=%s", adminUsername)
	}
	return nil
}
