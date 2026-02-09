// server/internal/data/user_admin_repo.go
package data

import (
	"context"
	"strings"
	"time"

	"server/internal/biz"
	"server/internal/data/model/ent"
	"server/internal/data/model/ent/adminuser"
	"server/internal/data/model/ent/user"

	"github.com/go-kratos/kratos/v2/log"
)

type userAdminRepo struct {
	log  *log.Helper
	data *Data
}

func NewUserAdminRepo(d *Data, logger log.Logger) *userAdminRepo {
	return &userAdminRepo{
		log:  log.NewHelper(log.With(logger, "module", "data.useradmin_repo")),
		data: d,
	}
}

var _ biz.UserAdminRepo = (*userAdminRepo)(nil)

type adminScope struct {
	adminID         int
	level           biz.AdminLevel
	isSuper         bool
	allowedAdminIDs []int
}

func (r *userAdminRepo) loadAdminScope(ctx context.Context, operatorAdminID int, operatorAdminName string) (*adminScope, error) {
	var (
		a   *ent.AdminUser
		err error
	)

	if operatorAdminID > 0 {
		a, err = r.data.mysql.AdminUser.
			Query().
			Where(adminuser.ID(operatorAdminID)).
			Only(ctx)
		if err != nil && !ent.IsNotFound(err) {
			return nil, err
		}
	}

	if a == nil && operatorAdminName != "" {
		a, err = r.data.mysql.AdminUser.
			Query().
			Where(adminuser.Username(operatorAdminName)).
			Only(ctx)
		if err != nil {
			if ent.IsNotFound(err) {
				return nil, biz.ErrForbidden
			}
			return nil, err
		}
	}

	if a == nil {
		return nil, biz.ErrForbidden
	}

	if a.Disabled {
		return nil, biz.ErrNoPermission
	}

	level := biz.AdminLevel(a.Level)
	scope := &adminScope{
		adminID: a.ID,
		level:   level,
	}

	switch level {
	case biz.AdminLevelSuper:
		scope.isSuper = true
	case biz.AdminLevelPrimary:
		scope.allowedAdminIDs = []int{a.ID}
		childIDs, err := r.data.mysql.AdminUser.
			Query().
			Where(
				adminuser.ParentIDEQ(a.ID),
				adminuser.LevelEQ(int8(biz.AdminLevelSecondary)),
			).
			IDs(ctx)
		if err != nil {
			return nil, err
		}
		scope.allowedAdminIDs = append(scope.allowedAdminIDs, childIDs...)
	case biz.AdminLevelSecondary:
		scope.allowedAdminIDs = []int{a.ID}
	default:
		return nil, biz.ErrNoPermission
	}

	return scope, nil
}

func (r *userAdminRepo) ensureUserInScope(ctx context.Context, scope *adminScope, userID int) error {
	if userID <= 0 {
		return biz.ErrBadParam
	}
	if scope == nil {
		return biz.ErrNoPermission
	}

	if scope.isSuper {
		exists, err := r.data.mysql.User.Query().Where(user.IDEQ(userID)).Exist(ctx)
		if err != nil {
			return err
		}
		if !exists {
			return biz.ErrUserNotFound
		}
		return nil
	}

	if len(scope.allowedAdminIDs) == 0 {
		return biz.ErrNoPermission
	}

	exists, err := r.data.mysql.User.Query().
		Where(
			user.IDEQ(userID),
			user.AdminIDIn(scope.allowedAdminIDs...),
		).
		Exist(ctx)
	if err != nil {
		return err
	}
	if exists {
		return nil
	}

	exists, err = r.data.mysql.User.Query().Where(user.IDEQ(userID)).Exist(ctx)
	if err != nil {
		return err
	}
	if exists {
		return biz.ErrNoPermission
	}
	return biz.ErrUserNotFound
}

// =======================
// list
// =======================

// ✅ 新增：搜索 + 分页 + total + filter
func (r *userAdminRepo) ListUsers(ctx context.Context, limit, offset int, usernameLike string, filter string, operatorAdminID int, operatorAdminName string) ([]*biz.User, int, error) {
	l := r.log.WithContext(ctx)

	if limit <= 0 {
		limit = 30
	}
	if limit > 200 {
		limit = 200
	}
	if offset < 0 {
		offset = 0
	}
	usernameLike = strings.TrimSpace(usernameLike)

	l.Infof("ListUsers start operator_admin_id=%d limit=%d offset=%d username_like=%q filter=%q", operatorAdminID, limit, offset, usernameLike, filter)

	scope, err := r.loadAdminScope(ctx, operatorAdminID, operatorAdminName)
	if err != nil {
		l.Warnf("ListUsers loadAdminScope failed operator_admin_id=%d err=%v", operatorAdminID, err)
		return nil, 0, err
	}

	q := r.data.mysql.User.Query()
	if !scope.isSuper {
		if len(scope.allowedAdminIDs) == 0 {
			return []*biz.User{}, 0, nil
		}
		q = q.Where(user.AdminIDIn(scope.allowedAdminIDs...))
	}

	// username 模糊匹配（contains）
	if usernameLike != "" {
		// 你也可以用 ContainsFold 做大小写不敏感（取决于 ent 版本/生成器）
		q = q.Where(user.UsernameContains(usernameLike))
	}

	// ✅ filter 处理
	now := time.Now()

	warningDays := int(r.data.conf.UserExpiryWarningDays)
	if warningDays <= 0 {
		warningDays = 3
	}

	if filter == "expired" {
		q = q.Where(user.ExpiresAtLT(now))
	} else if filter == "expiring_soon" {
		afterNDays := now.Add(time.Duration(warningDays) * 24 * time.Hour)
		q = q.Where(
			user.ExpiresAtGT(now),
			user.ExpiresAtLT(afterNDays),
		)
	} else if filter == "normal" {
		afterNDays := now.Add(time.Duration(warningDays) * 24 * time.Hour)
		// normal：非过期且不在“即将过期”窗口，包含永久用户（expires_at 为 NULL）。
		q = q.Where(
			user.Or(
				user.ExpiresAtIsNil(),
				user.ExpiresAtGTE(afterNDays),
			),
		)
	}

	// total
	total, err := q.Clone().Count(ctx)
	if err != nil {
		l.Errorf("ListUsers count failed err=%v", err)
		return nil, 0, err
	}

	rows, err := q.
		Order(ent.Desc(user.FieldID)).
		Limit(limit).
		Offset(offset).
		All(ctx)
	if err != nil {
		l.Errorf("ListUsers query failed err=%v", err)
		return nil, 0, err
	}

	out := make([]*biz.User, 0, len(rows))
	for _, u := range rows {
		out = append(out, &biz.User{
			ID:        u.ID,
			Username:  u.Username,
			Role:      u.Role,
			Disabled:  u.Disabled,
			AdminID:   u.AdminID,
			Points:    u.Points,
			ExpiresAt: u.ExpiresAt,
			CreatedAt: u.CreatedAt,
			UpdatedAt: u.UpdatedAt,
		})
	}

	l.Infof("ListUsers success count=%d total=%d", len(out), total)
	return out, total, nil
}

// =======================
// points
// =======================

func (r *userAdminRepo) SetUserPoints(ctx context.Context, operatorAdminID int, operatorAdminName string, userID int, points int64) (int64, error) {
	l := r.log.WithContext(ctx)

	scope, err := r.loadAdminScope(ctx, operatorAdminID, operatorAdminName)
	if err != nil {
		l.Warnf("SetUserPoints loadAdminScope failed operator_admin_id=%d err=%v", operatorAdminID, err)
		return 0, err
	}

	if userID <= 0 {
		l.Warnf("SetUserPoints bad user_id=%d", userID)
		return 0, biz.ErrBadParam
	}
	if points < 0 {
		l.Warnf("SetUserPoints bad points=%d user_id=%d", points, userID)
		return 0, biz.ErrBadParam
	}

	l.Infof("SetUserPoints start user_id=%d points=%d", userID, points)

	if err := r.ensureUserInScope(ctx, scope, userID); err != nil {
		l.Warnf("SetUserPoints scope denied operator_admin_id=%d user_id=%d err=%v", operatorAdminID, userID, err)
		return 0, err
	}

	n, err := r.data.mysql.User.UpdateOneID(userID).
		SetPoints(points).
		Save(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			l.Infof("SetUserPoints not found user_id=%d", userID)
			return 0, biz.ErrUserNotFound
		}
		l.Errorf("SetUserPoints failed user_id=%d points=%d err=%v", userID, points, err)
		return 0, err
	}

	l.Infof("SetUserPoints success user_id=%d after=%d", userID, n.Points)
	return n.Points, nil
}

func (r *userAdminRepo) AddUserPoints(ctx context.Context, operatorAdminID int, operatorAdminName string, userID int, delta int64) (int64, error) {
	l := r.log.WithContext(ctx)
	l.Infof("AddUserPoints start operator_admin_id=%d user_id=%d delta=%d", operatorAdminID, userID, delta)

	scope, err := r.loadAdminScope(ctx, operatorAdminID, operatorAdminName)
	if err != nil {
		l.Warnf("AddUserPoints loadAdminScope failed operator_admin_id=%d err=%v", operatorAdminID, err)
		return 0, err
	}
	if userID <= 0 {
		l.Warnf("AddUserPoints bad user_id=%d", userID)
		return 0, biz.ErrBadParam
	}
	if err := r.ensureUserInScope(ctx, scope, userID); err != nil {
		l.Warnf("AddUserPoints scope denied operator_admin_id=%d user_id=%d err=%v", operatorAdminID, userID, err)
		return 0, err
	}

	// MySQL 原子更新：points = GREATEST(points + ?, 0)
	res, err := r.data.sqldb.ExecContext(ctx,
		"UPDATE users SET points = GREATEST(points + ?, 0), updated_at = NOW() WHERE id = ?",
		delta, userID,
	)
	if err != nil {
		l.Errorf("AddUserPoints update failed user_id=%d err=%v", userID, err)
		return 0, err
	}

	aff, _ := res.RowsAffected()
	if aff == 0 {
		l.Warnf("AddUserPoints not found user_id=%d", userID)
		return 0, biz.ErrUserNotFound
	}

	// 取 after（再查一次即可，后台接口 QPS 不高）
	u, err := r.data.mysql.User.Query().Where(user.IDEQ(userID)).Only(ctx)
	if err != nil {
		l.Errorf("AddUserPoints query after failed user_id=%d err=%v", userID, err)
		return 0, err
	}

	l.Infof("AddUserPoints success user_id=%d after=%d", userID, u.Points)
	return u.Points, nil
}

// =======================
// expires
// =======================

func (r *userAdminRepo) SetUserExpiresAt(ctx context.Context, operatorAdminID int, operatorAdminName string, userID int, t *time.Time) (*time.Time, error) {
	l := r.log.WithContext(ctx)

	scope, err := r.loadAdminScope(ctx, operatorAdminID, operatorAdminName)
	if err != nil {
		l.Warnf("SetUserExpiresAt loadAdminScope failed operator_admin_id=%d err=%v", operatorAdminID, err)
		return nil, err
	}

	if userID <= 0 {
		l.Warnf("SetUserExpiresAt bad user_id=%d", userID)
		return nil, biz.ErrBadParam
	}

	if t == nil {
		l.Infof("SetUserExpiresAt start user_id=%d clear=true", userID)
	} else {
		l.Infof("SetUserExpiresAt start user_id=%d expires_at=%s", userID, t.Format(time.RFC3339))
	}

	upd := r.data.mysql.User.UpdateOneID(userID)
	if t == nil {
		upd = upd.ClearExpiresAt()
	} else {
		upd = upd.SetExpiresAt(*t)
	}

	if err := r.ensureUserInScope(ctx, scope, userID); err != nil {
		l.Warnf("SetUserExpiresAt scope denied operator_admin_id=%d user_id=%d err=%v", operatorAdminID, userID, err)
		return nil, err
	}

	n, err := upd.Save(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			l.Infof("SetUserExpiresAt not found user_id=%d", userID)
			return nil, biz.ErrUserNotFound
		}
		l.Errorf("SetUserExpiresAt failed user_id=%d err=%v", userID, err)
		return nil, err
	}

	l.Infof("SetUserExpiresAt success user_id=%d after=%v", userID, n.ExpiresAt)
	return n.ExpiresAt, nil
}

func (r *userAdminRepo) ExtendUserExpires(ctx context.Context, operatorAdminID int, operatorAdminName string, userID int, addSeconds int64) (*time.Time, error) {
	l := r.log.WithContext(ctx)
	l.Infof("ExtendUserExpires start operator_admin_id=%d user_id=%d add_seconds=%d", operatorAdminID, userID, addSeconds)

	scope, err := r.loadAdminScope(ctx, operatorAdminID, operatorAdminName)
	if err != nil {
		l.Warnf("ExtendUserExpires loadAdminScope failed operator_admin_id=%d err=%v", operatorAdminID, err)
		return nil, err
	}
	if userID <= 0 {
		l.Warnf("ExtendUserExpires bad user_id=%d", userID)
		return nil, biz.ErrBadParam
	}
	if err := r.ensureUserInScope(ctx, scope, userID); err != nil {
		l.Warnf("ExtendUserExpires scope denied operator_admin_id=%d user_id=%d err=%v", operatorAdminID, userID, err)
		return nil, err
	}

	if addSeconds <= 0 {
		return nil, biz.ErrBadParam
	}

	// expires_at = DATE_ADD(GREATEST(COALESCE(expires_at, NOW()), NOW()), INTERVAL ? SECOND)
	// 原子规则：
	// - expires_at NULL 或已过期：从 NOW() 开始延长
	// - 未过期：从 expires_at 继续延长
	res, err := r.data.sqldb.ExecContext(ctx,
		`UPDATE users
		 SET expires_at = DATE_ADD(GREATEST(COALESCE(expires_at, NOW()), NOW()), INTERVAL ? SECOND),
		     updated_at = NOW()
		 WHERE id = ?`,
		addSeconds, userID,
	)
	if err != nil {
		l.Errorf("ExtendUserExpires update failed user_id=%d err=%v", userID, err)
		return nil, err
	}

	aff, _ := res.RowsAffected()
	if aff == 0 {
		l.Warnf("ExtendUserExpires not found user_id=%d", userID)
		return nil, biz.ErrUserNotFound
	}

	u, err := r.data.mysql.User.Query().Where(user.IDEQ(userID)).Only(ctx)
	if err != nil {
		l.Errorf("ExtendUserExpires query after failed user_id=%d err=%v", userID, err)
		return nil, err
	}

	l.Infof("ExtendUserExpires success user_id=%d after=%v", userID, u.ExpiresAt)
	return u.ExpiresAt, nil
}

func (r *userAdminRepo) SetUserDisabled(ctx context.Context, operatorAdminID int, operatorAdminName string, userID int, disabled bool) error {
	l := r.log.WithContext(ctx)
	l.Infof("SetUserDisabled start operator_admin_id=%d user_id=%d disabled=%v", operatorAdminID, userID, disabled)

	scope, err := r.loadAdminScope(ctx, operatorAdminID, operatorAdminName)
	if err != nil {
		l.Warnf("SetUserDisabled loadAdminScope failed operator_admin_id=%d err=%v", operatorAdminID, err)
		return err
	}
	if userID <= 0 {
		l.Warnf("SetUserDisabled bad user_id=%d", userID)
		return biz.ErrBadParam
	}
	if err := r.ensureUserInScope(ctx, scope, userID); err != nil {
		l.Warnf("SetUserDisabled scope denied operator_admin_id=%d user_id=%d err=%v", operatorAdminID, userID, err)
		return err
	}

	_, err = r.data.mysql.User.UpdateOneID(userID).SetDisabled(disabled).Save(ctx)
	if err != nil {
		if ent.IsNotFound(err) {
			l.Warnf("SetUserDisabled not found user_id=%d", userID)
			return biz.ErrUserNotFound
		}
		l.Errorf("SetUserDisabled failed user_id=%d err=%v", userID, err)
		return err
	}

	l.Infof("SetUserDisabled success user_id=%d", userID)
	return nil
}

// =======================
// stats
// =======================

func (r *userAdminRepo) GetExpiryStats(ctx context.Context, operatorAdminID int, operatorAdminName string) (int, int, int, int, error) {
	l := r.log.WithContext(ctx)

	scope, err := r.loadAdminScope(ctx, operatorAdminID, operatorAdminName)
	if err != nil {
		l.Warnf("GetExpiryStats loadAdminScope failed operator_admin_id=%d err=%v", operatorAdminID, err)
		return 0, 0, 0, 0, err
	}

	// 基础查询：限定在当前管理员管辖范围内
	q := r.data.mysql.User.Query()
	if !scope.isSuper {
		if len(scope.allowedAdminIDs) == 0 {
			// 如果不是超级管理员且没有下级，说明看不到任何用户 (理论上连自己都不一定包含在 allowedAdminIDs 里，看具体逻辑)
			// 但 loadAdminScope 逻辑里 allowedAdminIDs 包含了自己。
			return 0, 0, 0, 0, nil
		}
		q = q.Where(user.AdminIDIn(scope.allowedAdminIDs...))
	}

	now := time.Now()

	warningDays := int(r.data.conf.UserExpiryWarningDays)
	if warningDays <= 0 {
		warningDays = 3
	}
	afterNDays := now.Add(time.Duration(warningDays) * 24 * time.Hour)

	// 1. 已过期：expires_at < now (且不为 NULL)
	expired, err := q.Clone().
		Where(user.ExpiresAtLT(now)).
		Count(ctx)
	if err != nil {
		l.Errorf("GetExpiryStats count expired failed err=%v", err)
		return 0, 0, 0, 0, err
	}

	// 2. 即将过期：now < expires_at < now + N days
	expiringSoon, err := q.Clone().
		Where(
			user.ExpiresAtGT(now),
			user.ExpiresAtLT(afterNDays),
		).
		Count(ctx)
	if err != nil {
		l.Errorf("GetExpiryStats count expiringSoon failed err=%v", err)
		return 0, 0, 0, 0, err
	}

	normal, err := q.Clone().
		Where(
			user.Or(
				user.ExpiresAtIsNil(),
				user.ExpiresAtGTE(afterNDays),
			),
		).
		Count(ctx)
	if err != nil {
		l.Errorf("GetExpiryStats count normal failed err=%v", err)
		return 0, 0, 0, 0, err
	}

	l.Infof("GetExpiryStats success expired=%d expiringSoon=%d normal=%d warningDays=%d", expired, expiringSoon, normal, warningDays)
	return expired, expiringSoon, normal, warningDays, nil
}
