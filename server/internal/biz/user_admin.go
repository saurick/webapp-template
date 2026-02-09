// server/internal/biz/user_admin.go
package biz

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/go-kratos/kratos/v2/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/trace"
)

var (
	ErrForbidden    = errors.New("forbidden")
	ErrBadParam     = errors.New("bad param")
	ErrNoPermission = errors.New("no permission")
)

type UserAdminRepo interface {
	// list
	// list
	ListUsers(ctx context.Context, limit, offset int, usernameLike string, filter string, operatorAdminID int, operatorAdminName string) (list []*User, total int, err error)

	// points
	SetUserPoints(ctx context.Context, operatorAdminID int, operatorAdminName string, userID int, points int64) (after int64, err error)
	AddUserPoints(ctx context.Context, operatorAdminID int, operatorAdminName string, userID int, delta int64) (after int64, err error)

	// expires
	SetUserExpiresAt(ctx context.Context, operatorAdminID int, operatorAdminName string, userID int, t *time.Time) (after *time.Time, err error)
	ExtendUserExpires(ctx context.Context, operatorAdminID int, operatorAdminName string, userID int, addSeconds int64) (after *time.Time, err error)

	// disabled
	SetUserDisabled(ctx context.Context, operatorAdminID int, operatorAdminName string, userID int, disabled bool) error

	// stats
	// 返回过期用户数、即将过期用户数、正常用户数、后台配置的告警天数
	GetExpiryStats(ctx context.Context, operatorAdminID int, operatorAdminName string) (expired int, expiringSoon int, normal int, warningDays int, err error)
}
type UserAdminUsecase struct {
	repo   UserAdminRepo
	log    *log.Helper
	tracer trace.Tracer
}

func NewUserAdminUsecase(repo UserAdminRepo, logger log.Logger, tp *tracesdk.TracerProvider) *UserAdminUsecase {
	helper := log.NewHelper(log.With(logger, "module", "biz.useradmin"))

	// tracer 优先用注入 tp；否则 fallback 全局 provider
	var tr trace.Tracer
	if tp != nil {
		tr = tp.Tracer("biz.useradmin")
	} else {
		tr = otel.Tracer("biz.useradmin")
	}

	return &UserAdminUsecase{
		repo:   repo,
		log:    helper,
		tracer: tr,
	}
}

func (uc *UserAdminUsecase) Tracer() trace.Tracer {
	if uc.tracer != nil {
		return uc.tracer
	}
	return otel.Tracer("biz.useradmin")
}

// 只允许 admin
func (uc *UserAdminUsecase) requireAdmin(ctx context.Context) (*AuthClaims, error) {
	c, ok := GetClaimsFromContext(ctx)
	if !ok || c == nil {
		return nil, ErrForbidden
	}
	if c.Role != RoleAdmin {
		return nil, ErrForbidden
	}
	return c, nil
}

func (uc *UserAdminUsecase) List(
	ctx context.Context,
	limit, offset int,
	searchUsername string,
	filter string, // ✅ 新增：过滤条件 (expired / expiring_soon / normal)
) (list []*User, total int, err error) {

	ctx, span := uc.Tracer().Start(ctx, "useradmin.list",
		trace.WithAttributes(
			attribute.Int("useradmin.limit", limit),
			attribute.Int("useradmin.offset", offset),
			attribute.String("useradmin.search_username", strings.TrimSpace(searchUsername)),
			attribute.String("useradmin.filter", filter),
		),
	)
	defer span.End()

	l := uc.log.WithContext(ctx)

	admin, e := uc.requireAdmin(ctx)
	if e != nil {
		err = ErrForbidden
		span.SetStatus(codes.Error, err.Error())
		l.Warnf("List forbidden")
		return nil, 0, err
	}
	span.SetAttributes(attribute.Int("auth.admin_uid", admin.UserID))

	// ✅ 参数规范：前端默认 30；这里给出安全上限
	if limit <= 0 {
		limit = 30
	}
	if limit > 200 { // 你原来允许到 500，但前端分页没必要，200 更安全
		limit = 200
	}
	if offset < 0 {
		offset = 0
	}

	searchUsername = strings.TrimSpace(searchUsername)

	l.Infof("List start limit=%d offset=%d search=%q", limit, offset, searchUsername)

	// ✅ repo 改成返回 total（必须）
	list, total, err = uc.repo.ListUsers(ctx, limit, offset, searchUsername, filter, admin.UserID, admin.Username)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "repo.ListUsers failed")
		l.Errorf("List repo.ListUsers failed err=%v", err)
		return nil, 0, err
	}

	span.SetAttributes(
		attribute.Int("useradmin.count", len(list)),
		attribute.Int("useradmin.total", total),
	)
	span.SetStatus(codes.Ok, "OK")
	l.Infof("List success count=%d total=%d", len(list), total)

	return list, total, nil
}

func (uc *UserAdminUsecase) SetPoints(ctx context.Context, userID int, points int64) (after int64, err error) {
	ctx, span := uc.Tracer().Start(ctx, "useradmin.set_points",
		trace.WithAttributes(
			attribute.Int("user.id", userID),
			attribute.Int64("user.points", points),
		),
	)
	defer span.End()

	l := uc.log.WithContext(ctx)

	admin, e := uc.requireAdmin(ctx)
	if e != nil {
		err = ErrForbidden
		span.SetStatus(codes.Error, err.Error())
		l.Warnf("SetPoints forbidden user_id=%d", userID)
		return 0, err
	}
	span.SetAttributes(attribute.Int("auth.admin_uid", admin.UserID))

	if userID <= 0 || points < 0 {
		err = ErrBadParam
		span.SetStatus(codes.Error, "invalid argument")
		l.Warnf("SetPoints bad param user_id=%d points=%d", userID, points)
		return 0, err
	}

	l.Infof("SetPoints start user_id=%d points=%d", userID, points)

	after, err = uc.repo.SetUserPoints(ctx, admin.UserID, admin.Username, userID, points)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "repo.SetUserPoints failed")
		l.Errorf("SetPoints repo.SetUserPoints failed user_id=%d err=%v", userID, err)
		return 0, err
	}

	span.SetAttributes(attribute.Int64("user.points_after", after))
	span.SetStatus(codes.Ok, "OK")
	l.Infof("SetPoints success user_id=%d after=%d", userID, after)
	return after, nil
}

func (uc *UserAdminUsecase) AddPoints(ctx context.Context, userID int, delta int64) (after int64, err error) {
	ctx, span := uc.Tracer().Start(ctx, "useradmin.add_points",
		trace.WithAttributes(
			attribute.Int("user.id", userID),
			attribute.Int64("user.points_delta", delta),
		),
	)
	defer span.End()

	l := uc.log.WithContext(ctx)

	admin, e := uc.requireAdmin(ctx)
	if e != nil {
		err = ErrForbidden
		span.SetStatus(codes.Error, err.Error())
		l.Warnf("AddPoints forbidden user_id=%d", userID)
		return 0, err
	}
	span.SetAttributes(attribute.Int("auth.admin_uid", admin.UserID))

	if userID <= 0 {
		err = ErrBadParam
		span.SetStatus(codes.Error, "invalid argument")
		l.Warnf("AddPoints bad param user_id=%d", userID)
		return 0, err
	}

	l.Infof("AddPoints start user_id=%d delta=%d", userID, delta)

	after, err = uc.repo.AddUserPoints(ctx, admin.UserID, admin.Username, userID, delta)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "repo.AddUserPoints failed")
		l.Errorf("AddPoints repo.AddUserPoints failed user_id=%d err=%v", userID, err)
		return 0, err
	}

	span.SetAttributes(attribute.Int64("user.points_after", after))
	span.SetStatus(codes.Ok, "OK")
	l.Infof("AddPoints success user_id=%d after=%d", userID, after)
	return after, nil
}

// t=nil 表示清空到期时间（永久/未开通）
func (uc *UserAdminUsecase) SetExpiresAt(ctx context.Context, userID int, t *time.Time) (after *time.Time, err error) {
	var expUnix int64
	if t != nil {
		expUnix = t.Unix()
	}

	ctx, span := uc.Tracer().Start(ctx, "useradmin.set_expires_at",
		trace.WithAttributes(
			attribute.Int("user.id", userID),
			attribute.Int64("user.expires_at_unix", expUnix),
		),
	)
	defer span.End()

	l := uc.log.WithContext(ctx)

	admin, e := uc.requireAdmin(ctx)
	if e != nil {
		err = ErrForbidden
		span.SetStatus(codes.Error, err.Error())
		l.Warnf("SetExpiresAt forbidden user_id=%d", userID)
		return nil, err
	}
	span.SetAttributes(attribute.Int("auth.admin_uid", admin.UserID))

	if userID <= 0 {
		err = ErrBadParam
		span.SetStatus(codes.Error, "invalid argument")
		l.Warnf("SetExpiresAt bad param user_id=%d", userID)
		return nil, err
	}

	l.Infof("SetExpiresAt start user_id=%d expires_at=%v", userID, t)

	after, err = uc.repo.SetUserExpiresAt(ctx, admin.UserID, admin.Username, userID, t)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "repo.SetUserExpiresAt failed")
		l.Errorf("SetExpiresAt repo.SetUserExpiresAt failed user_id=%d err=%v", userID, err)
		return nil, err
	}

	if after != nil {
		span.SetAttributes(attribute.Int64("user.expires_at_after_unix", after.Unix()))
	} else {
		span.SetAttributes(attribute.Bool("user.expires_cleared", true))
	}

	span.SetStatus(codes.Ok, "OK")
	l.Infof("SetExpiresAt success user_id=%d after=%v", userID, after)
	return after, nil
}

// addSeconds>0 才允许延长
func (uc *UserAdminUsecase) ExtendExpires(ctx context.Context, userID int, addSeconds int64) (after *time.Time, err error) {
	ctx, span := uc.Tracer().Start(ctx, "useradmin.extend_expires",
		trace.WithAttributes(
			attribute.Int("user.id", userID),
			attribute.Int64("user.expires_add_seconds", addSeconds),
		),
	)
	defer span.End()

	l := uc.log.WithContext(ctx)

	admin, e := uc.requireAdmin(ctx)
	if e != nil {
		err = ErrForbidden
		span.SetStatus(codes.Error, err.Error())
		l.Warnf("ExtendExpires forbidden user_id=%d", userID)
		return nil, err
	}
	span.SetAttributes(attribute.Int("auth.admin_uid", admin.UserID))

	if userID <= 0 || addSeconds <= 0 {
		err = ErrBadParam
		span.SetStatus(codes.Error, "invalid argument")
		l.Warnf("ExtendExpires bad param user_id=%d add_seconds=%d", userID, addSeconds)
		return nil, err
	}

	l.Infof("ExtendExpires start user_id=%d add_seconds=%d", userID, addSeconds)

	after, err = uc.repo.ExtendUserExpires(ctx, admin.UserID, admin.Username, userID, addSeconds)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "repo.ExtendUserExpires failed")
		l.Errorf("ExtendExpires repo.ExtendUserExpires failed user_id=%d err=%v", userID, err)
		return nil, err
	}

	if after != nil {
		span.SetAttributes(attribute.Int64("user.expires_at_after_unix", after.Unix()))
	}

	span.SetStatus(codes.Ok, "OK")
	l.Infof("ExtendExpires success user_id=%d after=%v", userID, after)
	return after, nil
}

func (uc *UserAdminUsecase) SetDisabled(ctx context.Context, userID int, disabled bool) error {
	ctx, span := uc.tracer.Start(ctx, "useradmin.set_disabled")
	defer span.End()

	admin, e := uc.requireAdmin(ctx)
	if e != nil {
		span.SetStatus(codes.Error, ErrForbidden.Error())
		uc.log.WithContext(ctx).Warn("SetDisabled forbidden")
		return ErrForbidden
	}
	span.SetAttributes(attribute.Int("auth.admin_uid", admin.UserID))

	if userID <= 0 {
		uc.log.WithContext(ctx).Warn("SetDisabled bad userID")
		return ErrBadParam
	}

	uc.log.WithContext(ctx).Infof("SetDisabled user_id=%d disabled=%v", userID, disabled)
	return uc.repo.SetUserDisabled(ctx, admin.UserID, admin.Username, userID, disabled)
}

func (uc *UserAdminUsecase) GetExpiryStats(ctx context.Context) (expired int, expiringSoon int, normal int, warningDays int, err error) {
	ctx, span := uc.tracer.Start(ctx, "useradmin.get_expiry_stats")
	defer span.End()

	admin, e := uc.requireAdmin(ctx)
	if e != nil {
		span.SetStatus(codes.Error, ErrForbidden.Error())
		uc.log.WithContext(ctx).Warn("GetExpiryStats forbidden")
		return 0, 0, 0, 0, ErrForbidden
	}
	span.SetAttributes(attribute.Int("auth.admin_uid", admin.UserID))

	return uc.repo.GetExpiryStats(ctx, admin.UserID, admin.Username)
}
