// server/internal/data/jsonrpc.go
package data

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
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
	log         *log.Helper
	cfg         *conf.Data
	authUC      *biz.AuthUsecase
	userAdminUC *biz.UserAdminUsecase
}

// NewJsonrpcData：由 wire 注入（但不注入 usecase）
// 由 JsonrpcData 自己组装 AuthUsecase，保持“入口聚合”风格
func NewJsonrpcData(
	c *conf.Data,
	logger log.Logger,

	// 只注入底层依赖
	authRepo *authRepo,
	tokenGenerator biz.TokenGenerator,
	userAdminRepo biz.UserAdminRepo,

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

	userAdminUC := biz.NewUserAdminUsecase(userAdminRepo, logger, tracerProvider)
	helper.Info("JsonrpcData created (user admin usecase constructed inside)")

	return &JsonrpcData{
		log:         helper,
		cfg:         c,
		authUC:      authUC,
		userAdminUC: userAdminUC,
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
		return d.handleSystem(ctx, id, method, params)
	case "auth":
		return d.handleAuth(ctx, method, id, params)
	case "user":
		return d.handleUser(ctx, method, id, params)
	case "subscription":
		return d.handleSubscription(ctx, method, id, params)
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
// auth domain (login/register/logout)
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

		if username == "" || password == "" {
			return id, &v1.JsonrpcResult{Code: 40011, Message: "missing username/password"}, nil
		}

		token, expireAt, user, err := d.authUC.Register(ctx, username, password)
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
			}),
		}, nil

		// ---------- logout ----------
	case "logout":
		claims, _ := biz.GetClaimsFromContext(ctx)
		if claims != nil {
			d.log.WithContext(ctx).Infof(
				"[auth] user logout uid=%d uname=%s role=%d id=%s",
				claims.UserID,
				claims.Username,
				claims.Role,
				id,
			)
		} else {
			d.log.WithContext(ctx).Warnf(
				"[auth] user logout failed: no claims found id=%s",
				"id", id)
		}

		return id, &v1.JsonrpcResult{
			Code:    0,
			Message: "OK",
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

func getInt64(m map[string]any, key string, def int64) int64 {
	v, ok := m[key]
	if !ok || v == nil {
		return def
	}

	switch x := v.(type) {
	case int64:
		return x
	case int:
		return int64(x)
	case float64:
		return int64(x)
	case string:
		// 兜底：前端有时会传字符串数字
		if n, err := strconv.ParseInt(x, 10, 64); err == nil {
			return n
		}
		return def
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

func (d *JsonrpcData) handleUser(
	ctx context.Context,
	method, id string,
	params *structpb.Struct,
) (string, *v1.JsonrpcResult, error) {

	l := d.log.WithContext(ctx)

	// 解析 params
	pm := map[string]any{}
	if params != nil {
		pm = params.AsMap()
	}

	// 操作者（用于日志）
	var opUID int
	var opUname string
	var opRole biz.Role
	if c, ok := biz.GetClaimsFromContext(ctx); ok && c != nil {
		opUID, opUname, opRole = c.UserID, c.Username, c.Role
	}

	l.Infof("[user] handle start method=%s id=%s operator_uid=%d operator_uname=%s operator_role=%d",
		method, id, opUID, opUname, opRole,
	)

	// ✅ 统一管理员鉴权：用户管理全部要求 admin
	if _, res := d.requireAdmin(ctx); res != nil {
		l.Warnf("[user] requireAdmin denied method=%s id=%s operator_uid=%d code=%d msg=%s",
			method, id, opUID, res.Code, res.Message,
		)
		return id, res, nil
	}

	switch method {

	// ---------- user.list ----------
	// params: { limit, offset, search }  // search = username 模糊
	case "list":
		limit := getInt(pm, "limit", 30)
		offset := getInt(pm, "offset", 0)
		search := strings.TrimSpace(getString(pm, "search"))

		l.Infof("[user] list start id=%s operator_uid=%d limit=%d offset=%d search=%q",
			id, opUID, limit, offset, search,
		)

		list, total, err := d.userAdminUC.List(ctx, limit, offset, search)
		if err != nil {
			l.Errorf("[user] list failed id=%s operator_uid=%d limit=%d offset=%d search=%q err=%v",
				id, opUID, limit, offset, search, err,
			)
			return id, &v1.JsonrpcResult{Code: 50020, Message: "获取用户列表失败"}, nil
		}

		arr := make([]any, 0, len(list))
		for _, u := range list {
			exp := int64(0)
			if u.ExpiresAt != nil {
				exp = u.ExpiresAt.Unix()
			}
			arr = append(arr, map[string]any{
				"id":         u.ID,
				"username":   u.Username,
				"role":       u.Role,
				"disabled":   u.Disabled,
				"points":     u.Points,
				"expires_at": exp,
			})
		}

		l.Infof("[user] list success id=%s operator_uid=%d count=%d total=%d search=%q",
			id, opUID, len(list), total, search,
		)

		return id, &v1.JsonrpcResult{
			Code:    0,
			Message: "获取用户列表成功",
			Data: newDataStruct(map[string]any{
				"users":  arr,
				"total":  total,
				"limit":  limit,
				"offset": offset,
				"search": search,
			}),
		}, nil

	// ---------- user.points.set ----------
	case "points.set":
		userID := getInt(pm, "user_id", 0)
		points := getInt64(pm, "points", 0)

		if userID <= 0 || points < 0 {
			l.Warnf("[user] points.set bad param id=%s operator_uid=%d user_id=%d points=%d",
				id, opUID, userID, points,
			)
			return id, &v1.JsonrpcResult{Code: 40061, Message: "参数错误：user_id/points 无效"}, nil
		}

		l.Infof("[user] points.set start id=%s operator_uid=%d target_uid=%d points=%d",
			id, opUID, userID, points,
		)

		after, err := d.userAdminUC.SetPoints(ctx, userID, points)
		if err != nil {
			l.Errorf("[user] points.set failed id=%s operator_uid=%d target_uid=%d points=%d err=%v",
				id, opUID, userID, points, err,
			)
			return id, d.mapUserAdminError(ctx, err), nil
		}

		l.Infof("[user] points.set success id=%s operator_uid=%d target_uid=%d after_points=%d",
			id, opUID, userID, after,
		)

		return id, &v1.JsonrpcResult{
			Code:    0,
			Message: "设置积分成功",
			Data:    newDataStruct(map[string]any{"points": after}),
		}, nil

	// ---------- user.points.add ----------
	case "points.add":
		userID := getInt(pm, "user_id", 0)
		delta := getInt64(pm, "delta", 0)

		if userID <= 0 {
			l.Warnf("[user] points.add bad param id=%s operator_uid=%d user_id=%d delta=%d",
				id, opUID, userID, delta,
			)
			return id, &v1.JsonrpcResult{Code: 40062, Message: "参数错误：user_id 无效"}, nil
		}

		l.Infof("[user] points.add start id=%s operator_uid=%d target_uid=%d delta=%d",
			id, opUID, userID, delta,
		)

		after, err := d.userAdminUC.AddPoints(ctx, userID, delta)
		if err != nil {
			l.Errorf("[user] points.add failed id=%s operator_uid=%d target_uid=%d delta=%d err=%v",
				id, opUID, userID, delta, err,
			)
			return id, d.mapUserAdminError(ctx, err), nil
		}

		l.Infof("[user] points.add success id=%s operator_uid=%d target_uid=%d after_points=%d",
			id, opUID, userID, after,
		)

		return id, &v1.JsonrpcResult{
			Code:    0,
			Message: "增加积分成功",
			Data:    newDataStruct(map[string]any{"points": after}),
		}, nil

	// ---------- user.expires.set ----------
	// expires_at: unix 秒；0 表示清空（永久/未开通）
	case "expires.set":
		userID := getInt(pm, "user_id", 0)
		expTs := getInt64(pm, "expires_at", 0)

		if userID <= 0 || expTs < 0 {
			l.Warnf("[user] expires.set bad param id=%s operator_uid=%d user_id=%d expires_at=%d",
				id, opUID, userID, expTs,
			)
			return id, &v1.JsonrpcResult{Code: 40063, Message: "参数错误：user_id/expires_at 无效"}, nil
		}

		var t *time.Time
		if expTs > 0 {
			tm := time.Unix(expTs, 0)
			t = &tm
		}

		l.Infof("[user] expires.set start id=%s operator_uid=%d target_uid=%d expires_at=%d",
			id, opUID, userID, expTs,
		)

		after, err := d.userAdminUC.SetExpiresAt(ctx, userID, t)
		if err != nil {
			l.Errorf("[user] expires.set failed id=%s operator_uid=%d target_uid=%d expires_at=%d err=%v",
				id, opUID, userID, expTs, err,
			)
			return id, d.mapUserAdminError(ctx, err), nil
		}

		out := int64(0)
		if after != nil {
			out = after.Unix()
		}

		l.Infof("[user] expires.set success id=%s operator_uid=%d target_uid=%d after_expires_at=%d",
			id, opUID, userID, out,
		)

		return id, &v1.JsonrpcResult{
			Code:    0,
			Message: "设置有效期成功",
			Data:    newDataStruct(map[string]any{"expires_at": out}),
		}, nil

	// ---------- user.expires.extend ----------
	// add_days / add_seconds 二选一；常用 add_days(30/90/180/自定义)
	case "expires.extend":
		userID := getInt(pm, "user_id", 0)
		addDays := getInt64(pm, "add_days", 0)
		addSeconds := getInt64(pm, "add_seconds", 0)

		if userID <= 0 {
			l.Warnf("[user] expires.extend bad param id=%s operator_uid=%d user_id=%d add_days=%d add_seconds=%d",
				id, opUID, userID, addDays, addSeconds,
			)
			return id, &v1.JsonrpcResult{Code: 40064, Message: "参数错误：user_id 无效"}, nil
		}

		// 二选一：优先 seconds，否则 days
		if addSeconds <= 0 && addDays > 0 {
			addSeconds = addDays * 86400
		}
		if addSeconds <= 0 {
			l.Warnf("[user] expires.extend bad param (no delta) id=%s operator_uid=%d target_uid=%d add_days=%d add_seconds=%d",
				id, opUID, userID, addDays, addSeconds,
			)
			return id, &v1.JsonrpcResult{Code: 40065, Message: "参数错误：add_days/add_seconds 必须大于 0"}, nil
		}

		l.Infof("[user] expires.extend start id=%s operator_uid=%d target_uid=%d add_days=%d add_seconds=%d",
			id, opUID, userID, addDays, addSeconds,
		)

		after, err := d.userAdminUC.ExtendExpires(ctx, userID, addSeconds)
		if err != nil {
			l.Errorf("[user] expires.extend failed id=%s operator_uid=%d target_uid=%d add_days=%d add_seconds=%d err=%v",
				id, opUID, userID, addDays, addSeconds, err,
			)
			return id, d.mapUserAdminError(ctx, err), nil
		}

		out := int64(0)
		if after != nil {
			out = after.Unix()
		}

		l.Infof("[user] expires.extend success id=%s operator_uid=%d target_uid=%d after_expires_at=%d",
			id, opUID, userID, out,
		)

		return id, &v1.JsonrpcResult{
			Code:    0,
			Message: "延长有效期成功",
			Data:    newDataStruct(map[string]any{"expires_at": out}),
		}, nil

	// ---------- user.set_disabled ----------
	case "set_disabled":
		// 你这段已经非常完整，我保留并稍微补齐一下入口日志的一致性
		userID := getInt(pm, "user_id", 0)
		if userID <= 0 {
			l.Warnf("[user] set_disabled bad param id=%s operator_uid=%d user_id=%d", id, opUID, userID)
			return id, &v1.JsonrpcResult{
				Code:    40071,
				Message: "参数错误：user_id 无效",
			}, nil
		}

		disabled := getBool(pm, "disabled", false)

		l.Infof("[user] set_disabled start id=%s operator_uid=%d target_uid=%d disabled=%v",
			id, opUID, userID, disabled,
		)

		if err := d.userAdminUC.SetDisabled(ctx, userID, disabled); err != nil {
			l.Errorf("[user] set_disabled failed id=%s operator_uid=%d target_uid=%d disabled=%v err=%v",
				id, opUID, userID, disabled, err,
			)
			return id, d.mapUserAdminError(ctx, err), nil
		}

		msg := "启用成功"
		if disabled {
			msg = "禁用成功"
		}

		l.Infof("[user] set_disabled success id=%s operator_uid=%d target_uid=%d disabled=%v",
			id, opUID, userID, disabled,
		)

		return id, &v1.JsonrpcResult{
			Code:    0,
			Message: msg,
			Data: newDataStruct(map[string]any{
				"success":  true,
				"user_id":  userID,
				"disabled": disabled,
			}),
		}, nil

	default:
		l.Warnf("[user] unknown method=%s id=%s operator_uid=%d", method, id, opUID)
		return id, &v1.JsonrpcResult{
			Code:    40020,
			Message: fmt.Sprintf("未知用户接口 method=%s", method),
		}, nil
	}
}

func (d *JsonrpcData) mapUserAdminError(ctx context.Context, err error) *v1.JsonrpcResult {
	l := d.log.WithContext(ctx)

	switch err {
	case biz.ErrUserNotFound:
		return &v1.JsonrpcResult{Code: 10001, Message: "用户不存在"}
	case biz.ErrBadParam:
		return &v1.JsonrpcResult{Code: 40030, Message: "参数不合法"}
	case biz.ErrForbidden:
		return &v1.JsonrpcResult{Code: 40301, Message: "需要管理员权限"}
	default:
		l.Errorf("[user] internal err=%v", err)
		return &v1.JsonrpcResult{Code: 50000, Message: "服务器内部错误"}
	}
}

// =========================
// subscription domain (admin only)
// =========================

func (d *JsonrpcData) handleSubscription(
	ctx context.Context,
	method, id string,
	params *structpb.Struct,
) (string, *v1.JsonrpcResult, error) {

	l := d.log.WithContext(ctx)

	// params
	pm := map[string]any{}
	if params != nil {
		pm = params.AsMap()
	}

	// operator（用于日志）
	var opUID int
	var opUname string
	var opRole biz.Role
	if c, ok := biz.GetClaimsFromContext(ctx); ok && c != nil {
		opUID, opUname, opRole = c.UserID, c.Username, c.Role
	}

	l.Infof("[subscription] handle start method=%s id=%s operator_uid=%d operator_uname=%s operator_role=%d",
		method, id, opUID, opUname, opRole,
	)

	// ✅ admin only
	if _, res := d.requireAdmin(ctx); res != nil {
		l.Warnf("[subscription] requireAdmin denied method=%s id=%s operator_uid=%d code=%d msg=%s",
			method, id, opUID, res.Code, res.Message,
		)
		return id, res, nil
	}

	switch method {

	case "options":
		options := []any{
			map[string]any{"code": "D30", "days": 30, "title": "30 天订阅"},
			map[string]any{"code": "D90", "days": 90, "title": "90 天订阅"},
			map[string]any{"code": "D180", "days": 180, "title": "180 天订阅"},
			map[string]any{"code": "CUSTOM", "days": 0, "title": "自定义天数"},
		}

		l.Infof("[subscription] options success id=%s operator_uid=%d count=%d", id, opUID, len(options))

		return id, &v1.JsonrpcResult{
			Code:    0,
			Message: "获取订阅选项成功",
			Data:    newDataStruct(map[string]any{"options": options}),
		}, nil

	case "apply":
		userID := getInt(pm, "user_id", 0)
		if userID <= 0 {
			l.Warnf("[subscription] apply bad param id=%s operator_uid=%d user_id=%d", id, opUID, userID)
			return id, &v1.JsonrpcResult{Code: 40060, Message: "参数错误：user_id 无效"}, nil
		}

		// days 三种来源：days / add_days / code映射
		days := getInt64(pm, "days", 0)
		if days <= 0 {
			days = getInt64(pm, "add_days", 0)
		}

		code := strings.ToUpper(strings.TrimSpace(getString(pm, "code")))
		if days <= 0 && code != "" {
			switch code {
			case "D30":
				days = 30
			case "D90":
				days = 90
			case "D180":
				days = 180
			case "CUSTOM":
				// CUSTOM 要求 days/add_days
			default:
				l.Warnf("[subscription] apply invalid code id=%s operator_uid=%d target_uid=%d code=%s",
					id, opUID, userID, code,
				)
				return id, &v1.JsonrpcResult{Code: 40061, Message: "参数错误：code 无效"}, nil
			}
		}

		if days <= 0 {
			l.Warnf("[subscription] apply bad days id=%s operator_uid=%d target_uid=%d days=%d code=%s",
				id, opUID, userID, days, code,
			)
			return id, &v1.JsonrpcResult{Code: 40062, Message: "参数错误：days 必须大于 0"}, nil
		}
		if days > 3650 {
			l.Warnf("[subscription] apply days too large id=%s operator_uid=%d target_uid=%d days=%d",
				id, opUID, userID, days,
			)
			return id, &v1.JsonrpcResult{Code: 40063, Message: "参数错误：days 过大"}, nil
		}

		l.Infof("[subscription] apply start id=%s operator_uid=%d target_uid=%d days=%d code=%s",
			id, opUID, userID, days, code,
		)

		addSeconds := int64(days) * 86400
		after, err := d.userAdminUC.ExtendExpires(ctx, userID, addSeconds)
		if err != nil {
			l.Errorf("[subscription] apply failed id=%s operator_uid=%d target_uid=%d days=%d code=%s err=%v",
				id, opUID, userID, days, code, err,
			)
			return id, d.mapUserAdminError(ctx, err), nil
		}

		expUnix := int64(0)
		if after != nil {
			expUnix = after.Unix()
		}

		l.Infof("[subscription] apply success id=%s operator_uid=%d target_uid=%d days=%d expires_at=%d code=%s",
			id, opUID, userID, days, expUnix, code,
		)

		return id, &v1.JsonrpcResult{
			Code:    0,
			Message: "订阅开通/延长成功",
			Data: newDataStruct(map[string]any{
				"success":      true,
				"user_id":      userID,
				"days":         days,
				"expires_at":   expUnix,
				"applied_code": code,
			}),
		}, nil

	default:
		l.Warnf("[subscription] unknown method=%s id=%s operator_uid=%d", method, id, opUID)
		return id, &v1.JsonrpcResult{Code: 40064, Message: "未知订阅接口"}, nil
	}
}
