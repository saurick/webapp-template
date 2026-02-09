// server/internal/data/admin_manage_repo.go
package data

import (
	"context"
	"database/sql"

	"server/internal/biz"
	"server/internal/data/model/ent"
	"server/internal/data/model/ent/adminuser"
	"server/internal/data/model/ent/user"

	"github.com/go-kratos/kratos/v2/log"
)

type adminManageRepo struct {
	data *Data
	log  *log.Helper
}

func NewAdminManageRepo(d *Data, logger log.Logger) *adminManageRepo {
	return &adminManageRepo{
		data: d,
		log:  log.NewHelper(log.With(logger, "module", "data.admin_manage_repo")),
	}
}

var _ biz.AdminManageRepo = (*adminManageRepo)(nil)

func (r *adminManageRepo) toBizAdmin(a *ent.AdminUser) *biz.AdminAccount {
	if a == nil {
		return nil
	}
	return &biz.AdminAccount{
		ID:              a.ID,
		Username:        a.Username,
		Level:           biz.AdminLevel(a.Level),
		ParentID:        a.ParentID,
		Disabled:        a.Disabled,
		LastLoginAt:     a.LastLoginAt,
		CreatedAt:       a.CreatedAt,
		UpdatedAt:       a.UpdatedAt,
		UserCount:       0,
		ChildAdminCount: 0,
	}
}

func (r *adminManageRepo) GetAdminByID(ctx context.Context, id int) (*biz.AdminAccount, error) {
	if id <= 0 {
		return nil, biz.ErrBadParam
	}
	row, err := r.data.mysql.AdminUser.Query().Where(adminuser.ID(id)).Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, biz.ErrAdminNotFound
		}
		return nil, err
	}
	return r.toBizAdmin(row), nil
}

func (r *adminManageRepo) GetAdminByUsername(ctx context.Context, username string) (*biz.AdminAccount, error) {
	if username == "" {
		return nil, biz.ErrBadParam
	}
	row, err := r.data.mysql.AdminUser.Query().Where(adminuser.Username(username)).Only(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			return nil, biz.ErrAdminNotFound
		}
		return nil, err
	}
	return r.toBizAdmin(row), nil
}

func (r *adminManageRepo) ListAdmins(ctx context.Context) ([]*biz.AdminAccount, error) {
	rows, err := r.data.mysql.AdminUser.
		Query().
		Order(ent.Desc(adminuser.FieldID)).
		All(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]*biz.AdminAccount, 0, len(rows))
	for _, row := range rows {
		out = append(out, r.toBizAdmin(row))
	}
	return out, nil
}

func (r *adminManageRepo) CountUsersByAdmin(ctx context.Context) (map[int]int, error) {
	counts := map[int]int{}
	rows, err := r.data.sqldb.QueryContext(
		ctx,
		"SELECT admin_id, COUNT(*) FROM users WHERE admin_id IS NOT NULL GROUP BY admin_id",
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var adminID sql.NullInt64
		var cnt int
		if err := rows.Scan(&adminID, &cnt); err != nil {
			return nil, err
		}
		if adminID.Valid {
			counts[int(adminID.Int64)] = cnt
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return counts, nil
}

func (r *adminManageRepo) CountChildAdmins(ctx context.Context) (map[int]int, error) {
	counts := map[int]int{}
	rows, err := r.data.sqldb.QueryContext(
		ctx,
		"SELECT parent_id, COUNT(*) FROM admin_users WHERE parent_id IS NOT NULL GROUP BY parent_id",
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var parentID sql.NullInt64
		var cnt int
		if err := rows.Scan(&parentID, &cnt); err != nil {
			return nil, err
		}
		if parentID.Valid {
			counts[int(parentID.Int64)] = cnt
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return counts, nil
}

func (r *adminManageRepo) CountChildAdminsByParent(ctx context.Context, parentID int) (int, error) {
	if parentID <= 0 {
		return 0, biz.ErrBadParam
	}
	cnt, err := r.data.mysql.AdminUser.
		Query().
		Where(
			adminuser.ParentIDEQ(parentID),
			adminuser.LevelEQ(int8(biz.AdminLevelSecondary)),
		).
		Count(ctx)
	if err != nil {
		return 0, err
	}
	return cnt, nil
}

func (r *adminManageRepo) CreateAdmin(ctx context.Context, in *biz.AdminCreate) (*biz.AdminAccount, error) {
	if in == nil || in.Username == "" || in.PasswordHash == "" {
		return nil, biz.ErrBadParam
	}
	l := r.log.WithContext(ctx)
	// 关键兜底：账号名在 users/admin_users 间必须全局唯一，避免管理员与用户同名。
	if exists, err := r.isUsernameUsedByUser(ctx, in.Username); err != nil {
		l.Errorf("CreateAdmin check user username failed username=%s err=%v", in.Username, err)
		return nil, err
	} else if exists {
		l.Warnf("CreateAdmin username conflicts with user username=%s", in.Username)
		return nil, biz.ErrAdminExists
	}

	m := r.data.mysql.AdminUser.
		Create().
		SetUsername(in.Username).
		SetPasswordHash(in.PasswordHash).
		SetLevel(int8(in.Level)).
		SetDisabled(false)

	if in.ParentID != nil {
		m = m.SetParentID(*in.ParentID)
	}

	row, err := m.Save(ctx)
	if err != nil {
		// 并发创建同名管理员时，依赖唯一索引兜底并转换为业务错误，避免返回 500。
		if isDuplicateAdminUsernameConstraint(err) {
			l.Warnf("CreateAdmin duplicate username username=%s err=%v", in.Username, err)
			return nil, biz.ErrAdminExists
		}
		return nil, err
	}
	return r.toBizAdmin(row), nil
}

func (r *adminManageRepo) UpdateAdminHierarchy(ctx context.Context, id int, level biz.AdminLevel, parentID *int) error {
	if id <= 0 {
		return biz.ErrBadParam
	}

	upd := r.data.mysql.AdminUser.UpdateOneID(id).
		SetLevel(int8(level))
	if parentID == nil {
		upd = upd.ClearParentID()
	} else {
		upd = upd.SetParentID(*parentID)
	}

	if _, err := upd.Save(ctx); err != nil {
		if ent.IsNotFound(err) {
			return biz.ErrAdminNotFound
		}
		return err
	}
	return nil
}

func (r *adminManageRepo) SetAdminDisabled(ctx context.Context, id int, disabled bool) error {
	if id <= 0 {
		return biz.ErrBadParam
	}
	if _, err := r.data.mysql.AdminUser.UpdateOneID(id).SetDisabled(disabled).Save(ctx); err != nil {
		if ent.IsNotFound(err) {
			return biz.ErrAdminNotFound
		}
		return err
	}
	return nil
}

func (r *adminManageRepo) TransferUsers(ctx context.Context, fromAdminID int, toAdminID *int) (int, error) {
	if fromAdminID <= 0 {
		return 0, biz.ErrBadParam
	}

	upd := r.data.mysql.User.Update().Where(user.AdminIDEQ(fromAdminID))
	if toAdminID == nil {
		upd = upd.ClearAdminID()
	} else {
		upd = upd.SetAdminID(*toAdminID)
	}

	affected, err := upd.Save(ctx)
	if err != nil {
		return 0, err
	}
	return affected, nil
}

func (r *adminManageRepo) TransferChildAdmins(ctx context.Context, fromAdminID int, toAdminID *int) (int, error) {
	if fromAdminID <= 0 {
		return 0, biz.ErrBadParam
	}

	upd := r.data.mysql.AdminUser.
		Update().
		Where(
			adminuser.ParentIDEQ(fromAdminID),
			adminuser.LevelEQ(int8(biz.AdminLevelSecondary)),
		)
	if toAdminID == nil {
		upd = upd.ClearParentID()
	} else {
		upd = upd.SetParentID(*toAdminID)
	}

	affected, err := upd.Save(ctx)
	if err != nil {
		return 0, err
	}
	return affected, nil
}

func (r *adminManageRepo) isUsernameUsedByUser(ctx context.Context, username string) (bool, error) {
	if username == "" {
		return false, nil
	}
	return r.data.mysql.User.
		Query().
		Where(user.Username(username)).
		Exist(ctx)
}
