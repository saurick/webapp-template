// server/internal/data/jsonrpc.go
package data

import (
	"context"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"math/big"
	"strings"
	"time"

	v1 "server/api/jsonrpc/v1"
	"server/internal/biz"
	"server/internal/conf"

	"github.com/go-kratos/kratos/v2/log"
	"google.golang.org/protobuf/types/known/structpb"

	tracesdk "go.opentelemetry.io/otel/sdk/trace"
)

// JsonrpcData：
// 1) JSON-RPC 的唯一业务入口
// 2) method 路由（system / auth / …）
// 3) 直接调用 Usecase
type JsonrpcData struct {
	log      *log.Helper
	cfg      *conf.Data
	authUC   *biz.AuthUsecase
	authRepo *authRepo
}

// NewJsonrpcData：由 wire 注入（但不注入 usecase）
// 由 JsonrpcData 自己组装 AuthUsecase，保持“入口聚合”风格
func NewJsonrpcData(
	c *conf.Data,
	logger log.Logger,

	// 只注入底层依赖
	authRepo *authRepo,
	tokenGenerator biz.TokenGenerator,

	// 链路追踪
	tracerProvider *tracesdk.TracerProvider,
) *JsonrpcData {
	helper := log.NewHelper(log.With(logger, "module", "data.jsonrpc"))

	if authRepo == nil {
		panic("NewJsonrpcData: authRepo is nil")
	}
	if tokenGenerator == nil {
		panic("NewJsonrpcData: tokenGenerator is nil")
	}
	if tracerProvider == nil {
		panic("NewJsonrpcData: tracerProvider is nil")
	}

	authUC := biz.NewAuthUsecase(authRepo, tokenGenerator, logger, tracerProvider)
	helper.Info("JsonrpcData created (auth usecase constructed inside)")

	return &JsonrpcData{
		log:      helper,
		cfg:      c,
		authUC:   authUC,
		authRepo: authRepo,
	}
}

var _ biz.JsonrpcRepo = (*JsonrpcData)(nil)

// Handle 是 JSON-RPC 的统一入口
func (d *JsonrpcData) Handle(
	ctx context.Context,
	url, jsonrpc, method, id string,
	params *structpb.Struct,
) (string, *v1.JsonrpcResult, error) {

	d.log.WithContext(ctx).Infof(
		"[jsonrpc] handle url=%s jsonrpc=%s method=%s id=%s",
		url, jsonrpc, method, id,
	)

	if params == nil {
		d.log.WithContext(ctx).Info("[jsonrpc] params=<nil>")
	} else {
		m := params.AsMap()
		b, _ := json.MarshalIndent(m, "", "  ")
		d.log.WithContext(ctx).Infof("[jsonrpc] params=%s", string(b))
	}

	// ✅ 公开接口白名单：不需要登录
	if !d.isPublic(url, method) {
		if _, res := d.requireLogin(ctx); res != nil {
			return id, res, nil
		}
	}

	switch url {
	case "system":
		// ✅ 修正参数顺序：handleSystem(ctx, id, method, params)
		return d.handleSystem(ctx, id, method, params)
	case "auth":
		return d.handleAuth(ctx, method, id, params)
	default:
		return id, &v1.JsonrpcResult{
			Code:    40001,
			Message: fmt.Sprintf("unknown jsonrpc url=%s", url),
		}, nil
	}
}

// =========================
// system domain
// =========================

func (r *JsonrpcData) handleSystem(
	ctx context.Context,
	id, method string,
	_ *structpb.Struct,
) (string, *v1.JsonrpcResult, error) {

	logger := r.log.WithContext(ctx)
	logger.Info("Jsonrpc.system: start", "method", method, "id", id)

	switch method {
	case "ping":
		data := newDataStruct(map[string]any{"pong": "pong"})
		logger.Info("Jsonrpc.system.ping: success", "id", id)
		return id, &v1.JsonrpcResult{Code: 0, Message: "OK", Data: data}, nil

	case "version":
		data := newDataStruct(map[string]any{"version": "1.0.0"})
		logger.Info("Jsonrpc.system.version: success", "id", id)
		return id, &v1.JsonrpcResult{Code: 0, Message: "OK", Data: data}, nil

	default:
		logger.Warn("Jsonrpc.system: unknown method", "method", method, "id", id)
		return id, &v1.JsonrpcResult{
			Code:    404,
			Message: fmt.Sprintf("unknown system method: %s", method),
		}, nil
	}
}

// =========================
// auth domain (login/register + invite 管理)
// =========================

func (d *JsonrpcData) handleAuth(
	ctx context.Context,
	method, id string,
	params *structpb.Struct,
) (string, *v1.JsonrpcResult, error) {

	d.log.WithContext(ctx).Infof("[auth] method=%s id=%s", method, id)

	pm := map[string]any{}
	if params != nil {
		pm = params.AsMap()
	}

	// invite.* 只允许管理员
	if strings.HasPrefix(method, "invite.") {
		claims, ok := biz.GetClaimsFromContext(ctx)
		if !ok || !claims.IsAdmin() {
			return id, &v1.JsonrpcResult{
				Code:    40301,
				Message: "只有管理员才能操作",
			}, nil
		}
	}

	// ✅ helper：invite.* 只允许 admin
	// requireAdmin := func() *v1.JsonrpcResult {
	// 	claims, ok := biz.GetClaimsFromContext(ctx) // ← 你项目里取 claims 的函数名按实际改
	// 	if !ok || claims == nil {
	// 		return &v1.JsonrpcResult{Code: 40101, Message: "请先登录"}
	// 	}
	// 	if claims.Role != biz.RoleAdmin { // ← 你的 Role 常量名按实际改
	// 		return &v1.JsonrpcResult{Code: 40301, Message: "只有管理员才能操作"}
	// 	}
	// 	return nil
	// }

	switch method {

	// ---------- login ----------
	case "login":
		username := getString(pm, "username")
		password := getString(pm, "password")

		if username == "" || password == "" {
			return id, &v1.JsonrpcResult{Code: 40010, Message: "缺少用户名或密码"}, nil
		}

		token, expireAt, user, err := d.authUC.Login(ctx, username, password)
		if err != nil {
			return id, d.mapAuthError(ctx, err), nil
		}

		return id, &v1.JsonrpcResult{
			Code:    0,
			Message: "登录成功",
			Data: newDataStruct(map[string]any{
				"user_id":      user.ID,
				"username":     user.Username,
				"access_token": token,
				"expires_at":   expireAt.Unix(),
				"token_type":   "Bearer",
				"issued_at":    time.Now().Unix(),
			}),
		}, nil

	// ---------- register ----------
	case "register":
		username := getString(pm, "username")
		password := getString(pm, "password")
		inviteCode := getString(pm, "invite_code")

		if username == "" || password == "" || inviteCode == "" {
			return id, &v1.JsonrpcResult{Code: 40011, Message: "missing username/password/invite_code"}, nil
		}

		token, expireAt, user, err := d.authUC.Register(ctx, username, password, inviteCode)
		if err != nil {
			return id, d.mapAuthError(ctx, err), nil
		}

		return id, &v1.JsonrpcResult{
			Code:    0,
			Message: "注册成功",
			Data: newDataStruct(map[string]any{
				"user_id":      user.ID,
				"username":     user.Username,
				"access_token": token,
				"expires_at":   expireAt.Unix(),
				"token_type":   "Bearer",
				"issued_at":    time.Now().Unix(),
				"invite_code":  inviteCode,
			}),
		}, nil

		// ---------- logout ----------
	case "logout":
		claims, _ := biz.GetClaimsFromContext(ctx)
		if claims != nil {
			d.log.WithContext(ctx).Infof(
				"[auth] user logout uid=%d uname=%s role=%d",
				claims.UserID,
				claims.Username,
				claims.Role, "id", id)
		} else {
			d.log.WithContext(ctx).Warnf(
				"[auth] user logout failed: no claims found id=%s",
				"id", id)
		}

		return id, &v1.JsonrpcResult{
			Code:    0,
			Message: "OK",
		}, nil

	// ---------- invite.list ----------
	case "invite.list":
		if _, res := d.requireAdmin(ctx); res != nil {
			return id, res, nil
		}

		limit := getInt(pm, "limit", 200)
		offset := getInt(pm, "offset", 0)

		list, err := d.authRepo.ListInviteCodes(ctx, limit, offset)
		if err != nil {
			d.log.WithContext(ctx).Errorf("[auth] invite.list err=%v", err)
			return id, &v1.JsonrpcResult{Code: 50010, Message: "获取邀请码列表失败"}, nil
		}

		arr := make([]any, 0, len(list))
		for _, ic := range list {
			exp := int64(0)
			if ic.ExpiresAt != nil {
				exp = ic.ExpiresAt.Unix()
			}
			arr = append(arr, map[string]any{
				"id":         ic.ID,
				"code":       ic.Code,
				"max_uses":   ic.MaxUses,
				"used_count": ic.UsedCount,
				"expires_at": exp, // 0=无过期
				"disabled":   ic.Disabled,
			})
		}

		return id, &v1.JsonrpcResult{
			Code:    0,
			Message: "获取邀请码列表成功",
			Data:    newDataStruct(map[string]any{"invite_codes": arr}),
		}, nil

	// ---------- invite.create ----------
	case "invite.create":
		if _, res := d.requireAdmin(ctx); res != nil {
			return id, res, nil
		}

		code := getString(pm, "code")
		if code == "" {
			code = randomInviteCode(10)
		}

		maxUses := getInt(pm, "max_uses", 10)
		if maxUses < 0 {
			maxUses = 0
		}

		disabled := getBool(pm, "disabled", false)

		var expiresAt *time.Time
		expTs := int64(getInt(pm, "expires_at", 0))
		if expTs > 0 {
			tm := time.Unix(expTs, 0)
			expiresAt = &tm
		}

		created, err := d.authRepo.CreateInviteCode(ctx, &biz.InviteCode{
			Code:      code,
			MaxUses:   maxUses,
			UsedCount: 0,
			ExpiresAt: expiresAt,
			Disabled:  disabled,
		})
		if err != nil {
			d.log.WithContext(ctx).Errorf("[auth] invite.create err=%v", err)
			return id, &v1.JsonrpcResult{Code: 50011, Message: "创建邀请码失败"}, nil
		}

		exp := int64(0)
		if created.ExpiresAt != nil {
			exp = created.ExpiresAt.Unix()
		}

		return id, &v1.JsonrpcResult{
			Code:    0,
			Message: "创建邀请码成功",
			Data: newDataStruct(map[string]any{
				"invite_code": map[string]any{
					"id":         created.ID,
					"code":       created.Code,
					"max_uses":   created.MaxUses,
					"used_count": created.UsedCount,
					"expires_at": exp,
					"disabled":   created.Disabled,
				},
			}),
		}, nil

	// ---------- invite.set_disabled ----------
	case "invite.set_disabled":
		if _, res := d.requireAdmin(ctx); res != nil {
			return id, res, nil
		}

		idi := getInt(pm, "id", 0)
		if idi <= 0 {
			return id, &v1.JsonrpcResult{Code: 40041, Message: "参数错误：id 无效"}, nil
		}
		disabled := getBool(pm, "disabled", false)

		if err := d.authRepo.SetInviteCodeDisabled(ctx, idi, disabled); err != nil {
			d.log.WithContext(ctx).Errorf("[auth] invite.set_disabled err=%v", err)
			return id, &v1.JsonrpcResult{Code: 50012, Message: "更新邀请码失败"}, nil
		}

		return id, &v1.JsonrpcResult{
			Code:    0,
			Message: "更新邀请码状态成功",
			Data:    newDataStruct(map[string]any{"success": true}),
		}, nil

	// ---------- invite.increase_used (测试用) ----------
	case "invite.increase_used":
		if _, res := d.requireAdmin(ctx); res != nil {
			return id, res, nil
		}

		idi := getInt(pm, "id", 0)
		if idi <= 0 {
			return id, &v1.JsonrpcResult{Code: 40051, Message: "参数错误：id 无效"}, nil
		}
		delta := getInt(pm, "delta", 1)
		if delta <= 0 {
			delta = 1
		}

		if err := d.authRepo.IncreaseInviteCodeUsageBy(ctx, idi, delta); err != nil {
			d.log.WithContext(ctx).Errorf("[auth] invite.increase_used err=%v", err)
			return id, &v1.JsonrpcResult{Code: 50013, Message: "更新使用次数失败"}, nil
		}

		return id, &v1.JsonrpcResult{
			Code:    0,
			Message: "更新使用次数成功",
			Data:    newDataStruct(map[string]any{"success": true}),
		}, nil

	default:
		return id, &v1.JsonrpcResult{
			Code:    40012,
			Message: fmt.Sprintf("auth: 未知方法=%s", method),
		}, nil
	}
}

func (d *JsonrpcData) mapAuthError(ctx context.Context, err error) *v1.JsonrpcResult {
	logger := d.log.WithContext(ctx)

	switch err {

	// ===== 用户相关 =====
	case biz.ErrUserNotFound:
		logger.Warn("[auth] user not found")
		return &v1.JsonrpcResult{
			Code:    10001,
			Message: "用户不存在",
		}

	case biz.ErrInvalidPassword:
		logger.Warn("[auth] invalid password")
		return &v1.JsonrpcResult{
			Code:    10002,
			Message: "密码错误",
		}

	case biz.ErrUserDisabled:
		logger.Warn("[auth] user disabled")
		return &v1.JsonrpcResult{
			Code:    10003,
			Message: "用户已被禁用",
		}

	case biz.ErrUserExists:
		logger.Warn("[auth] user already exists")
		return &v1.JsonrpcResult{
			Code:    10004,
			Message: "用户名已存在",
		}

	// ===== 邀请码相关 =====
	case biz.ErrInviteCodeNotFound:
		logger.Warn("[auth] invite code not found")
		return &v1.JsonrpcResult{
			Code:    20001,
			Message: "邀请码不存在",
		}

	case biz.ErrInviteCodeUsedUp:
		logger.Warn("[auth] invite code used up")
		return &v1.JsonrpcResult{
			Code:    20002,
			Message: "邀请码已用完",
		}

	case biz.ErrInviteCodeExpired:
		logger.Warn("[auth] invite code expired")
		return &v1.JsonrpcResult{
			Code:    20003,
			Message: "邀请码已过期",
		}

	case biz.ErrInviteCodeDisabled:
		logger.Warn("[auth] invite code disabled")
		return &v1.JsonrpcResult{
			Code:    20004,
			Message: "邀请码已被禁用",
		}

	// ===== 未知错误 =====
	default:
		logger.Errorf("[auth] internal error: %v", err)
		return &v1.JsonrpcResult{
			Code:    50000,
			Message: "系统内部错误",
		}
	}
}

// =========================
// helpers
// =========================

func getString(m map[string]any, key string) string {
	v, ok := m[key]
	if !ok || v == nil {
		return ""
	}
	switch x := v.(type) {
	case string:
		return x
	case float64:
		return fmt.Sprintf("%.0f", x)
	default:
		return fmt.Sprintf("%v", x)
	}
}

func getInt(m map[string]any, key string, def int) int {
	v, ok := m[key]
	if !ok || v == nil {
		return def
	}
	switch x := v.(type) {
	case float64:
		return int(x)
	case int:
		return x
	default:
		return def
	}
}

func getBool(m map[string]any, key string, def bool) bool {
	v, ok := m[key]
	if !ok || v == nil {
		return def
	}
	if b, ok := v.(bool); ok {
		return b
	}
	return def
}

func newDataStruct(m map[string]any) *structpb.Struct {
	if m == nil {
		return nil
	}
	s, err := structpb.NewStruct(m)
	if err != nil {
		return nil
	}
	return s
}

func randomInviteCode(n int) string {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	if n <= 0 {
		n = 10
	}
	out := make([]byte, n)
	for i := 0; i < n; i++ {
		rn, _ := rand.Int(rand.Reader, big.NewInt(int64(len(alphabet))))
		out[i] = alphabet[int(rn.Int64())]
	}
	return string(out)
}

func (d *JsonrpcData) requireLogin(ctx context.Context) (*biz.AuthClaims, *v1.JsonrpcResult) {
	// 1) 有 claims → 已登录
	if c, ok := biz.GetClaimsFromContext(ctx); ok && c != nil {
		return c, nil
	}

	// 2) 没 claims → 看 AuthState
	switch biz.AuthStateFrom(ctx) {
	case biz.AuthExpired:
		return nil, &v1.JsonrpcResult{Code: 10005, Message: "登录已过期，请重新登录"}
	case biz.AuthInvalid:
		// 可选：也可以直接当成 10005；建议区分一下，方便排错
		return nil, &v1.JsonrpcResult{Code: 10006, Message: "登录无效，请重新登录"}
	default:
		return nil, &v1.JsonrpcResult{Code: 40302, Message: "未登录"}
	}
}

func (d *JsonrpcData) requireAdmin(ctx context.Context) (*biz.AuthClaims, *v1.JsonrpcResult) {
	c, res := d.requireLogin(ctx)
	if res != nil {
		return nil, res
	}
	if c.Role != biz.RoleAdmin {
		return nil, &v1.JsonrpcResult{Code: 40301, Message: "需要管理员权限"}
	}
	return c, nil
}

func (d *JsonrpcData) isPublic(url, method string) bool {
	// system 公共
	if url == "system" && (method == "ping" || method == "version") {
		return true
	}
	// auth 公共（登录/注册/登出一般也允许不登录调用）
	if url == "auth" && (method == "login" || method == "register" || method == "logout") {
		return true
	}
	return false
}
