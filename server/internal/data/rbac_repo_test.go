package data

import (
	"context"
	"io"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/go-kratos/kratos/v2/log"
)

func TestRBACOverviewReturnsRolePermissionBindings(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error = %v", err)
	}
	mock.ExpectQuery("SELECT ar.id, ar.key").WillReturnRows(
		sqlmock.NewRows([]string{"id", "key", "name", "description", "builtin", "admin_count"}).
			AddRow(1, "super_admin", "超级管理员", "全部模板权限", true, 1),
	)
	mock.ExpectQuery("SELECT arp.admin_role_id, ap.key").WillReturnRows(
		sqlmock.NewRows([]string{"admin_role_id", "key"}).
			AddRow(1, "admin.access").
			AddRow(1, "admin.user.read"),
	)
	mock.ExpectQuery(`SELECT key, name, "group"`).WillReturnRows(
		sqlmock.NewRows([]string{"key", "name", "group", "description", "builtin"}).
			AddRow("admin.access", "后台访问", "系统", "允许进入后台", true).
			AddRow("admin.user.read", "查看账号", "账号", "允许查看账号", true),
	)
	mock.ExpectClose()

	repo := NewRBACRepo(
		&Data{sqldb: db},
		log.NewStdLogger(io.Discard),
	)
	overview, err := repo.Overview(context.Background())
	if err != nil {
		t.Fatalf("Overview() error = %v", err)
	}

	if len(overview.Roles) != 1 {
		t.Fatalf("len(Roles) = %d, want 1", len(overview.Roles))
	}
	got := overview.Roles[0].PermissionKeys
	if len(got) != 2 || got[0] != "admin.access" || got[1] != "admin.user.read" {
		t.Fatalf("PermissionKeys = %#v, want ordered role bindings", got)
	}
	if len(overview.Permissions) != 2 {
		t.Fatalf("len(Permissions) = %d, want 2", len(overview.Permissions))
	}

	mustCloseDB(t, db)
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("ExpectationsWereMet() error = %v", err)
	}
}
