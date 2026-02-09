// server/internal/data/auth_repo.go
package data

import (
	"context"
	"errors"
	"time"

	"server/internal/biz"
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

	l.Infof("GetUserByUsername start username=%s", username)

	u, err := r.data.mysql.User.
		Query().
		Where(entuser.Username(username)).
		Only(ctx) // 👈 用 Only，语义更明确
	if err != nil {
		l.Infof("GetUserByUsername not found username=%s err=%v", username, err)
		return nil, err
	}

	l.Infof("GetUserByUsername success id=%d username=%s", u.ID, u.Username)

	return &biz.User{
		ID:           u.ID,
		Username:     u.Username,
		PasswordHash: u.PasswordHash,
		Disabled:     u.Disabled,
		Role:         int8(u.Role),
	}, nil
}

func (r *authRepo) CreateUser(ctx context.Context, in *biz.User) (*biz.User, error) {
	l := r.log.WithContext(ctx)

	l.Infof("CreateUser start username=%s", in.Username)

	m := r.data.mysql.User.
		Create().
		SetUsername(in.Username).
		SetPasswordHash(in.PasswordHash).
		SetRole(0) // ✅ 默认普通用户

	u, err := m.Save(ctx)
	if err != nil {
		l.Errorf("CreateUser failed err=%v", err)
		return nil, err
	}

	l.Infof("CreateUser success id=%d username=%s", u.ID, u.Username)

	return &biz.User{
		ID:           u.ID,
		Username:     u.Username,
		PasswordHash: u.PasswordHash,
		Disabled:     u.Disabled,
		Role:         int8(u.Role), // ✅ 默认普通用户
	}, nil
}

func (r *authRepo) UpdateUserLastLogin(ctx context.Context, id int, t time.Time) error {
	l := r.log.WithContext(ctx)

	l.Infof("UpdateUserLastLogin user_id=%d", id)

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
