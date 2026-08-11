package service

import (
	"reflect"
	"testing"

	"server/internal/biz"
)

func TestRBACRoleResultsIncludesPermissionKeys(t *testing.T) {
	results := rbacRoleResults([]biz.RBACRoleSummary{
		{
			ID:             1,
			Key:            "super_admin",
			Name:           "超级管理员",
			PermissionKeys: []string{"admin.access", "admin.user.read"},
		},
	})

	role, ok := results[0].(map[string]any)
	if !ok {
		t.Fatalf("result type = %T, want map[string]any", results[0])
	}
	if !reflect.DeepEqual(role["permission_keys"], []string{"admin.access", "admin.user.read"}) {
		t.Fatalf("permission_keys = %#v", role["permission_keys"])
	}
}
