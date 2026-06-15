package data

import (
	"context"

	"server/internal/biz"

	"github.com/go-kratos/kratos/v2/log"
)

type rbacRepo struct {
	data *Data
	log  *log.Helper
}

func NewRBACRepo(data *Data, logger log.Logger) *rbacRepo {
	return &rbacRepo{
		data: data,
		log:  log.NewHelper(log.With(logger, "module", "data.rbac_repo")),
	}
}

var _ biz.RBACRepo = (*rbacRepo)(nil)

func (r *rbacRepo) Overview(ctx context.Context) (*biz.RBACOverview, error) {
	roleRows, err := r.data.sqldb.QueryContext(
		ctx,
		`SELECT ar.id, ar.key, ar.name, ar.description, ar.builtin, COUNT(aur.admin_user_id) AS admin_count
		 FROM admin_roles ar
		 LEFT JOIN admin_user_roles aur ON aur.admin_role_id = ar.id
		 GROUP BY ar.id, ar.key, ar.name, ar.description, ar.builtin
		 ORDER BY ar.builtin DESC, ar.key ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := roleRows.Close(); err != nil {
			r.log.WithContext(ctx).Warnf("close role rows failed err=%v", err)
		}
	}()

	roles := make([]biz.RBACRoleSummary, 0)
	for roleRows.Next() {
		var role biz.RBACRoleSummary
		if err := roleRows.Scan(&role.ID, &role.Key, &role.Name, &role.Description, &role.Builtin, &role.AdminCount); err != nil {
			return nil, err
		}
		roles = append(roles, role)
	}
	if err := roleRows.Err(); err != nil {
		return nil, err
	}

	permissionRows, err := r.data.sqldb.QueryContext(
		ctx,
		`SELECT key, name, "group", description, builtin
		 FROM admin_permissions
		 ORDER BY "group" ASC, key ASC`,
	)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err := permissionRows.Close(); err != nil {
			r.log.WithContext(ctx).Warnf("close permission rows failed err=%v", err)
		}
	}()

	permissions := make([]biz.RBACPermissionSummary, 0)
	for permissionRows.Next() {
		var permission biz.RBACPermissionSummary
		if err := permissionRows.Scan(&permission.Key, &permission.Name, &permission.Group, &permission.Description, &permission.Builtin); err != nil {
			return nil, err
		}
		permissions = append(permissions, permission)
	}
	if err := permissionRows.Err(); err != nil {
		return nil, err
	}

	return &biz.RBACOverview{
		Roles:       roles,
		Permissions: permissions,
	}, nil
}
