// server/internal/service/jsonrpc_auth_test.go
package service

import (
	"context"
	"errors"
	"io"
	"sync"
	"testing"
	"time"

	"server/internal/biz"
	"server/internal/errcode"

	"github.com/go-kratos/kratos/v2/log"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/protobuf/types/known/structpb"
)

func TestJsonrpcDispatcher_AuthLogin_OK(t *testing.T) {
	repo := newMemAuthRepoForData()
	_ = repo.putUser("alice", "p@ss", false)

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()

	genTok := func(userID int, username string, role int8) (string, time.Time, error) {
		return "tok", time.Now().Add(time.Hour), nil
	}
	authUC := biz.NewAuthUsecase(repo, genTok, logger, tp)

	j := &jsonrpcDispatcher{
		log:    log.NewHelper(log.With(logger, "module", "service.jsonrpc.test")),
		authUC: authUC,
	}

	params, _ := structpb.NewStruct(map[string]any{
		"username": "alice",
		"password": "p@ss",
	})

	_, res, err := j.handleAuth(context.Background(), "login", "1", params)
	if err != nil {
		t.Fatalf("expected nil err, got %v", err)
	}
	if res == nil || res.Code != 0 {
		t.Fatalf("expected code=0, got %+v", res)
	}
	if res.Data == nil {
		t.Fatalf("expected data not nil")
	}
	m := res.Data.AsMap()
	if m["access_token"] != "tok" {
		t.Fatalf("expected access_token=tok, got %v", m["access_token"])
	}
	if m["user_id"] == nil {
		t.Fatalf("expected user_id not nil")
	}
}

func TestJsonrpcDispatcher_AdminLogin_OKReturnsTokenAndPermissions(t *testing.T) {
	repo := newMemAdminAuthRepoForData()
	_ = repo.putAdmin("admin", "adminadmin", false, []string{"super_admin"}, []string{"admin.access", "admin.user.read"})

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	adminAuthUC := biz.NewAdminAuthUsecase(repo, func(userID int, username string, role int8) (string, time.Time, error) {
		return "admin-tok", time.Now().Add(time.Hour), nil
	}, logger, tp)

	j := &jsonrpcDispatcher{
		log:         log.NewHelper(log.With(logger, "module", "service.jsonrpc.test")),
		adminAuthUC: adminAuthUC,
	}

	params, _ := structpb.NewStruct(map[string]any{
		"username": "admin",
		"password": "adminadmin",
	})

	_, res, err := j.handleAuth(context.Background(), "admin_login", "1", params)
	if err != nil {
		t.Fatalf("expected nil err, got %v", err)
	}
	if res == nil || res.Code != 0 {
		t.Fatalf("expected code=0, got %+v", res)
	}
	if res.Data == nil {
		t.Fatalf("expected data not nil")
	}
	m := res.Data.AsMap()
	if m["access_token"] != "admin-tok" {
		t.Fatalf("expected access_token=admin-tok, got %v", m["access_token"])
	}
	permissions, ok := m["permissions"].([]any)
	if !ok || len(permissions) != 2 {
		t.Fatalf("expected permissions array, got %#v", m["permissions"])
	}
}

func TestJsonrpcDispatcher_AuthRegister_Success(t *testing.T) {
	repo := newMemAuthRepoForData()

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	authUC := biz.NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "tok-reg", time.Now().Add(time.Hour), nil
	}, logger, tp)

	j := &jsonrpcDispatcher{
		log:    log.NewHelper(log.With(logger, "module", "service.jsonrpc.test")),
		authUC: authUC,
	}

	params, _ := structpb.NewStruct(map[string]any{
		"username": "bob",
		"password": "p@ss",
	})

	_, res, err := j.handleAuth(context.Background(), "register", "1", params)
	if err != nil {
		t.Fatalf("expected nil err, got %v", err)
	}
	if res == nil || res.Code != 0 {
		t.Fatalf("expected code=0, got %+v", res)
	}
	m := res.Data.AsMap()
	if m["access_token"] != "tok-reg" {
		t.Fatalf("expected access_token=tok-reg, got %v", m["access_token"])
	}
	if m["username"] != "bob" {
		t.Fatalf("expected username=bob, got %v", m["username"])
	}
}

func TestJsonrpcDispatcher_AuthRegister_MissingArgs(t *testing.T) {
	repo := newMemAuthRepoForData()

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	authUC := biz.NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "tok", time.Now().Add(time.Hour), nil
	}, logger, tp)

	j := &jsonrpcDispatcher{
		log:    log.NewHelper(log.With(logger, "module", "service.jsonrpc.test")),
		authUC: authUC,
	}

	params, _ := structpb.NewStruct(map[string]any{
		"username": "alice",
	})

	_, res, err := j.handleAuth(context.Background(), "register", "1", params)
	if err != nil {
		t.Fatalf("expected nil err (jsonrpc should map to result), got %v", err)
	}
	if res == nil {
		t.Fatalf("expected result not nil")
	}
	if res.Code == 0 {
		t.Fatalf("expected non-zero code for missing args, got %+v", res)
	}
}

func TestJsonrpcDispatcher_AuthLogin_UserNotFound(t *testing.T) {
	repo := newMemAuthRepoForData()

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	authUC := biz.NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "tok", time.Now().Add(time.Hour), nil
	}, logger, tp)

	j := &jsonrpcDispatcher{
		log:    log.NewHelper(log.With(logger, "module", "service.jsonrpc.test")),
		authUC: authUC,
	}

	params, _ := structpb.NewStruct(map[string]any{
		"username": "notfound",
		"password": "p@ss",
	})

	_, res, err := j.handleAuth(context.Background(), "login", "1", params)
	if err != nil {
		t.Fatalf("expected nil err, got %v", err)
	}
	if res == nil || res.Code == 0 {
		t.Fatalf("expected non-zero code for user not found, got %+v", res)
	}
	if res.Code != errcode.AuthUserNotFound.Code {
		t.Fatalf("expected code=%d, got %d", errcode.AuthUserNotFound.Code, res.Code)
	}
}

func TestJsonrpcDispatcher_AuthLogin_InvalidPassword(t *testing.T) {
	repo := newMemAuthRepoForData()
	_ = repo.putUser("alice", "p@ss", false)

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	authUC := biz.NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "tok", time.Now().Add(time.Hour), nil
	}, logger, tp)

	j := &jsonrpcDispatcher{
		log:    log.NewHelper(log.With(logger, "module", "service.jsonrpc.test")),
		authUC: authUC,
	}

	params, _ := structpb.NewStruct(map[string]any{
		"username": "alice",
		"password": "wrong",
	})

	_, res, err := j.handleAuth(context.Background(), "login", "1", params)
	if err != nil {
		t.Fatalf("expected nil err, got %v", err)
	}
	if res == nil || res.Code == 0 {
		t.Fatalf("expected non-zero code for invalid password, got %+v", res)
	}
	if res.Code != errcode.AuthInvalidPassword.Code {
		t.Fatalf("expected code=%d, got %d", errcode.AuthInvalidPassword.Code, res.Code)
	}
}

func TestJsonrpcDispatcher_AuthLogout(t *testing.T) {
	repo := newMemAuthRepoForData()

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	authUC := biz.NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "tok", time.Now().Add(time.Hour), nil
	}, logger, tp)

	j := &jsonrpcDispatcher{
		log:    log.NewHelper(log.With(logger, "module", "service.jsonrpc.test")),
		authUC: authUC,
	}

	params, _ := structpb.NewStruct(map[string]any{})

	_, res, err := j.handleAuth(context.Background(), "logout", "1", params)
	if err != nil {
		t.Fatalf("expected nil err, got %v", err)
	}
	if res == nil || res.Code != 0 {
		t.Fatalf("expected code=0, got %+v", res)
	}
}

func TestJsonrpcDispatcher_AuthUnknownMethod(t *testing.T) {
	repo := newMemAuthRepoForData()

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	authUC := biz.NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "tok", time.Now().Add(time.Hour), nil
	}, logger, tp)

	j := &jsonrpcDispatcher{
		log:    log.NewHelper(log.With(logger, "module", "service.jsonrpc.test")),
		authUC: authUC,
	}

	params, _ := structpb.NewStruct(map[string]any{})

	_, res, err := j.handleAuth(context.Background(), "unknown", "1", params)
	if err != nil {
		t.Fatalf("expected nil err, got %v", err)
	}
	if res == nil || res.Code == 0 {
		t.Fatalf("expected non-zero code for unknown method, got %+v", res)
	}
	if res.Code != errcode.UnknownMethod.Code {
		t.Fatalf("expected code=%d, got %d", errcode.UnknownMethod.Code, res.Code)
	}
}

// ====== 内部：最小 mem repo（service 包里实现 biz.AuthRepo）======

type memAuthRepoForData struct {
	mu         sync.Mutex
	users      map[string]*biz.User
	nextUserID int
}

func newMemAuthRepoForData() *memAuthRepoForData {
	return &memAuthRepoForData{
		users:      make(map[string]*biz.User),
		nextUserID: 1,
	}
}

func (r *memAuthRepoForData) putUser(username, password string, disabled bool) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.users[username] = &biz.User{
		ID:           r.nextUserID,
		Username:     username,
		PasswordHash: string(hash),
		Disabled:     disabled,
		Role:         0,
	}
	r.nextUserID++
	return nil
}

// ====== biz.AuthRepo 实现 ======
func (r *memAuthRepoForData) GetUserByUsername(ctx context.Context, username string) (*biz.User, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	u := r.users[username]
	if u == nil {
		return nil, errors.New("not found")
	}
	cp := *u
	return &cp, nil
}

func (r *memAuthRepoForData) GetUserByID(ctx context.Context, id int) (*biz.User, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	for _, u := range r.users {
		if u.ID == id {
			cp := *u
			return &cp, nil
		}
	}
	return nil, errors.New("not found")
}

func (r *memAuthRepoForData) CreateUser(ctx context.Context, u *biz.User) (*biz.User, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, ok := r.users[u.Username]; ok {
		return nil, errors.New("duplicate username")
	}
	cp := *u
	cp.ID = r.nextUserID
	r.nextUserID++
	r.users[cp.Username] = &cp
	return &cp, nil
}

func (r *memAuthRepoForData) UpdateUserLastLogin(ctx context.Context, id int, t time.Time) error {
	// 测试中不需要实现
	return nil
}

type memAdminAuthRepoForData struct {
	mu     sync.Mutex
	admins map[string]*biz.AdminUser
	nextID int
}

func newMemAdminAuthRepoForData() *memAdminAuthRepoForData {
	return &memAdminAuthRepoForData{
		admins: make(map[string]*biz.AdminUser),
		nextID: 1,
	}
}

func (r *memAdminAuthRepoForData) putAdmin(username, password string, disabled bool, roles, permissions []string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.admins[username] = &biz.AdminUser{
		ID:           r.nextID,
		Username:     username,
		PasswordHash: string(hash),
		Disabled:     disabled,
		Roles:        append([]string(nil), roles...),
		Permissions:  append([]string(nil), permissions...),
	}
	r.nextID++
	return nil
}

func (r *memAdminAuthRepoForData) GetAdminByUsername(ctx context.Context, username string) (*biz.AdminUser, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	u := r.admins[username]
	if u == nil {
		return nil, errors.New("not found")
	}
	cp := *u
	cp.Roles = append([]string(nil), u.Roles...)
	cp.Permissions = append([]string(nil), u.Permissions...)
	return &cp, nil
}

func (r *memAdminAuthRepoForData) GetAdminByID(ctx context.Context, id int) (*biz.AdminUser, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, u := range r.admins {
		if u.ID == id {
			cp := *u
			cp.Roles = append([]string(nil), u.Roles...)
			cp.Permissions = append([]string(nil), u.Permissions...)
			return &cp, nil
		}
	}
	return nil, errors.New("not found")
}

func (r *memAdminAuthRepoForData) UpdateAdminLastLogin(ctx context.Context, id int, t time.Time) error {
	// 测试中不需要实现
	return nil
}
