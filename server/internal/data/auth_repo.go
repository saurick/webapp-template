package data

import (
	"context"
	"errors"
	"time"

	"server/internal/biz"
	entinvite "server/internal/data/model/ent/invitecode"
	entuser "server/internal/data/model/ent/user"

	entsql "entgo.io/ent/dialect/sql"
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

	var inviteCode *string
	if u.InviteCode != nil {
		c := *u.InviteCode
		inviteCode = &c
	}

	l.Infof("GetUserByUsername success id=%d username=%s", u.ID, u.Username)

	return &biz.User{
		ID:           u.ID,
		Username:     u.Username,
		PasswordHash: u.PasswordHash,
		InviteCode:   inviteCode,
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

	if in.InviteCode != nil {
		m = m.SetInviteCode(*in.InviteCode)
	}

	u, err := m.Save(ctx)
	if err != nil {
		l.Errorf("CreateUser failed err=%v", err)
		return nil, err
	}

	var inviteCode *string
	if u.InviteCode != nil {
		c := *u.InviteCode
		inviteCode = &c
	}

	l.Infof("CreateUser success id=%d username=%s", u.ID, u.Username)

	return &biz.User{
		ID:           u.ID,
		Username:     u.Username,
		PasswordHash: u.PasswordHash,
		InviteCode:   inviteCode,
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

// =======================
// invite code
// =======================

func (r *authRepo) GetInviteCode(ctx context.Context, code string) (*biz.InviteCode, error) {
	l := r.log.WithContext(ctx)

	l.Infof("GetInviteCode start code=%s", code)

	ic, err := r.data.mysql.InviteCode.
		Query().
		Where(entinvite.Code(code)).
		Only(ctx)
	if err != nil {
		l.Infof("GetInviteCode not found code=%s err=%v", code, err)
		return nil, err
	}

	var expires *time.Time
	if ic.ExpiresAt != nil {
		t := *ic.ExpiresAt
		expires = &t
	}

	l.Infof("GetInviteCode success id=%d code=%s", ic.ID, ic.Code)

	return &biz.InviteCode{
		ID:        ic.ID,
		Code:      ic.Code,
		MaxUses:   ic.MaxUses,
		UsedCount: ic.UsedCount,
		ExpiresAt: expires,
		Disabled:  ic.Disabled,
	}, nil
}

func (r *authRepo) IncreaseInviteCodeUsage(ctx context.Context, id int) error {
	l := r.log.WithContext(ctx)

	l.Infof("IncreaseInviteCodeUsage id=%d", id)

	_, err := r.data.mysql.InviteCode.
		UpdateOneID(id).
		AddUsedCount(1).
		Save(ctx)

	if err != nil {
		l.Errorf("IncreaseInviteCodeUsage failed id=%d err=%v", id, err)
	}

	return err
}

func (r *authRepo) IncreaseInviteCodeUsageBy(ctx context.Context, id int, delta int) error {
	if delta <= 0 {
		return nil
	}
	client := r.data.mysql
	_, err := client.InviteCode.
		UpdateOneID(id).
		AddUsedCount(delta).
		Save(ctx)
	return err
}

// =========================
// ✅ 邀请码管理接口（给前端页面用）
// =========================

func (r *authRepo) ListInviteCodes(ctx context.Context, limit, offset int) ([]*biz.InviteCode, error) {
	client := r.data.mysql
	if limit <= 0 {
		limit = 200
	}
	if limit > 500 {
		limit = 500
	}
	if offset < 0 {
		offset = 0
	}

	rows, err := client.InviteCode.
		Query().
		Order(entinvite.ByID(entsql.OrderDesc())).
		Limit(limit).
		Offset(offset).
		All(ctx)
	if err != nil {
		return nil, err
	}

	out := make([]*biz.InviteCode, 0, len(rows))
	for _, ic := range rows {
		var expires *time.Time
		if ic.ExpiresAt != nil {
			e := *ic.ExpiresAt
			expires = &e
		}
		out = append(out, &biz.InviteCode{
			ID:        ic.ID,
			Code:      ic.Code,
			MaxUses:   ic.MaxUses,
			UsedCount: ic.UsedCount,
			ExpiresAt: expires,
			Disabled:  ic.Disabled,
		})
	}
	return out, nil
}

func (r *authRepo) CreateInviteCode(ctx context.Context, in *biz.InviteCode) (*biz.InviteCode, error) {
	client := r.data.mysql

	now := time.Now()
	m := client.InviteCode.Create().
		SetCode(in.Code).
		SetMaxUses(in.MaxUses).
		SetUsedCount(in.UsedCount).
		SetDisabled(in.Disabled).
		SetCreatedAt(now).
		SetUpdatedAt(now)

	if in.ExpiresAt != nil {
		m = m.SetExpiresAt(*in.ExpiresAt)
	}

	ic, err := m.Save(ctx)
	if err != nil {
		return nil, err
	}

	var expires *time.Time
	if ic.ExpiresAt != nil {
		e := *ic.ExpiresAt
		expires = &e
	}

	return &biz.InviteCode{
		ID:        ic.ID,
		Code:      ic.Code,
		MaxUses:   ic.MaxUses,
		UsedCount: ic.UsedCount,
		ExpiresAt: expires,
		Disabled:  ic.Disabled,
	}, nil
}

func (r *authRepo) SetInviteCodeDisabled(ctx context.Context, id int, disabled bool) error {
	client := r.data.mysql
	_, err := client.InviteCode.
		UpdateOneID(id).
		SetDisabled(disabled).
		Save(ctx)
	return err
}
