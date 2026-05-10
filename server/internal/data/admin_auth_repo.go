// server/internal/data/admin_auth_repo.go
package data

import (
	"context"
	"database/sql"
	"errors"
	"sort"
	"time"

	"server/internal/biz"

	"github.com/go-kratos/kratos/v2/log"
)

type adminAuthRepo struct {
	data *Data
	log  *log.Helper
}

func NewAdminAuthRepo(data *Data, logger log.Logger) *adminAuthRepo {
	return &adminAuthRepo{
		data: data,
		log:  log.NewHelper(log.With(logger, "module", "data.admin_auth_repo")),
	}
}

var _ biz.AdminAuthRepo = (*adminAuthRepo)(nil)

func (r *adminAuthRepo) GetAdminByID(ctx context.Context, id int) (*biz.AdminUser, error) {
	l := r.log.WithContext(ctx)
	if id <= 0 {
		l.Warn("GetAdminByID: invalid id")
		return nil, errors.New("admin id is required")
	}

	var (
		adminID      int
		uname        string
		passwordHash string
		disabled     bool
	)

	err := r.data.sqldb.QueryRowContext(
		ctx,
		"SELECT id, username, password_hash, disabled FROM admin_users WHERE id = $1 LIMIT 1",
		id,
	).Scan(&adminID, &uname, &passwordHash, &disabled)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			l.Infof("GetAdminByID not found id=%d", id)
		} else {
			l.Errorf("GetAdminByID failed id=%d err=%v", id, err)
		}
		return nil, err
	}

	return &biz.AdminUser{
		ID:           adminID,
		Username:     uname,
		PasswordHash: passwordHash,
		Disabled:     disabled,
		Roles:        r.getAdminRoles(ctx, adminID),
		Permissions:  r.getAdminPermissions(ctx, adminID),
	}, nil
}

func (r *adminAuthRepo) GetAdminByUsername(ctx context.Context, username string) (*biz.AdminUser, error) {
	l := r.log.WithContext(ctx)
	if username == "" {
		l.Warn("GetAdminByUsername: empty username")
		return nil, errors.New("username is required")
	}

	var (
		id           int
		uname        string
		passwordHash string
		disabled     bool
	)

	err := r.data.sqldb.QueryRowContext(
		ctx,
		"SELECT id, username, password_hash, disabled FROM admin_users WHERE username = $1 LIMIT 1",
		username,
	).Scan(&id, &uname, &passwordHash, &disabled)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			l.Infof("GetAdminByUsername not found username=%s", username)
		} else {
			l.Errorf("GetAdminByUsername failed username=%s err=%v", username, err)
		}
		return nil, err
	}

	return &biz.AdminUser{
		ID:           id,
		Username:     uname,
		PasswordHash: passwordHash,
		Disabled:     disabled,
		Roles:        r.getAdminRoles(ctx, id),
		Permissions:  r.getAdminPermissions(ctx, id),
	}, nil
}

func (r *adminAuthRepo) UpdateAdminLastLogin(ctx context.Context, id int, t time.Time) error {
	if id <= 0 {
		return errors.New("admin id is required")
	}

	_, err := r.data.sqldb.ExecContext(
		ctx,
		"UPDATE admin_users SET last_login_at = $1, updated_at = $2 WHERE id = $3",
		t,
		time.Now(),
		id,
	)
	if err != nil {
		r.log.WithContext(ctx).Errorf("UpdateAdminLastLogin failed admin_id=%d err=%v", id, err)
	}
	return err
}

func (r *adminAuthRepo) getAdminRoles(ctx context.Context, adminID int) []string {
	rows, err := r.data.sqldb.QueryContext(
		ctx,
		`SELECT DISTINCT ar.key
		 FROM admin_roles ar
		 JOIN admin_user_roles aur ON aur.admin_role_id = ar.id
		 WHERE aur.admin_user_id = $1
		 ORDER BY ar.key`,
		adminID,
	)
	if err != nil {
		r.log.WithContext(ctx).Warnf("GetAdminRoles failed admin_id=%d err=%v", adminID, err)
		return nil
	}
	defer func() {
		if err := rows.Close(); err != nil {
			r.log.WithContext(ctx).Warnf("GetAdminRoles close rows failed admin_id=%d err=%v", adminID, err)
		}
	}()

	var out []string
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err == nil {
			out = append(out, key)
		}
	}
	if err := rows.Err(); err != nil {
		r.log.WithContext(ctx).Warnf("GetAdminRoles rows failed admin_id=%d err=%v", adminID, err)
	}
	sort.Strings(out)
	return out
}

func (r *adminAuthRepo) getAdminPermissions(ctx context.Context, adminID int) []string {
	rows, err := r.data.sqldb.QueryContext(
		ctx,
		`SELECT DISTINCT ap.key
		 FROM admin_permissions ap
		 JOIN admin_role_permissions arp ON arp.admin_permission_id = ap.id
		 JOIN admin_user_roles aur ON aur.admin_role_id = arp.admin_role_id
		 WHERE aur.admin_user_id = $1
		 ORDER BY ap.key`,
		adminID,
	)
	if err != nil {
		r.log.WithContext(ctx).Warnf("GetAdminPermissions failed admin_id=%d err=%v", adminID, err)
		return nil
	}
	defer func() {
		if err := rows.Close(); err != nil {
			r.log.WithContext(ctx).Warnf("GetAdminPermissions close rows failed admin_id=%d err=%v", adminID, err)
		}
	}()

	var out []string
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err == nil {
			out = append(out, key)
		}
	}
	if err := rows.Err(); err != nil {
		r.log.WithContext(ctx).Warnf("GetAdminPermissions rows failed admin_id=%d err=%v", adminID, err)
	}
	sort.Strings(out)
	return out
}
