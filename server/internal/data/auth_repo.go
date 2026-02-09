// server/internal/data/auth_repo.go
package data

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"server/internal/biz"
	entadminuser "server/internal/data/model/ent/adminuser"
	entuser "server/internal/data/model/ent/user"

	"github.com/go-kratos/kratos/v2/log"
)

type authRepo struct {
	data *Data
	log  *log.Helper
}

func NewAuthRepo(data *Data, logger log.Logger) *authRepo {
	return &authRepo{
		data: data,
		log:  log.NewHelper(log.With(logger, "module", "data.auth_repo")),
	}
}

var _ biz.AuthRepo = (*authRepo)(nil)

// =======================
// user
// =======================

func (r *authRepo) GetUserByUsername(ctx context.Context, username string) (*biz.User, error) {
	l := r.log.WithContext(ctx)

	if username == "" {
		l.Warn("GetUserByUsername: empty username")
		return nil, errors.New("username is required")
	}

	u, err := r.data.mysql.User.
		Query().
		Where(entuser.Username(username)).
		Only(ctx)
	if err != nil {
		l.Infof("GetUserByUsername not found username=%s err=%v", username, err)
		return nil, err
	}

	var expiresAt *time.Time
	if u.ExpiresAt != nil {
		t := *u.ExpiresAt
		expiresAt = &t
	}

	return &biz.User{
		ID:           u.ID,
		Username:     u.Username,
		PasswordHash: u.PasswordHash,
		Disabled:     u.Disabled,
		Role:         int8(u.Role),
		AdminID:      u.AdminID,
		Points:       u.Points,
		ExpiresAt:    expiresAt,
		CreatedAt:    u.CreatedAt,
		UpdatedAt:    u.UpdatedAt,
	}, nil
}

func (r *authRepo) GetUserByID(ctx context.Context, id int) (*biz.User, error) {
	l := r.log.WithContext(ctx)
	if id <= 0 {
		l.Warn("GetUserByID: invalid id")
		return nil, errors.New("user id is required")
	}

	u, err := r.data.mysql.User.
		Query().
		Where(entuser.ID(id)).
		Only(ctx)
	if err != nil {
		l.Infof("GetUserByID not found id=%d err=%v", id, err)
		return nil, err
	}

	var expiresAt *time.Time
	if u.ExpiresAt != nil {
		t := *u.ExpiresAt
		expiresAt = &t
	}

	return &biz.User{
		ID:           u.ID,
		Username:     u.Username,
		PasswordHash: u.PasswordHash,
		Disabled:     u.Disabled,
		Role:         int8(u.Role),
		AdminID:      u.AdminID,
		Points:       u.Points,
		ExpiresAt:    expiresAt,
		CreatedAt:    u.CreatedAt,
		UpdatedAt:    u.UpdatedAt,
	}, nil
}

func (r *authRepo) CreateUser(ctx context.Context, in *biz.User) (*biz.User, error) {
	l := r.log.WithContext(ctx)

	l.Infof("CreateUser start username=%s", in.Username)

	// 关键兜底：账号名在 users/admin_users 间必须全局唯一，避免用户与管理员同名。
	if exists, err := r.isUsernameUsedByAdmin(ctx, in.Username); err != nil {
		l.Errorf("CreateUser check admin username failed username=%s err=%v", in.Username, err)
		return nil, err
	} else if exists {
		l.Warnf("CreateUser username conflicts with admin username=%s", in.Username)
		return nil, biz.ErrUserExists
	}

	m := r.data.mysql.User.
		Create().
		SetUsername(in.Username).
		SetPasswordHash(in.PasswordHash).
		SetRole(0)

	if in.AdminID != nil {
		m = m.SetAdminID(*in.AdminID)
	} else if adminID, err := r.defaultAdminID(ctx); err != nil {
		l.Warnf("CreateUser default admin lookup failed err=%v", err)
	} else if adminID > 0 {
		m = m.SetAdminID(adminID)
	}

	u, err := m.Save(ctx)
	if err != nil {
		if isDuplicateUsernameConstraint(err) {
			l.Warnf("CreateUser duplicate username username=%s err=%v", in.Username, err)
			return nil, biz.ErrUserExists
		}
		l.Errorf("CreateUser failed err=%v", err)
		return nil, err
	}

	return &biz.User{
		ID:           u.ID,
		Username:     u.Username,
		PasswordHash: u.PasswordHash,
		Disabled:     u.Disabled,
		Role:         int8(u.Role),
		AdminID:      u.AdminID,
		Points:       u.Points,
		ExpiresAt:    u.ExpiresAt,
		CreatedAt:    u.CreatedAt,
		UpdatedAt:    u.UpdatedAt,
	}, nil
}

func (r *authRepo) UpdateUserLastLogin(ctx context.Context, id int, t time.Time) error {
	l := r.log.WithContext(ctx)

	_, err := r.data.mysql.User.
		UpdateOneID(id).
		SetLastLoginAt(t).
		SetUpdatedAt(time.Now()).
		Save(ctx)

	if err != nil {
		l.Errorf("UpdateUserLastLogin failed user_id=%d err=%v", id, err)
	}

	return err
}

func (r *authRepo) defaultAdminID(ctx context.Context) (int, error) {
	var id int
	err := r.data.sqldb.QueryRowContext(
		ctx,
		"SELECT id FROM admin_users WHERE level = 0 ORDER BY id ASC LIMIT 1",
	).Scan(&id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, nil
		}
		return 0, err
	}
	return id, nil
}

func (r *authRepo) isUsernameUsedByAdmin(ctx context.Context, username string) (bool, error) {
	if username == "" {
		return false, nil
	}
	return r.data.mysql.AdminUser.
		Query().
		Where(entadminuser.Username(username)).
		Exist(ctx)
}
