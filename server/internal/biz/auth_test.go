// server/internal/biz/auth_test.go
package biz

import (
	"context"
	"errors"
	"io"
	"sync"
	"testing"
	"time"

	"github.com/go-kratos/kratos/v2/log"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
	"golang.org/x/crypto/bcrypt"
)

type memAuthRepo struct {
	mu sync.Mutex

	usersByName   map[string]*User
	invitesByCode map[string]*InviteCode

	lastLogin  map[int]time.Time
	nextUserID int
}

func newMemAuthRepo() *memAuthRepo {
	return &memAuthRepo{
		usersByName:   make(map[string]*User),
		invitesByCode: make(map[string]*InviteCode),
		lastLogin:     make(map[int]time.Time),
		nextUserID:    1,
	}
}

func (r *memAuthRepo) GetUserByUsername(ctx context.Context, username string) (*User, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	u := r.usersByName[username]
	if u == nil {
		return nil, errors.New("not found")
	}
	// 返回拷贝，避免测试里被外部改动
	cp := *u
	if u.InviteCode != nil {
		c := *u.InviteCode
		cp.InviteCode = &c
	}
	return &cp, nil
}

func (r *memAuthRepo) CreateUser(ctx context.Context, u *User) (*User, error) {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, ok := r.usersByName[u.Username]; ok {
		return nil, errors.New("duplicate username")
	}
	cp := *u
	cp.ID = r.nextUserID
	r.nextUserID++

	if u.InviteCode != nil {
		c := *u.InviteCode
		cp.InviteCode = &c
	}

	r.usersByName[cp.Username] = &cp
	return &cp, nil
}

func (r *memAuthRepo) UpdateUserLastLogin(ctx context.Context, id int, t time.Time) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.lastLogin[id] = t
	return nil
}

func (r *memAuthRepo) GetInviteCode(ctx context.Context, code string) (*InviteCode, error) {
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

func (r *memAuthRepo) IncreaseInviteCodeUsage(ctx context.Context, id int) error {
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

func (r *memAuthRepo) ListInviteCodes(ctx context.Context, limit, offset int) ([]*InviteCode, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	list := make([]*InviteCode, 0, len(r.invitesByCode))
	for _, ic := range r.invitesByCode {
		cp := *ic
		if ic.ExpiresAt != nil {
			e := *ic.ExpiresAt
			cp.ExpiresAt = &e
		}
		list = append(list, &cp)
	}
	// 简单实现：不处理 limit/offset
	return list, nil
}

func (r *memAuthRepo) CreateInviteCode(ctx context.Context, ic *InviteCode) (*InviteCode, error) {
	r.mu.Lock()
	defer r.mu.Unlock()
	cp := *ic
	if ic.ExpiresAt != nil {
		e := *ic.ExpiresAt
		cp.ExpiresAt = &e
	}
	r.invitesByCode[ic.Code] = &cp
	return &cp, nil
}

func (r *memAuthRepo) SetInviteCodeDisabled(ctx context.Context, id int, disabled bool) error {
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

func (r *memAuthRepo) IncreaseInviteCodeUsageBy(ctx context.Context, id int, delta int) error {
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

func TestAuthUsecase_Register_Success(t *testing.T) {
	repo := newMemAuthRepo()
	repo.invitesByCode["INV123"] = &InviteCode{
		ID: 1, Code: "INV123", MaxUses: 10, UsedCount: 0, Disabled: false,
	}

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()

	genTok := func(userID int, username string, role int8) (string, time.Time, error) {
		return "tok-abc", time.Now().Add(7 * 24 * time.Hour), nil
	}

	uc := NewAuthUsecase(repo, genTok, logger, tp)

	token, exp, u, err := uc.Register(context.Background(), "alice", "p@ss", "INV123")
	if err != nil {
		t.Fatalf("expected nil err, got %v", err)
	}
	if token != "tok-abc" {
		t.Fatalf("unexpected token: %s", token)
	}
	if u == nil || u.Username != "alice" || u.ID == 0 {
		t.Fatalf("unexpected user: %+v", u)
	}
	if exp.Before(time.Now()) {
		t.Fatalf("unexpected expireAt: %v", exp)
	}

	// invite used count should increase
	ic, _ := repo.GetInviteCode(context.Background(), "INV123")
	if ic.UsedCount != 1 {
		t.Fatalf("expected UsedCount=1, got %d", ic.UsedCount)
	}
}

func TestAuthUsecase_Register_InviteNotFound(t *testing.T) {
	repo := newMemAuthRepo()

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	uc := NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "", time.Time{}, nil
	}, logger, tp)

	_, _, _, err := uc.Register(context.Background(), "alice", "p@ss", "NOPE")
	if !errors.Is(err, ErrInviteCodeNotFound) {
		t.Fatalf("expected ErrInviteCodeNotFound, got %v", err)
	}
}

func TestAuthUsecase_Register_InviteDisabled(t *testing.T) {
	repo := newMemAuthRepo()
	repo.invitesByCode["INV"] = &InviteCode{ID: 1, Code: "INV", Disabled: true}

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	uc := NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "", time.Time{}, nil
	}, logger, tp)

	_, _, _, err := uc.Register(context.Background(), "alice", "p@ss", "INV")
	if !errors.Is(err, ErrInviteCodeDisabled) {
		t.Fatalf("expected ErrInviteCodeDisabled, got %v", err)
	}
}

func TestAuthUsecase_Register_InviteUsedUp(t *testing.T) {
	repo := newMemAuthRepo()
	repo.invitesByCode["INV"] = &InviteCode{ID: 1, Code: "INV", MaxUses: 1, UsedCount: 1}

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	uc := NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "", time.Time{}, nil
	}, logger, tp)

	_, _, _, err := uc.Register(context.Background(), "alice", "p@ss", "INV")
	if !errors.Is(err, ErrInviteCodeUsedUp) {
		t.Fatalf("expected ErrInviteCodeUsedUp, got %v", err)
	}
}

func TestAuthUsecase_Register_InviteExpired(t *testing.T) {
	repo := newMemAuthRepo()
	past := time.Now().Add(-1 * time.Hour)
	repo.invitesByCode["INV"] = &InviteCode{ID: 1, Code: "INV", ExpiresAt: &past}

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	uc := NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "", time.Time{}, nil
	}, logger, tp)

	_, _, _, err := uc.Register(context.Background(), "alice", "p@ss", "INV")
	if !errors.Is(err, ErrInviteCodeExpired) {
		t.Fatalf("expected ErrInviteCodeExpired, got %v", err)
	}
}

func TestAuthUsecase_Register_UserExists(t *testing.T) {
	repo := newMemAuthRepo()
	repo.invitesByCode["INV"] = &InviteCode{ID: 1, Code: "INV"}

	// pre-create user
	hash, _ := bcrypt.GenerateFromPassword([]byte("x"), bcrypt.DefaultCost)
	ic := "INV"
	_, _ = repo.CreateUser(context.Background(), &User{
		Username:     "alice",
		PasswordHash: string(hash),
		InviteCode:   &ic,
	})

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	uc := NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "", time.Time{}, nil
	}, logger, tp)

	_, _, _, err := uc.Register(context.Background(), "alice", "p@ss", "INV")
	if !errors.Is(err, ErrUserExists) {
		t.Fatalf("expected ErrUserExists, got %v", err)
	}
}

func TestAuthUsecase_Login_Success(t *testing.T) {
	repo := newMemAuthRepo()

	hash, _ := bcrypt.GenerateFromPassword([]byte("p@ss"), bcrypt.DefaultCost)
	_, _ = repo.CreateUser(context.Background(), &User{
		Username:     "alice",
		PasswordHash: string(hash),
		Disabled:     false,
	})

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	uc := NewAuthUsecase(repo, func(userID int, username string, role int8) (string, time.Time, error) {
		return "tok-login", time.Now().Add(time.Hour), nil
	}, logger, tp)

	token, exp, u, err := uc.Login(context.Background(), "alice", "p@ss")
	if err != nil {
		t.Fatalf("expected nil err, got %v", err)
	}
	if token != "tok-login" {
		t.Fatalf("unexpected token: %s", token)
	}
	if u == nil || u.Username != "alice" {
		t.Fatalf("unexpected user: %+v", u)
	}
	if exp.Before(time.Now()) {
		t.Fatalf("unexpected expireAt: %v", exp)
	}
}

func TestAuthUsecase_Login_UserNotFound(t *testing.T) {
	repo := newMemAuthRepo()

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	uc := NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "", time.Time{}, nil
	}, logger, tp)

	_, _, _, err := uc.Login(context.Background(), "noone", "x")
	if !errors.Is(err, ErrUserNotFound) {
		t.Fatalf("expected ErrUserNotFound, got %v", err)
	}
}

func TestAuthUsecase_Login_UserDisabled(t *testing.T) {
	repo := newMemAuthRepo()

	hash, _ := bcrypt.GenerateFromPassword([]byte("p@ss"), bcrypt.DefaultCost)
	_, _ = repo.CreateUser(context.Background(), &User{
		Username:     "alice",
		PasswordHash: string(hash),
		Disabled:     true,
	})

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	uc := NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "", time.Time{}, nil
	}, logger, tp)

	_, _, _, err := uc.Login(context.Background(), "alice", "p@ss")
	if !errors.Is(err, ErrUserDisabled) {
		t.Fatalf("expected ErrUserDisabled, got %v", err)
	}
}

func TestAuthUsecase_Login_InvalidPassword(t *testing.T) {
	repo := newMemAuthRepo()

	hash, _ := bcrypt.GenerateFromPassword([]byte("p@ss"), bcrypt.DefaultCost)
	_, _ = repo.CreateUser(context.Background(), &User{
		Username:     "alice",
		PasswordHash: string(hash),
		Disabled:     false,
	})

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	uc := NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "", time.Time{}, nil
	}, logger, tp)

	_, _, _, err := uc.Login(context.Background(), "alice", "wrong")
	if !errors.Is(err, ErrInvalidPassword) {
		t.Fatalf("expected ErrInvalidPassword, got %v", err)
	}
}

func TestAuthUsecase_Register_EmptyArgs(t *testing.T) {
	repo := newMemAuthRepo()
	repo.invitesByCode["INV"] = &InviteCode{ID: 1, Code: "INV"}

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	uc := NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "", time.Time{}, nil
	}, logger, tp)

	// 空用户名
	_, _, _, err := uc.Register(context.Background(), "", "p@ss", "INV")
	if err == nil {
		t.Fatalf("expected error for empty username")
	}

	// 空密码
	_, _, _, err = uc.Register(context.Background(), "alice", "", "INV")
	if err == nil {
		t.Fatalf("expected error for empty password")
	}

	// 空邀请码
	_, _, _, err = uc.Register(context.Background(), "alice", "p@ss", "")
	if err == nil {
		t.Fatalf("expected error for empty invite code")
	}
}

func TestAuthUsecase_Login_EmptyArgs(t *testing.T) {
	repo := newMemAuthRepo()

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	uc := NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "", time.Time{}, nil
	}, logger, tp)

	// 空用户名
	_, _, _, err := uc.Login(context.Background(), "", "p@ss")
	if err == nil {
		t.Fatalf("expected error for empty username")
	}

	// 空密码
	_, _, _, err = uc.Login(context.Background(), "alice", "")
	if err == nil {
		t.Fatalf("expected error for empty password")
	}
}

func TestAuthUsecase_Register_TokenGenFailed(t *testing.T) {
	repo := newMemAuthRepo()
	repo.invitesByCode["INV123"] = &InviteCode{
		ID: 1, Code: "INV123", MaxUses: 10, UsedCount: 0, Disabled: false,
	}

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	uc := NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "", time.Time{}, errors.New("token gen failed")
	}, logger, tp)

	_, _, _, err := uc.Register(context.Background(), "alice", "p@ss", "INV123")
	if err == nil {
		t.Fatalf("expected error when token generation fails")
	}
}

func TestAuthUsecase_Login_TokenGenFailed(t *testing.T) {
	repo := newMemAuthRepo()

	hash, _ := bcrypt.GenerateFromPassword([]byte("p@ss"), bcrypt.DefaultCost)
	_, _ = repo.CreateUser(context.Background(), &User{
		Username:     "alice",
		PasswordHash: string(hash),
		Disabled:     false,
	})

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	uc := NewAuthUsecase(repo, func(int, string, int8) (string, time.Time, error) {
		return "", time.Time{}, errors.New("token gen failed")
	}, logger, tp)

	_, _, _, err := uc.Login(context.Background(), "alice", "p@ss")
	if err == nil {
		t.Fatalf("expected error when token generation fails")
	}
}

func TestAuthUsecase_Register_InviteMaxUsesZero(t *testing.T) {
	// MaxUses=0 表示无限制
	repo := newMemAuthRepo()
	repo.invitesByCode["INV"] = &InviteCode{
		ID: 1, Code: "INV", MaxUses: 0, UsedCount: 100, Disabled: false,
	}

	logger := log.NewStdLogger(io.Discard)
	tp := tracesdk.NewTracerProvider()
	genTok := func(userID int, username string, role int8) (string, time.Time, error) {
		return "tok", time.Now().Add(time.Hour), nil
	}
	uc := NewAuthUsecase(repo, genTok, logger, tp)

	_, _, _, err := uc.Register(context.Background(), "alice", "p@ss", "INV")
	if err != nil {
		t.Fatalf("expected success when MaxUses=0 (unlimited), got %v", err)
	}
}
