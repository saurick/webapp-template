// server/internal/data/jsonrpc_auth_test.go
package data

import (
	"context"
	"errors"
	"io"
	"reflect"
	"sync"
	"testing"
	"time"
	"unsafe"

	"server/internal/biz"

	"github.com/go-kratos/kratos/v2/log"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
	"golang.org/x/crypto/bcrypt"
	"google.golang.org/protobuf/types/known/structpb"
)

func TestJsonrpcData_AuthLogin_OK(t *testing.T) {
	repo := newMemAuthRepoForData()
	_ = repo.putUser("alice", "p@ss", false)

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()

	genTok := func(userID int, username string, role int8) (string, time.Time, error) {
		return "tok", time.Now().Add(time.Hour), nil
	}

	authUC := biz.NewAuthUsecase(repo, genTok, logger, tp)

	j := &JsonrpcData{
		log:    log.NewHelper(log.With(logger, "module", "data.jsonrpc.test")),
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

func TestJsonrpcData_AuthRegister_Success(t *testing.T) {
	repo := newMemAuthRepoForData()
	repo.putInviteCode("INV123", 10, 0, false, nil)

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	authUC := biz.NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "tok-reg", time.Now().Add(time.Hour), nil
	}, logger, tp)

	j := &JsonrpcData{
		log:    log.NewHelper(log.With(logger, "module", "data.jsonrpc.test")),
		authUC: authUC,
	}

	params, _ := structpb.NewStruct(map[string]any{
		"username":    "bob",
		"password":    "p@ss",
		"invite_code": "INV123",
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

func TestJsonrpcData_AuthRegister_MissingInvite(t *testing.T) {
	repo := newMemAuthRepoForData()

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	authUC := biz.NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "tok", time.Now().Add(time.Hour), nil
	}, logger, tp)

	j := &JsonrpcData{
		log:    log.NewHelper(log.With(logger, "module", "data.jsonrpc.test")),
		authUC: authUC,
	}

	params, _ := structpb.NewStruct(map[string]any{
		"username": "alice",
		"password": "p@ss",
		// invite_code missing
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

func TestJsonrpcData_AuthRegister_InviteNotFound(t *testing.T) {
	repo := newMemAuthRepoForData()

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	authUC := biz.NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "tok", time.Now().Add(time.Hour), nil
	}, logger, tp)

	j := &JsonrpcData{
		log:    log.NewHelper(log.With(logger, "module", "data.jsonrpc.test")),
		authUC: authUC,
	}

	params, _ := structpb.NewStruct(map[string]any{
		"username":    "alice",
		"password":    "p@ss",
		"invite_code": "NOTEXIST",
	})

	_, res, err := j.handleAuth(context.Background(), "register", "1", params)
	if err != nil {
		t.Fatalf("expected nil err, got %v", err)
	}
	if res == nil || res.Code == 0 {
		t.Fatalf("expected non-zero code for invalid invite, got %+v", res)
	}
	if res.Code != 20001 { // ErrInviteCodeNotFound
		t.Fatalf("expected code=20001, got %d", res.Code)
	}
}

func TestJsonrpcData_AuthLogin_UserNotFound(t *testing.T) {
	repo := newMemAuthRepoForData()

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	authUC := biz.NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "tok", time.Now().Add(time.Hour), nil
	}, logger, tp)

	j := &JsonrpcData{
		log:    log.NewHelper(log.With(logger, "module", "data.jsonrpc.test")),
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
	if res.Code != 10001 { // ErrUserNotFound
		t.Fatalf("expected code=10001, got %d", res.Code)
	}
}

func TestJsonrpcData_AuthLogin_InvalidPassword(t *testing.T) {
	repo := newMemAuthRepoForData()
	_ = repo.putUser("alice", "p@ss", false)

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	authUC := biz.NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "tok", time.Now().Add(time.Hour), nil
	}, logger, tp)

	j := &JsonrpcData{
		log:    log.NewHelper(log.With(logger, "module", "data.jsonrpc.test")),
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
	if res.Code != 10002 { // ErrInvalidPassword
		t.Fatalf("expected code=10002, got %d", res.Code)
	}
}

func TestJsonrpcData_AuthLogout(t *testing.T) {
	repo := newMemAuthRepoForData()

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	authUC := biz.NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "tok", time.Now().Add(time.Hour), nil
	}, logger, tp)

	j := &JsonrpcData{
		log:    log.NewHelper(log.With(logger, "module", "data.jsonrpc.test")),
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
	m := res.Data.AsMap()
	if m["success"] != true {
		t.Fatalf("expected success=true, got %v", m["success"])
	}
}

func TestJsonrpcData_AuthInviteList_Unauthorized(t *testing.T) {
	repo := newMemAuthRepoForData()

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	authUC := biz.NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "tok", time.Now().Add(time.Hour), nil
	}, logger, tp)

	j := &JsonrpcData{
		log:    log.NewHelper(log.With(logger, "module", "data.jsonrpc.test")),
		authUC: authUC,
	}

	params, _ := structpb.NewStruct(map[string]any{})

	// 没有 admin claims
	ctx := context.Background()
	_, res, err := j.handleAuth(ctx, "invite.list", "1", params)
	if err != nil {
		t.Fatalf("expected nil err, got %v", err)
	}
	if res == nil || res.Code == 0 {
		t.Fatalf("expected non-zero code for unauthorized, got %+v", res)
	}
	if res.Code != 40101 && res.Code != 40301 {
		t.Fatalf("expected code=40101 or 40301, got %d", res.Code)
	}
}

// setAuthRepo 使用反射和 unsafe 设置 JsonrpcData 的私有字段 authRepo
// 注意：这是测试专用函数，使用 unsafe 包来绕过 Go 的类型安全
func setAuthRepo(j *JsonrpcData, repo biz.AuthRepo) {
	rv := reflect.ValueOf(j).Elem()
	rf := rv.FieldByName("authRepo")
	if !rf.IsValid() {
		return
	}

	// 创建一个包装器，实现 biz.AuthRepo 接口
	wrapper := &authRepoWrapper{repo: repo}

	// 使用 unsafe 来设置私有字段
	// 由于 authRepo 字段的类型是 *authRepo（私有类型），我们无法直接创建
	// 我们使用 unsafe 来直接设置指针值
	fieldPtr := unsafe.Pointer(rf.UnsafeAddr())
	*(*unsafe.Pointer)(fieldPtr) = unsafe.Pointer(wrapper)
}

// authRepoWrapper 将 biz.AuthRepo 接口包装为 *authRepo 兼容的对象
// 注意：这只是一个测试辅助，实际运行时不会使用
type authRepoWrapper struct {
	repo biz.AuthRepo
}

// 实现 biz.AuthRepo 接口的所有方法
func (w *authRepoWrapper) GetUserByUsername(ctx context.Context, username string) (*biz.User, error) {
	return w.repo.GetUserByUsername(ctx, username)
}
func (w *authRepoWrapper) CreateUser(ctx context.Context, u *biz.User) (*biz.User, error) {
	return w.repo.CreateUser(ctx, u)
}
func (w *authRepoWrapper) UpdateUserLastLogin(ctx context.Context, id int, t time.Time) error {
	return w.repo.UpdateUserLastLogin(ctx, id, t)
}
func (w *authRepoWrapper) GetInviteCode(ctx context.Context, code string) (*biz.InviteCode, error) {
	return w.repo.GetInviteCode(ctx, code)
}
func (w *authRepoWrapper) IncreaseInviteCodeUsage(ctx context.Context, id int) error {
	return w.repo.IncreaseInviteCodeUsage(ctx, id)
}
func (w *authRepoWrapper) ListInviteCodes(ctx context.Context, limit, offset int) ([]*biz.InviteCode, error) {
	return w.repo.ListInviteCodes(ctx, limit, offset)
}
func (w *authRepoWrapper) CreateInviteCode(ctx context.Context, ic *biz.InviteCode) (*biz.InviteCode, error) {
	return w.repo.CreateInviteCode(ctx, ic)
}
func (w *authRepoWrapper) SetInviteCodeDisabled(ctx context.Context, id int, disabled bool) error {
	return w.repo.SetInviteCodeDisabled(ctx, id, disabled)
}
func (w *authRepoWrapper) IncreaseInviteCodeUsageBy(ctx context.Context, id int, delta int) error {
	return w.repo.IncreaseInviteCodeUsageBy(ctx, id, delta)
}

func TestJsonrpcData_AuthInviteList_Admin(t *testing.T) {
	repo := newMemAuthRepoForData()
	repo.putInviteCode("INV1", 10, 0, false, nil)
	repo.putInviteCode("INV2", 5, 2, false, nil)

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	authUC := biz.NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "tok", time.Now().Add(time.Hour), nil
	}, logger, tp)

	j := &JsonrpcData{
		log:    log.NewHelper(log.With(logger, "module", "data.jsonrpc.test")),
		authUC: authUC,
	}
	setAuthRepo(j, repo)

	params, _ := structpb.NewStruct(map[string]any{})

	// 设置 admin claims
	ctx := biz.NewContextWithClaims(context.Background(), &biz.AuthClaims{
		UserID:   1,
		Username: "admin",
		Role:     biz.RoleAdmin,
	})

	_, res, err := j.handleAuth(ctx, "invite.list", "1", params)
	if err != nil {
		t.Fatalf("expected nil err, got %v", err)
	}
	if res == nil || res.Code != 0 {
		t.Fatalf("expected code=0, got %+v", res)
	}
	m := res.Data.AsMap()
	if m["invite_codes"] == nil {
		t.Fatalf("expected invite_codes not nil")
	}
}

func TestJsonrpcData_AuthInviteCreate_Admin(t *testing.T) {
	repo := newMemAuthRepoForData()

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	authUC := biz.NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "tok", time.Now().Add(time.Hour), nil
	}, logger, tp)

	j := &JsonrpcData{
		log:    log.NewHelper(log.With(logger, "module", "data.jsonrpc.test")),
		authUC: authUC,
	}
	setAuthRepo(j, repo)

	params, _ := structpb.NewStruct(map[string]any{
		"code":     "TEST123",
		"max_uses": 20,
	})

	ctx := biz.NewContextWithClaims(context.Background(), &biz.AuthClaims{
		UserID:   1,
		Username: "admin",
		Role:     biz.RoleAdmin,
	})

	_, res, err := j.handleAuth(ctx, "invite.create", "1", params)
	if err != nil {
		t.Fatalf("expected nil err, got %v", err)
	}
	if res == nil || res.Code != 0 {
		t.Fatalf("expected code=0, got %+v", res)
	}
	m := res.Data.AsMap()
	ic := m["invite_code"].(map[string]any)
	if ic["code"] != "TEST123" {
		t.Fatalf("expected code=TEST123, got %v", ic["code"])
	}
}

func TestJsonrpcData_AuthInviteSetDisabled_Admin(t *testing.T) {
	repo := newMemAuthRepoForData()
	repo.putInviteCode("INV1", 10, 0, false, nil)

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	authUC := biz.NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "tok", time.Now().Add(time.Hour), nil
	}, logger, tp)

	j := &JsonrpcData{
		log:    log.NewHelper(log.With(logger, "module", "data.jsonrpc.test")),
		authUC: authUC,
	}
	setAuthRepo(j, repo)

	params, _ := structpb.NewStruct(map[string]any{
		"id":       1,
		"disabled": true,
	})

	ctx := biz.NewContextWithClaims(context.Background(), &biz.AuthClaims{
		UserID:   1,
		Username: "admin",
		Role:     biz.RoleAdmin,
	})

	_, res, err := j.handleAuth(ctx, "invite.set_disabled", "1", params)
	if err != nil {
		t.Fatalf("expected nil err, got %v", err)
	}
	if res == nil || res.Code != 0 {
		t.Fatalf("expected code=0, got %+v", res)
	}
}

func TestJsonrpcData_AuthInviteIncreaseUsed_Admin(t *testing.T) {
	repo := newMemAuthRepoForData()
	repo.putInviteCode("INV1", 10, 0, false, nil)

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	authUC := biz.NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "tok", time.Now().Add(time.Hour), nil
	}, logger, tp)

	j := &JsonrpcData{
		log:    log.NewHelper(log.With(logger, "module", "data.jsonrpc.test")),
		authUC: authUC,
	}
	setAuthRepo(j, repo)

	params, _ := structpb.NewStruct(map[string]any{
		"id":    1,
		"delta": 5,
	})

	ctx := biz.NewContextWithClaims(context.Background(), &biz.AuthClaims{
		UserID:   1,
		Username: "admin",
		Role:     biz.RoleAdmin,
	})

	_, res, err := j.handleAuth(ctx, "invite.increase_used", "1", params)
	if err != nil {
		t.Fatalf("expected nil err, got %v", err)
	}
	if res == nil || res.Code != 0 {
		t.Fatalf("expected code=0, got %+v", res)
	}
}

func TestJsonrpcData_AuthUnknownMethod(t *testing.T) {
	repo := newMemAuthRepoForData()

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	authUC := biz.NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "tok", time.Now().Add(time.Hour), nil
	}, logger, tp)

	j := &JsonrpcData{
		log:    log.NewHelper(log.With(logger, "module", "data.jsonrpc.test")),
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
	if res.Code != 40012 {
		t.Fatalf("expected code=40012, got %d", res.Code)
	}
}

// ====== 内部：最小 mem repo（data 包里实现 biz.AuthRepo）======

type memAuthRepoForData struct {
	mu            sync.Mutex
	users         map[string]*biz.User
	invitesByCode map[string]*biz.InviteCode
	nextUserID    int
	nextInviteID  int
}

func newMemAuthRepoForData() *memAuthRepoForData {
	return &memAuthRepoForData{
		users:         make(map[string]*biz.User),
		invitesByCode: make(map[string]*biz.InviteCode),
		nextUserID:    1,
		nextInviteID:  1,
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

func (r *memAuthRepoForData) putInviteCode(code string, maxUses, usedCount int, disabled bool, expiresAt *time.Time) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.invitesByCode[code] = &biz.InviteCode{
		ID:        r.nextInviteID,
		Code:      code,
		MaxUses:   maxUses,
		UsedCount: usedCount,
		ExpiresAt: expiresAt,
		Disabled:  disabled,
	}
	r.nextInviteID++
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
	if u.InviteCode != nil {
		c := *u.InviteCode
		cp.InviteCode = &c
	}
	return &cp, nil
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
	if u.InviteCode != nil {
		c := *u.InviteCode
		cp.InviteCode = &c
	}
	r.users[cp.Username] = &cp
	return &cp, nil
}

func (r *memAuthRepoForData) UpdateUserLastLogin(ctx context.Context, id int, t time.Time) error {
	// 测试中不需要实现
	return nil
}

func (r *memAuthRepoForData) GetInviteCode(ctx context.Context, code string) (*biz.InviteCode, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	ic := r.invitesByCode[code]
	if ic == nil {
		return nil, errors.New("not found")
	}
	cp := *ic
	if ic.ExpiresAt != nil {
		e := *ic.ExpiresAt
		cp.ExpiresAt = &e
	}
	return &cp, nil
}

func (r *memAuthRepoForData) IncreaseInviteCodeUsage(ctx context.Context, id int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, ic := range r.invitesByCode {
		if ic.ID == id {
			ic.UsedCount++
			return nil
		}
	}
	return errors.New("invite id not found")
}

func (r *memAuthRepoForData) ListInviteCodes(ctx context.Context, limit, offset int) ([]*biz.InviteCode, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	list := make([]*biz.InviteCode, 0, len(r.invitesByCode))
	for _, ic := range r.invitesByCode {
		cp := *ic
		if ic.ExpiresAt != nil {
			e := *ic.ExpiresAt
			cp.ExpiresAt = &e
		}
		list = append(list, &cp)
	}
	return list, nil
}

func (r *memAuthRepoForData) CreateInviteCode(ctx context.Context, ic *biz.InviteCode) (*biz.InviteCode, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	cp := *ic
	cp.ID = r.nextInviteID
	r.nextInviteID++
	if ic.ExpiresAt != nil {
		e := *ic.ExpiresAt
		cp.ExpiresAt = &e
	}
	r.invitesByCode[ic.Code] = &cp
	return &cp, nil
}

func (r *memAuthRepoForData) SetInviteCodeDisabled(ctx context.Context, id int, disabled bool) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, ic := range r.invitesByCode {
		if ic.ID == id {
			ic.Disabled = disabled
			return nil
		}
	}
	return errors.New("invite id not found")
}

func (r *memAuthRepoForData) IncreaseInviteCodeUsageBy(ctx context.Context, id int, delta int) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, ic := range r.invitesByCode {
		if ic.ID == id {
			ic.UsedCount += delta
			return nil
		}
	}
	return errors.New("invite id not found")
}
