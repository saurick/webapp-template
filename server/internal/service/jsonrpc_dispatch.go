// server/internal/service/jsonrpc_dispatch.go
package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	v1 "server/api/jsonrpc/v1"
	"server/internal/biz"
	"server/internal/errcode"

	"github.com/go-kratos/kratos/v2/log"
	"google.golang.org/protobuf/types/known/structpb"
)

// jsonrpcDispatcher 只做协议分发、权限检查和结果映射，业务规则继续下沉到 biz usecase。
type jsonrpcDispatcher struct {
	log *log.Helper

	authUC      *biz.AuthUsecase
	adminAuthUC *biz.AdminAuthUsecase
	userAdminUC *biz.UserAdminUsecase
	rbacUC      *biz.RBACUsecase

	adminReader biz.AdminAccountReader
}

func newJSONRPCDispatcher(
	logger log.Logger,
	authUC *biz.AuthUsecase,
	adminAuthUC *biz.AdminAuthUsecase,
	userAdminUC *biz.UserAdminUsecase,
	rbacUC *biz.RBACUsecase,
	adminReader biz.AdminAccountReader,
) *jsonrpcDispatcher {
	helper := log.NewHelper(log.With(logger, "module", "service.jsonrpc.dispatcher"))

	if authUC == nil {
		panic("newJSONRPCDispatcher: authUC is nil")
	}
	if adminAuthUC == nil {
		panic("newJSONRPCDispatcher: adminAuthUC is nil")
	}
	if userAdminUC == nil {
		panic("newJSONRPCDispatcher: userAdminUC is nil")
	}
	if rbacUC == nil {
		panic("newJSONRPCDispatcher: rbacUC is nil")
	}
	if adminReader == nil {
		panic("newJSONRPCDispatcher: adminReader is nil")
	}

	helper.Info("jsonrpcDispatcher created")

	return &jsonrpcDispatcher{
		log:         helper,
		authUC:      authUC,
		adminAuthUC: adminAuthUC,
		userAdminUC: userAdminUC,
		rbacUC:      rbacUC,
		adminReader: adminReader,
	}
}

func (d *jsonrpcDispatcher) Handle(
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
		b, _ := json.MarshalIndent(params.AsMap(), "", "  ")
		d.log.WithContext(ctx).Infof("[jsonrpc] params=%s", string(b))
	}

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
	case "rbac":
		return d.handleRBAC(ctx, method, id, params)
	default:
		return id, &v1.JsonrpcResult{
			Code:    errcode.JSONRPCUnknownURL.Code,
			Message: fmt.Sprintf("unknown jsonrpc url=%s", url),
		}, nil
	}
}

func (r *jsonrpcDispatcher) handleSystem(
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
		return id, &v1.JsonrpcResult{Code: errcode.OK.Code, Message: errcode.OK.Message, Data: data}, nil
	case "version":
		data := newDataStruct(map[string]any{"version": "1.0.0"})
		logger.Info("Jsonrpc.system.version: success", "id", id)
		return id, &v1.JsonrpcResult{Code: errcode.OK.Code, Message: errcode.OK.Message, Data: data}, nil
	default:
		logger.Warn("Jsonrpc.system: unknown method", "method", method, "id", id)
		return id, &v1.JsonrpcResult{
			Code:    errcode.UnknownMethod.Code,
			Message: fmt.Sprintf("unknown system method: %s", method),
		}, nil
	}
}

func (d *jsonrpcDispatcher) handleAuth(
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
	case "login":
		username := getString(pm, "username")
		password := getString(pm, "password")

		if username == "" || password == "" {
			return id, &v1.JsonrpcResult{Code: errcode.InvalidParam.Code, Message: "缺少用户名或密码"}, nil
		}

		token, expireAt, user, err := d.authUC.Login(ctx, username, password)
		if err != nil {
			return id, d.mapAuthError(ctx, err), nil
		}

		return id, &v1.JsonrpcResult{
			Code:    errcode.OK.Code,
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

	case "admin_login":
		username := getString(pm, "username")
		password := getString(pm, "password")

		if username == "" || password == "" {
			return id, &v1.JsonrpcResult{Code: errcode.InvalidParam.Code, Message: "缺少用户名或密码"}, nil
		}

		token, expireAt, admin, err := d.adminAuthUC.Login(ctx, username, password)
		if err != nil {
			return id, d.mapAuthError(ctx, err), nil
		}

		return id, &v1.JsonrpcResult{
			Code:    errcode.OK.Code,
			Message: "登录成功",
			Data: newDataStruct(map[string]any{
				"user_id":      admin.ID,
				"username":     admin.Username,
				"roles":        admin.Roles,
				"permissions":  admin.Permissions,
				"access_token": token,
				"expires_at":   expireAt.Unix(),
				"token_type":   "Bearer",
				"issued_at":    time.Now().Unix(),
			}),
		}, nil

	case "register":
		username := getString(pm, "username")
		password := getString(pm, "password")

		if username == "" || password == "" {
			return id, &v1.JsonrpcResult{Code: errcode.InvalidParam.Code, Message: "缺少用户名或密码"}, nil
		}

		token, expireAt, user, err := d.authUC.Register(ctx, username, password)
		if err != nil {
			return id, d.mapAuthError(ctx, err), nil
		}

		return id, &v1.JsonrpcResult{
			Code:    errcode.OK.Code,
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
			d.log.WithContext(ctx).Warnf("[auth] user logout without claims id=%s", id)
		}

		return id, &v1.JsonrpcResult{
			Code:    errcode.OK.Code,
			Message: errcode.OK.Message,
		}, nil

	case "me":
		claims, ok := biz.GetClaimsFromContext(ctx)
		if !ok || claims == nil {
			return id, &v1.JsonrpcResult{Code: errcode.AuthRequired.Code, Message: errcode.AuthRequired.Message}, nil
		}

		if claims.Role == biz.RoleAdmin {
			admin, err := d.getCurrentAdmin(ctx, claims)
			if err != nil {
				d.log.WithContext(ctx).Warnf("auth.me GetCurrentAdmin failed uid=%d err=%v", claims.UserID, err)
				return id, &v1.JsonrpcResult{Code: errcode.AuthCurrentUserFailed.Code, Message: errcode.AuthCurrentUserFailed.Message}, nil
			}

			return id, &v1.JsonrpcResult{
				Code:    errcode.OK.Code,
				Message: errcode.OK.Message,
				Data: newDataStruct(map[string]any{
					"id":          admin.ID,
					"username":    admin.Username,
					"role":        int(biz.RoleAdmin),
					"disabled":    admin.Disabled,
					"roles":       admin.Roles,
					"permissions": admin.Permissions,
				}),
			}, nil
		}

		u, err := d.authUC.GetCurrentUser(ctx, claims.UserID)
		if err != nil {
			d.log.WithContext(ctx).Warnf("auth.me GetCurrentUser failed uid=%d err=%v", claims.UserID, err)
			return id, &v1.JsonrpcResult{Code: errcode.AuthCurrentUserFailed.Code, Message: errcode.AuthCurrentUserFailed.Message}, nil
		}

		data := map[string]any{
			"id":         u.ID,
			"username":   u.Username,
			"role":       u.Role,
			"disabled":   u.Disabled,
			"created_at": u.CreatedAt.Unix(),
		}
		if u.LastLoginAt != nil {
			data["last_login_at"] = u.LastLoginAt.Unix()
		}

		return id, &v1.JsonrpcResult{
			Code:    errcode.OK.Code,
			Message: errcode.OK.Message,
			Data:    newDataStruct(data),
		}, nil

	default:
		return id, &v1.JsonrpcResult{
			Code:    errcode.UnknownMethod.Code,
			Message: fmt.Sprintf("auth: 未知方法=%s", method),
		}, nil
	}
}

func (d *jsonrpcDispatcher) mapAuthError(ctx context.Context, err error) *v1.JsonrpcResult {
	logger := d.log.WithContext(ctx)

	switch err {
	case biz.ErrUserNotFound:
		logger.Warn("[auth] user not found")
		return &v1.JsonrpcResult{
			Code:    errcode.AuthUserNotFound.Code,
			Message: errcode.AuthUserNotFound.Message,
		}
	case biz.ErrInvalidPassword:
		logger.Warn("[auth] invalid password")
		return &v1.JsonrpcResult{
			Code:    errcode.AuthInvalidPassword.Code,
			Message: errcode.AuthInvalidPassword.Message,
		}
	case biz.ErrUserDisabled:
		logger.Warn("[auth] user disabled")
		return &v1.JsonrpcResult{
			Code:    errcode.AuthUserDisabled.Code,
			Message: errcode.AuthUserDisabled.Message,
		}
	case biz.ErrUserExists:
		logger.Warn("[auth] user already exists")
		return &v1.JsonrpcResult{
			Code:    errcode.AuthUserExists.Code,
			Message: errcode.AuthUserExists.Message,
		}
	default:
		logger.Errorf("[auth] internal error: %v", err)
		return &v1.JsonrpcResult{
			Code:    errcode.Internal.Code,
			Message: errcode.Internal.Message,
		}
	}
}

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
	normalized := make(map[string]any, len(m))
	for k, v := range m {
		normalized[k] = normalizeStructValue(v)
	}
	s, err := structpb.NewStruct(normalized)
	if err != nil {
		return nil
	}
	return s
}

func normalizeStructValue(v any) any {
	switch x := v.(type) {
	case []string:
		// structpb 不接受 []string，统一转成 []any，避免局部接口返回 data=null。
		out := make([]any, 0, len(x))
		for _, item := range x {
			out = append(out, item)
		}
		return out
	case []int:
		out := make([]any, 0, len(x))
		for _, item := range x {
			out = append(out, item)
		}
		return out
	case []int64:
		out := make([]any, 0, len(x))
		for _, item := range x {
			out = append(out, item)
		}
		return out
	case []bool:
		out := make([]any, 0, len(x))
		for _, item := range x {
			out = append(out, item)
		}
		return out
	case map[string]any:
		out := make(map[string]any, len(x))
		for k, item := range x {
			out[k] = normalizeStructValue(item)
		}
		return out
	default:
		return v
	}
}

func (d *jsonrpcDispatcher) requireLogin(ctx context.Context) (*biz.AuthClaims, *v1.JsonrpcResult) {
	if c, ok := biz.GetClaimsFromContext(ctx); ok && c != nil {
		return c, nil
	}

	switch biz.AuthStateFrom(ctx) {
	case biz.AuthExpired:
		return nil, &v1.JsonrpcResult{Code: errcode.AuthExpired.Code, Message: errcode.AuthExpired.Message}
	case biz.AuthInvalid:
		return nil, &v1.JsonrpcResult{Code: errcode.AuthInvalid.Code, Message: errcode.AuthInvalid.Message}
	default:
		return nil, &v1.JsonrpcResult{Code: errcode.AuthRequired.Code, Message: errcode.AuthRequired.Message}
	}
}

func (d *jsonrpcDispatcher) requireAdmin(ctx context.Context) (*biz.AuthClaims, *v1.JsonrpcResult) {
	c, res := d.requireLogin(ctx)
	if res != nil {
		return nil, res
	}
	if c.Role != biz.RoleAdmin {
		return nil, &v1.JsonrpcResult{Code: errcode.AdminRequired.Code, Message: errcode.AdminRequired.Message}
	}

	admin, err := d.getCurrentAdmin(ctx, c)
	if err != nil {
		switch {
		case errors.Is(err, sql.ErrNoRows):
			return nil, &v1.JsonrpcResult{Code: errcode.AdminRequired.Code, Message: errcode.AdminRequired.Message}
		case errors.Is(err, errAdminUsernameMismatch):
			return nil, &v1.JsonrpcResult{Code: errcode.AdminRequired.Code, Message: errcode.AdminRequired.Message}
		default:
			d.log.WithContext(ctx).Errorf("[auth] requireAdmin verify current admin failed err=%v", err)
			return nil, &v1.JsonrpcResult{Code: errcode.Internal.Code, Message: errcode.Internal.Message}
		}
	}
	if admin.Disabled {
		return nil, &v1.JsonrpcResult{Code: errcode.AdminDisabled.Code, Message: errcode.AdminDisabled.Message}
	}

	return c, nil
}

func (d *jsonrpcDispatcher) requireAdminPermission(ctx context.Context, permission string) (*biz.AuthClaims, *v1.JsonrpcResult) {
	c, res := d.requireAdmin(ctx)
	if res != nil {
		return nil, res
	}
	if permission == "" {
		return c, nil
	}

	admin, err := d.getCurrentAdmin(ctx, c)
	if err != nil {
		d.log.WithContext(ctx).Errorf("[auth] requireAdminPermission load admin failed permission=%s err=%v", permission, err)
		return nil, &v1.JsonrpcResult{Code: errcode.Internal.Code, Message: errcode.Internal.Message}
	}
	for _, p := range admin.Permissions {
		if p == permission {
			return c, nil
		}
	}

	d.log.WithContext(ctx).Warnf("[auth] permission denied admin_id=%d permission=%s", c.UserID, permission)
	return nil, &v1.JsonrpcResult{Code: errcode.PermissionDenied.Code, Message: errcode.PermissionDenied.Message}
}

var errAdminUsernameMismatch = errors.New("admin username mismatch")

func (d *jsonrpcDispatcher) getCurrentAdmin(ctx context.Context, claims *biz.AuthClaims) (*biz.AdminUser, error) {
	if claims == nil {
		return nil, errors.New("missing auth claims")
	}
	if d.adminReader == nil {
		return nil, errors.New("admin reader is nil")
	}

	admin, err := d.adminReader.GetAdminByID(ctx, claims.UserID)
	if err != nil {
		return nil, err
	}
	if admin == nil {
		return nil, sql.ErrNoRows
	}
	// 安全兜底：管理员 token 的 uid/uname 必须同时匹配，避免旧 token 在账号重建后误复用。
	if admin.Username != claims.Username {
		return nil, errAdminUsernameMismatch
	}
	return admin, nil
}

func (d *jsonrpcDispatcher) isPublic(url, method string) bool {
	if url == "system" && (method == "ping" || method == "version") {
		return true
	}
	if url == "auth" && (method == "login" || method == "admin_login" || method == "register" || method == "logout") {
		return true
	}
	return false
}

func (d *jsonrpcDispatcher) handleUser(
	ctx context.Context,
	method, id string,
	params *structpb.Struct,
) (string, *v1.JsonrpcResult, error) {
	l := d.log.WithContext(ctx)

	pm := map[string]any{}
	if params != nil {
		pm = params.AsMap()
	}

	var opUID int
	var opUname string
	var opRole biz.Role
	if c, ok := biz.GetClaimsFromContext(ctx); ok && c != nil {
		opUID, opUname, opRole = c.UserID, c.Username, c.Role
	}

	l.Infof("[user] handle start method=%s id=%s operator_uid=%d operator_uname=%s operator_role=%d",
		method, id, opUID, opUname, opRole,
	)

	requiredPermission := map[string]string{
		"list":         biz.PermissionUserRead,
		"set_disabled": biz.PermissionUserWrite,
	}[method]
	if _, res := d.requireAdminPermission(ctx, requiredPermission); res != nil {
		l.Warnf("[user] requireAdmin denied method=%s id=%s operator_uid=%d code=%d msg=%s",
			method, id, opUID, res.Code, res.Message,
		)
		return id, res, nil
	}

	switch method {
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
			return id, &v1.JsonrpcResult{Code: errcode.UserListFailed.Code, Message: errcode.UserListFailed.Message}, nil
		}

		arr := make([]any, 0, len(list))
		for _, u := range list {
			lastLogin := int64(0)
			if u.LastLoginAt != nil {
				lastLogin = u.LastLoginAt.Unix()
			}
			arr = append(arr, map[string]any{
				"id":            u.ID,
				"username":      u.Username,
				"disabled":      u.Disabled,
				"last_login_at": lastLogin,
				"created_at":    u.CreatedAt.Unix(),
			})
		}

		l.Infof("[user] list success id=%s operator_uid=%d count=%d total=%d search=%q",
			id, opUID, len(list), total, search,
		)

		return id, &v1.JsonrpcResult{
			Code:    errcode.OK.Code,
			Message: "获取账号列表成功",
			Data: newDataStruct(map[string]any{
				"users":  arr,
				"total":  total,
				"limit":  limit,
				"offset": offset,
				"search": search,
			}),
		}, nil

	case "set_disabled":
		userID := getInt(pm, "user_id", 0)
		if userID <= 0 {
			l.Warnf("[user] set_disabled bad param id=%s operator_uid=%d user_id=%d", id, opUID, userID)
			return id, &v1.JsonrpcResult{
				Code:    errcode.UserSetDisabledInvalid.Code,
				Message: errcode.UserSetDisabledInvalid.Message,
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
			Code:    errcode.OK.Code,
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
			Code:    errcode.UnknownMethod.Code,
			Message: fmt.Sprintf("未知用户接口 method=%s", method),
		}, nil
	}
}

func (d *jsonrpcDispatcher) handleRBAC(
	ctx context.Context,
	method, id string,
	_ *structpb.Struct,
) (string, *v1.JsonrpcResult, error) {
	l := d.log.WithContext(ctx)

	if _, res := d.requireAdminPermission(ctx, biz.PermissionRBACRead); res != nil {
		l.Warnf("[rbac] require permission denied method=%s id=%s code=%d msg=%s", method, id, res.Code, res.Message)
		return id, res, nil
	}

	switch method {
	case "overview":
		overview, err := d.rbacUC.Overview(ctx)
		if err != nil {
			l.Errorf("[rbac] overview failed id=%s err=%v", id, err)
			return id, &v1.JsonrpcResult{Code: errcode.Internal.Code, Message: errcode.Internal.Message}, nil
		}
		return id, &v1.JsonrpcResult{
			Code:    errcode.OK.Code,
			Message: errcode.OK.Message,
			Data: newDataStruct(map[string]any{
				"roles":       rbacRoleResults(overview.Roles),
				"permissions": rbacPermissionResults(overview.Permissions),
			}),
		}, nil
	default:
		l.Warnf("[rbac] unknown method=%s id=%s", method, id)
		return id, &v1.JsonrpcResult{
			Code:    errcode.UnknownMethod.Code,
			Message: fmt.Sprintf("未知权限接口 method=%s", method),
		}, nil
	}
}

func rbacRoleResults(roles []biz.RBACRoleSummary) []any {
	out := make([]any, 0, len(roles))
	for _, role := range roles {
		out = append(out, map[string]any{
			"id":          role.ID,
			"key":         role.Key,
			"name":        role.Name,
			"description": role.Description,
			"builtin":     role.Builtin,
			"admin_count": role.AdminCount,
		})
	}
	return out
}

func rbacPermissionResults(permissions []biz.RBACPermissionSummary) []any {
	out := make([]any, 0, len(permissions))
	for _, permission := range permissions {
		out = append(out, map[string]any{
			"key":         permission.Key,
			"name":        permission.Name,
			"group":       permission.Group,
			"description": permission.Description,
			"builtin":     permission.Builtin,
		})
	}
	return out
}

func (d *jsonrpcDispatcher) mapUserAdminError(ctx context.Context, err error) *v1.JsonrpcResult {
	l := d.log.WithContext(ctx)

	switch err {
	case biz.ErrUserNotFound:
		return &v1.JsonrpcResult{Code: errcode.AuthUserNotFound.Code, Message: errcode.AuthUserNotFound.Message}
	case biz.ErrBadParam:
		return &v1.JsonrpcResult{Code: errcode.UserInvalidParam.Code, Message: errcode.UserInvalidParam.Message}
	case biz.ErrForbidden:
		return &v1.JsonrpcResult{Code: errcode.AdminRequired.Code, Message: errcode.AdminRequired.Message}
	case biz.ErrNoPermission:
		return &v1.JsonrpcResult{Code: errcode.PermissionDenied.Code, Message: errcode.PermissionDenied.Message}
	default:
		l.Errorf("[user] internal err=%v", err)
		return &v1.JsonrpcResult{Code: errcode.Internal.Code, Message: errcode.Internal.Message}
	}
}
