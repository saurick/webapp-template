// server/internal/biz/admin_manage.go
package biz

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/go-kratos/kratos/v2/log"
	"go.opentelemetry.io/otel"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/crypto/bcrypt"
)

type AdminLevel int8

const (
	AdminLevelSuper     AdminLevel = 0
	AdminLevelPrimary   AdminLevel = 1
	AdminLevelSecondary AdminLevel = 2
)

var (
	ErrAdminNotFound      = errors.New("admin not found")
	ErrAdminExists        = errors.New("admin already exists")
	ErrAdminDisabled      = errors.New("admin disabled")
	ErrAdminInvalidLevel  = errors.New("invalid admin level")
	ErrAdminInvalidParent = errors.New("invalid admin parent")
)

type AdminAccount struct {
	ID                  int
	Username            string
	Level               AdminLevel
	ParentID            *int
	Disabled            bool
	LastLoginAt         *time.Time
	CreatedAt           time.Time
	UpdatedAt           time.Time
	UserCount           int
	ManageableUserCount int
	ChildAdminCount     int
}

type AdminCreate struct {
	Username     string
	PasswordHash string
	Level        AdminLevel
	ParentID     *int
}

type AdminRevokeResult struct {
	TransferredUsers       int
	TransferredChildAdmins int
	TransferToAdminID      int
}

type AdminManageRepo interface {
	GetAdminByID(ctx context.Context, id int) (*AdminAccount, error)
	GetAdminByUsername(ctx context.Context, username string) (*AdminAccount, error)
	ListAdmins(ctx context.Context) ([]*AdminAccount, error)
	CountUsersByAdmin(ctx context.Context) (map[int]int, error)
	CountChildAdmins(ctx context.Context) (map[int]int, error)
	CountChildAdminsByParent(ctx context.Context, parentID int) (int, error)
	CreateAdmin(ctx context.Context, admin *AdminCreate) (*AdminAccount, error)
	UpdateAdminHierarchy(ctx context.Context, id int, level AdminLevel, parentID *int) error
	SetAdminDisabled(ctx context.Context, id int, disabled bool) error
	TransferUsers(ctx context.Context, fromAdminID int, toAdminID *int) (int, error)
	TransferChildAdmins(ctx context.Context, fromAdminID int, toAdminID *int) (int, error)
}

type AdminManageUsecase struct {
	repo   AdminManageRepo
	log    *log.Helper
	tracer trace.Tracer
}

func NewAdminManageUsecase(repo AdminManageRepo, logger log.Logger, tp *tracesdk.TracerProvider) *AdminManageUsecase {
	helper := log.NewHelper(log.With(logger, "module", "biz.admin_manage"))
	var tr trace.Tracer
	if tp != nil {
		tr = tp.Tracer("biz.admin_manage")
	} else {
		tr = otel.Tracer("biz.admin_manage")
	}
	return &AdminManageUsecase{
		repo:   repo,
		log:    helper,
		tracer: tr,
	}
}

func (uc *AdminManageUsecase) Tracer() trace.Tracer {
	if uc.tracer != nil {
		return uc.tracer
	}
	return otel.Tracer("biz.admin_manage")
}

func (uc *AdminManageUsecase) requireAdmin(ctx context.Context) (*AuthClaims, error) {
	c, ok := GetClaimsFromContext(ctx)
	if !ok || c == nil {
		return nil, ErrForbidden
	}
	if c.Role != RoleAdmin {
		return nil, ErrForbidden
	}
	return c, nil
}

func (uc *AdminManageUsecase) requireAdminAccount(ctx context.Context) (*AuthClaims, *AdminAccount, error) {
	claims, err := uc.requireAdmin(ctx)
	if err != nil {
		return nil, nil, err
	}
	admin, err := uc.getAdminFromClaims(ctx, claims)
	if err != nil {
		return nil, nil, err
	}
	if admin.Disabled {
		return nil, nil, ErrAdminDisabled
	}
	return claims, admin, nil
}

func (uc *AdminManageUsecase) getAdminFromClaims(ctx context.Context, claims *AuthClaims) (*AdminAccount, error) {
	if claims == nil {
		return nil, ErrForbidden
	}
	admin, err := uc.repo.GetAdminByID(ctx, claims.UserID)
	if err == nil && admin != nil {
		return admin, nil
	}
	if err != nil && !errors.Is(err, ErrAdminNotFound) {
		return nil, err
	}
	if claims.Username == "" {
		return nil, ErrAdminNotFound
	}
	return uc.repo.GetAdminByUsername(ctx, claims.Username)
}

func (uc *AdminManageUsecase) requireSuperAdmin(ctx context.Context) (*AuthClaims, *AdminAccount, error) {
	claims, admin, err := uc.requireAdminAccount(ctx)
	if err != nil {
		return nil, nil, err
	}
	if admin.Level != AdminLevelSuper {
		return nil, nil, ErrNoPermission
	}
	return claims, admin, nil
}

func (uc *AdminManageUsecase) GetCurrent(ctx context.Context) (*AdminAccount, error) {
	_, admin, err := uc.requireAdminAccount(ctx)
	return admin, err
}

func (uc *AdminManageUsecase) List(ctx context.Context) ([]*AdminAccount, error) {
	_, operator, err := uc.requireAdminAccount(ctx)
	if err != nil {
		return nil, err
	}
	if operator.Level == AdminLevelSecondary {
		return nil, ErrNoPermission
	}

	admins, err := uc.repo.ListAdmins(ctx)
	if err != nil {
		return nil, err
	}

	userCounts, err := uc.repo.CountUsersByAdmin(ctx)
	if err != nil {
		return nil, err
	}
	childCounts, err := uc.repo.CountChildAdmins(ctx)
	if err != nil {
		return nil, err
	}

	filtered := admins
	if operator.Level == AdminLevelPrimary {
		filtered = make([]*AdminAccount, 0, len(admins))
		for _, a := range admins {
			if a.ID == operator.ID {
				filtered = append(filtered, a)
				continue
			}
			if a.Level == AdminLevelSecondary && a.ParentID != nil && *a.ParentID == operator.ID {
				filtered = append(filtered, a)
			}
		}
	}

	totalUsers := 0
	for _, cnt := range userCounts {
		totalUsers += cnt
	}

	secondaryChildrenByParent := make(map[int][]int)
	for _, a := range admins {
		if a.Level != AdminLevelSecondary || a.ParentID == nil {
			continue
		}
		secondaryChildrenByParent[*a.ParentID] = append(secondaryChildrenByParent[*a.ParentID], a.ID)
	}

	for _, a := range filtered {
		a.UserCount = userCounts[a.ID]
		a.ChildAdminCount = childCounts[a.ID]

		// 展示“可管理总用户数”口径：
		// super=全量，level1=自己+二级下级，level2=自己。
		switch a.Level {
		case AdminLevelSuper:
			a.ManageableUserCount = totalUsers
		case AdminLevelPrimary:
			manageable := a.UserCount
			for _, childID := range secondaryChildrenByParent[a.ID] {
				manageable += userCounts[childID]
			}
			a.ManageableUserCount = manageable
		default:
			a.ManageableUserCount = a.UserCount
		}
	}
	return filtered, nil
}

func (uc *AdminManageUsecase) Create(
	ctx context.Context,
	username string,
	password string,
	level AdminLevel,
	parentID *int,
) (*AdminAccount, error) {
	_, operator, err := uc.requireAdminAccount(ctx)
	if err != nil {
		return nil, err
	}
	if operator.Level == AdminLevelSecondary {
		return nil, ErrNoPermission
	}

	username = strings.TrimSpace(username)
	if username == "" || password == "" {
		return nil, ErrBadParam
	}

	if level != AdminLevelPrimary && level != AdminLevelSecondary {
		return nil, ErrAdminInvalidLevel
	}

	if operator.Level == AdminLevelPrimary {
		if level != AdminLevelSecondary {
			return nil, ErrNoPermission
		}
		parentID = &operator.ID
	} else if level == AdminLevelPrimary {
		parentID = nil
	}

	if level == AdminLevelSecondary {
		if parentID == nil || *parentID <= 0 {
			return nil, ErrAdminInvalidParent
		}
		parent, err := uc.repo.GetAdminByID(ctx, *parentID)
		if err != nil {
			return nil, ErrAdminInvalidParent
		}
		if parent.Disabled || parent.Level != AdminLevelPrimary {
			return nil, ErrAdminInvalidParent
		}
	}

	if existing, err := uc.repo.GetAdminByUsername(ctx, username); err == nil && existing != nil {
		return nil, ErrAdminExists
	} else if err != nil && !errors.Is(err, ErrAdminNotFound) && !errors.Is(err, ErrBadParam) {
		return nil, err
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	return uc.repo.CreateAdmin(ctx, &AdminCreate{
		Username:     username,
		PasswordHash: string(hash),
		Level:        level,
		ParentID:     parentID,
	})
}

func (uc *AdminManageUsecase) UpdateHierarchy(
	ctx context.Context,
	adminID int,
	level AdminLevel,
	parentID *int,
) (*AdminAccount, error) {
	_, operator, err := uc.requireAdminAccount(ctx)
	if err != nil {
		return nil, err
	}
	if operator.Level == AdminLevelSecondary {
		return nil, ErrNoPermission
	}

	if adminID <= 0 {
		return nil, ErrBadParam
	}

	target, err := uc.repo.GetAdminByID(ctx, adminID)
	if err != nil {
		return nil, err
	}
	if target.Level == AdminLevelSuper {
		return nil, ErrNoPermission
	}

	if level != AdminLevelPrimary && level != AdminLevelSecondary {
		return nil, ErrAdminInvalidLevel
	}

	if operator.Level == AdminLevelPrimary {
		if target.Level != AdminLevelSecondary {
			return nil, ErrNoPermission
		}
		if target.ParentID == nil || *target.ParentID != operator.ID {
			return nil, ErrNoPermission
		}
		if level != AdminLevelSecondary {
			return nil, ErrNoPermission
		}
		parentID = &operator.ID
	} else if level == AdminLevelPrimary {
		parentID = nil
	}

	if level == AdminLevelSecondary {
		if parentID == nil || *parentID <= 0 || *parentID == adminID {
			return nil, ErrAdminInvalidParent
		}
		parent, err := uc.repo.GetAdminByID(ctx, *parentID)
		if err != nil {
			return nil, ErrAdminInvalidParent
		}
		// 二级管理员只能归属一级管理员（保持层级结构清晰：超级 → 一级 → 二级）
		if parent.Disabled || parent.Level != AdminLevelPrimary {
			return nil, ErrAdminInvalidParent
		}

		childCount, err := uc.repo.CountChildAdminsByParent(ctx, adminID)
		if err != nil {
			return nil, err
		}
		if childCount > 0 {
			return nil, ErrAdminInvalidParent
		}
	}

	if err := uc.repo.UpdateAdminHierarchy(ctx, adminID, level, parentID); err != nil {
		return nil, err
	}
	return uc.repo.GetAdminByID(ctx, adminID)
}

func (uc *AdminManageUsecase) Revoke(
	ctx context.Context,
	adminID int,
	transferToID *int,
) (*AdminRevokeResult, error) {
	_, operator, err := uc.requireAdminAccount(ctx)
	if err != nil {
		return nil, err
	}
	if adminID <= 0 || adminID == operator.ID {
		return nil, ErrBadParam
	}

	target, err := uc.repo.GetAdminByID(ctx, adminID)
	if err != nil {
		return nil, err
	}
	if target.Level == AdminLevelSuper {
		return nil, ErrNoPermission
	}
	if operator.Level == AdminLevelSecondary {
		return nil, ErrNoPermission
	}
	if operator.Level == AdminLevelPrimary {
		if target.Level != AdminLevelSecondary {
			return nil, ErrNoPermission
		}
		if target.ParentID == nil || *target.ParentID != operator.ID {
			return nil, ErrNoPermission
		}
	}

	toID := operator.ID
	var toAdmin *AdminAccount
	if transferToID != nil && *transferToID > 0 {
		if *transferToID == adminID {
			return nil, ErrAdminInvalidParent
		}
		toAdmin, err = uc.repo.GetAdminByID(ctx, *transferToID)
		if err != nil {
			return nil, ErrAdminInvalidParent
		}
		if toAdmin.Disabled {
			return nil, ErrAdminInvalidParent
		}
		toID = toAdmin.ID
	}

	// 一级管理员的转移限制：只能转移给自己或自己的二级子管理员
	if operator.Level == AdminLevelPrimary && toAdmin != nil && toAdmin.ID != operator.ID {
		// 不能转移给其他一级管理员或超级管理员
		if toAdmin.Level == AdminLevelPrimary || toAdmin.Level == AdminLevelSuper {
			return nil, ErrNoPermission
		}
		// 只能转移给自己的二级子管理员
		if toAdmin.Level == AdminLevelSecondary {
			if toAdmin.ParentID == nil || *toAdmin.ParentID != operator.ID {
				return nil, ErrNoPermission
			}
		}
	}

	if target.Level == AdminLevelPrimary {
		if toAdmin != nil && toAdmin.Level == AdminLevelSecondary {
			return nil, ErrAdminInvalidParent
		}
	}

	transferID := &toID
	usersMoved, err := uc.repo.TransferUsers(ctx, adminID, transferID)
	if err != nil {
		return nil, err
	}

	childMoved := 0
	if target.Level == AdminLevelPrimary {
		childMoved, err = uc.repo.TransferChildAdmins(ctx, adminID, transferID)
		if err != nil {
			return nil, err
		}
	}

	if err := uc.repo.SetAdminDisabled(ctx, adminID, true); err != nil {
		return nil, err
	}

	return &AdminRevokeResult{
		TransferredUsers:       usersMoved,
		TransferredChildAdmins: childMoved,
		TransferToAdminID:      toID,
	}, nil
}
