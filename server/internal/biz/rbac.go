package biz

import "context"

type AdminPermission struct {
	Key         string
	Name        string
	Group       string
	Description string
}

const (
	PermissionAdminAccess = "admin.access"
	PermissionUserRead    = "admin.user.read"
	PermissionUserWrite   = "admin.user.write"
	PermissionRBACRead    = "admin.rbac.read"
)

const SuperAdminRoleKey = "super_admin"

var DefaultAdminPermissions = []AdminPermission{
	{
		Key:         PermissionAdminAccess,
		Name:        "后台访问",
		Group:       "系统",
		Description: "允许进入管理员后台基础入口",
	},
	{
		Key:         PermissionUserRead,
		Name:        "查看账号",
		Group:       "账号",
		Description: "允许查看普通用户账号目录",
	},
	{
		Key:         PermissionUserWrite,
		Name:        "管理账号状态",
		Group:       "账号",
		Description: "允许启用或禁用普通用户账号",
	},
	{
		Key:         PermissionRBACRead,
		Name:        "查看角色权限",
		Group:       "权限",
		Description: "允许查看后台角色与权限基线",
	},
}

func DefaultAdminPermissionKeys() []string {
	out := make([]string, 0, len(DefaultAdminPermissions))
	for _, p := range DefaultAdminPermissions {
		out = append(out, p.Key)
	}
	return out
}

type RBACRoleSummary struct {
	ID          int
	Key         string
	Name        string
	Description string
	Builtin     bool
	AdminCount  int
}

type RBACPermissionSummary struct {
	Key         string
	Name        string
	Group       string
	Description string
	Builtin     bool
}

type RBACOverview struct {
	Roles       []RBACRoleSummary
	Permissions []RBACPermissionSummary
}

type RBACRepo interface {
	Overview(ctx context.Context) (*RBACOverview, error)
}

type RBACUsecase struct {
	repo RBACRepo
}

func NewRBACUsecase(repo RBACRepo) *RBACUsecase {
	return &RBACUsecase{repo: repo}
}

func (uc *RBACUsecase) Overview(ctx context.Context) (*RBACOverview, error) {
	return uc.repo.Overview(ctx)
}
