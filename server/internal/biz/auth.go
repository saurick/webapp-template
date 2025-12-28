package biz

import (
	"context"
	"errors"
	"time"

	"github.com/go-kratos/kratos/v2/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrUserExists         = errors.New("user already exists")
	ErrUserNotFound       = errors.New("user not found")
	ErrInvalidPassword    = errors.New("invalid password")
	ErrUserDisabled       = errors.New("user disabled")
	ErrInviteCodeNotFound = errors.New("invite code not found")
	ErrInviteCodeUsedUp   = errors.New("invite code used up")
	ErrInviteCodeExpired  = errors.New("invite code expired")
	ErrInviteCodeDisabled = errors.New("invite code disabled")
)

type AuthRepo interface {
	GetUserByUsername(ctx context.Context, username string) (*User, error)
	CreateUser(ctx context.Context, u *User) (*User, error)
	UpdateUserLastLogin(ctx context.Context, id int, t time.Time) error

	GetInviteCode(ctx context.Context, code string) (*InviteCode, error)
	IncreaseInviteCodeUsage(ctx context.Context, id int) error

	// ✅ 邀请码管理（给前端页面用）
	ListInviteCodes(ctx context.Context, limit, offset int) ([]*InviteCode, error)
	CreateInviteCode(ctx context.Context, ic *InviteCode) (*InviteCode, error)
	SetInviteCodeDisabled(ctx context.Context, id int, disabled bool) error

	// ✅ 可选：测试用（你的前端 used+1 按钮）
	IncreaseInviteCodeUsageBy(ctx context.Context, id int, delta int) error
}

type User struct {
	ID           int
	Username     string
	PasswordHash string
	InviteCode   *string
	Disabled     bool
	Role         int8 // 0=user, 1=admin
}

type InviteCode struct {
	ID        int
	Code      string
	MaxUses   int
	UsedCount int
	ExpiresAt *time.Time
	Disabled  bool
}

type TokenGenerator func(userID int, username string, role int8) (token string, expireAt time.Time, err error)

type AuthUsecase struct {
	// 日志
	log    *log.Helper
	logger log.Logger

	// tracing
	tp     *tracesdk.TracerProvider
	tracer trace.Tracer

	// repo & token
	repo   AuthRepo
	genTok TokenGenerator
}

func NewAuthUsecase(repo AuthRepo, genTok TokenGenerator, logger log.Logger, tp *tracesdk.TracerProvider) *AuthUsecase {
	helper := log.NewHelper(log.With(logger, "module", "biz.auth"))

	// tracer 优先用注入的 tp；tp 为空就 fallback 全局 provider
	var tr trace.Tracer
	if tp != nil {
		tr = tp.Tracer("biz.auth")
	} else {
		tr = otel.Tracer("biz.auth")
	}

	return &AuthUsecase{
		repo:   repo,
		genTok: genTok,
		log:    helper,
		logger: logger,
		tp:     tp,
		tracer: tr,
	}
}

func (uc *AuthUsecase) Tracer(opts ...trace.TracerOption) trace.Tracer {
	if uc.tracer != nil {
		// opts 不会影响已创建 tracer（一般也没必要）
		return uc.tracer
	}
	return otel.Tracer("biz.auth", opts...)
}

// ======================
// 注册（带邀请码）
// ======================

func (uc *AuthUsecase) Register(ctx context.Context, username, password, inviteCode string) (token string, expireAt time.Time, u *User, err error) {
	ctx, span := uc.Tracer().Start(ctx, "auth.register",
		trace.WithAttributes(
			attribute.String("auth.username", username),
			attribute.String("auth.invite_code", inviteCode),
		),
	)
	defer span.End()

	l := uc.log.WithContext(ctx)

	if username == "" || password == "" || inviteCode == "" {
		err = errors.New("missing username/password/invite_code")
		span.RecordError(err)
		span.SetStatus(codes.Error, "invalid argument")
		l.Warnf("Register invalid args username=%q invite_code=%q", username, inviteCode)
		return "", time.Time{}, nil, err
	}

	l.Infof("Register start username=%s invite_code=%s", username, inviteCode)

	// 1) 校验邀请码
	ic, e := uc.repo.GetInviteCode(ctx, inviteCode)
	if e != nil || ic == nil {
		err = ErrInviteCodeNotFound
		span.RecordError(e)
		span.SetStatus(codes.Error, err.Error())
		l.Infof("Register invite code not found invite_code=%s err=%v", inviteCode, e)
		return "", time.Time{}, nil, err
	}

	span.SetAttributes(
		attribute.Int("auth.invite_id", ic.ID),
		attribute.Int("auth.invite_used_count", ic.UsedCount),
		attribute.Int("auth.invite_max_uses", ic.MaxUses),
		attribute.Bool("auth.invite_disabled", ic.Disabled),
	)

	if ic.Disabled {
		err = ErrInviteCodeDisabled
		span.SetStatus(codes.Error, err.Error())
		l.Infof("Register invite code disabled invite_code=%s", inviteCode)
		return "", time.Time{}, nil, err
	}
	if ic.MaxUses > 0 && ic.UsedCount >= ic.MaxUses {
		err = ErrInviteCodeUsedUp
		span.SetStatus(codes.Error, err.Error())
		l.Infof("Register invite code used up invite_code=%s used=%d max=%d", inviteCode, ic.UsedCount, ic.MaxUses)
		return "", time.Time{}, nil, err
	}
	if ic.ExpiresAt != nil && ic.ExpiresAt.Before(time.Now()) {
		err = ErrInviteCodeExpired
		span.SetAttributes(attribute.Int64("auth.invite_expires_at", ic.ExpiresAt.Unix()))
		span.SetStatus(codes.Error, err.Error())
		l.Infof("Register invite code expired invite_code=%s expires_at=%s", inviteCode, ic.ExpiresAt.Format(time.RFC3339))
		return "", time.Time{}, nil, err
	}

	// 2) 用户名是否已存在
	exist, e := uc.repo.GetUserByUsername(ctx, username)
	if e == nil && exist != nil {
		err = ErrUserExists
		span.SetStatus(codes.Error, err.Error())
		l.Infof("Register user already exists username=%s", username)
		return "", time.Time{}, nil, err
	}
	// 如果 repo 返回 error（比如 not found / db error），这里不强判，交给后续 CreateUser 去兜底（唯一索引）

	// 3) 哈希密码（不打印 password）
	hash, e := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if e != nil {
		err = e
		span.RecordError(err)
		span.SetStatus(codes.Error, "hash password failed")
		l.Errorf("Register hash password failed username=%s err=%v", username, err)
		return "", time.Time{}, nil, err
	}

	inviteCodeCopy := inviteCode
	newUser := &User{
		Username:     username,
		PasswordHash: string(hash),
		InviteCode:   &inviteCodeCopy,
	}

	// 4) 创建用户
	created, e := uc.repo.CreateUser(ctx, newUser)
	if e != nil {
		err = e
		span.RecordError(err)
		span.SetStatus(codes.Error, "create user failed")
		l.Errorf("Register create user failed username=%s err=%v", username, err)
		return "", time.Time{}, nil, err
	}

	span.SetAttributes(attribute.Int("auth.user_id", created.ID))

	// 5) 更新邀请码使用次数
	if e := uc.repo.IncreaseInviteCodeUsage(ctx, ic.ID); e != nil {
		err = e
		span.RecordError(err)
		span.SetStatus(codes.Error, "increase invite usage failed")
		l.Errorf("Register increase invite usage failed invite_id=%d invite_code=%s err=%v", ic.ID, inviteCode, err)
		return "", time.Time{}, nil, err
	}

	// 6) 创建 token
	// 注册出来的用户默认 Role=0（普通用户）
	created.Role = 0
	token, expireAt, e = uc.genTok(created.ID, created.Username, created.Role)
	if e != nil {
		err = e
		span.RecordError(err)
		span.SetStatus(codes.Error, "generate token failed")
		l.Errorf("Register generate token failed user_id=%d username=%s err=%v", created.ID, created.Username, err)
		return "", time.Time{}, nil, err
	}

	span.SetAttributes(attribute.Int64("auth.token_expires_at", expireAt.Unix()))

	// 7) 更新 last_login_at（失败不影响主流程）
	if e := uc.repo.UpdateUserLastLogin(ctx, created.ID, time.Now()); e != nil {
		span.RecordError(e)
		l.Warnf("Register update last_login_at failed user_id=%d err=%v", created.ID, e)
	}

	span.SetStatus(codes.Ok, "OK")
	l.Infof("Register success user_id=%d username=%s", created.ID, created.Username)

	return token, expireAt, created, nil
}

// ======================
// 登录
// ======================

func (uc *AuthUsecase) Login(ctx context.Context, username, password string) (token string, expireAt time.Time, u *User, err error) {
	ctx, span := uc.Tracer().Start(ctx, "auth.login",
		trace.WithAttributes(
			attribute.String("auth.username", username),
		),
	)
	defer span.End()

	l := uc.log.WithContext(ctx)

	if username == "" || password == "" {
		err = errors.New("missing username or password")
		span.RecordError(err)
		span.SetStatus(codes.Error, "invalid argument")
		l.Warnf("Login invalid args username=%q", username)
		return "", time.Time{}, nil, err
	}

	l.Infof("Login start username=%s", username)

	usr, e := uc.repo.GetUserByUsername(ctx, username)
	if e != nil || usr == nil {
		err = ErrUserNotFound
		span.RecordError(e)
		span.SetStatus(codes.Error, err.Error())
		l.Infof("Login user not found username=%s err=%v", username, e)
		return "", time.Time{}, nil, err
	}

	span.SetAttributes(attribute.Int("auth.user_id", usr.ID))

	if usr.Disabled {
		err = ErrUserDisabled
		span.SetStatus(codes.Error, err.Error())
		l.Infof("Login user disabled user_id=%d username=%s", usr.ID, username)
		return "", time.Time{}, nil, err
	}

	// 不要记录 password
	if bcrypt.CompareHashAndPassword([]byte(usr.PasswordHash), []byte(password)) != nil {
		err = ErrInvalidPassword
		span.SetStatus(codes.Error, err.Error())
		l.Infof("Login invalid password user_id=%d username=%s", usr.ID, username)
		return "", time.Time{}, nil, err
	}

	uc.log.WithContext(ctx).Infof("Login user=%s id=%d role=%d", usr.Username, usr.ID, usr.Role)

	token, expireAt, e = uc.genTok(usr.ID, usr.Username, usr.Role)
	if e != nil {
		err = e
		span.RecordError(err)
		span.SetStatus(codes.Error, "generate token failed")
		l.Errorf("Login generate token failed user_id=%d username=%s err=%v", usr.ID, usr.Username, err)
		return "", time.Time{}, nil, err
	}

	span.SetAttributes(attribute.Int64("auth.token_expires_at", expireAt.Unix()))

	if e := uc.repo.UpdateUserLastLogin(ctx, usr.ID, time.Now()); e != nil {
		span.RecordError(e)
		l.Warnf("Login update last_login_at failed user_id=%d err=%v", usr.ID, e)
	}

	span.SetStatus(codes.Ok, "OK")
	l.Infof("Login success user_id=%d username=%s", usr.ID, usr.Username)

	return token, expireAt, usr, nil
}
