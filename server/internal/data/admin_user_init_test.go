package data

import (
	"context"
	"io"
	"regexp"
	"testing"

	"server/internal/biz"
	"server/internal/conf"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/go-kratos/kratos/v2/log"
)

func mustCloseDB(t *testing.T, db interface{ Close() error }) {
	t.Helper()
	if err := db.Close(); err != nil {
		t.Fatalf("db.Close() error = %v", err)
	}
}

func TestInitAdminUsersIfNeededCreatesAdminOnce(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error = %v", err)
	}

	mock.ExpectExec(regexp.QuoteMeta(
		"INSERT INTO admin_users (username, password_hash, disabled, created_at, updated_at) VALUES ($1, $2, FALSE, $3, $4) ON CONFLICT (username) DO NOTHING",
	)).
		WithArgs("trialadmin", sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 1))
	expectAdminRBACDefaults(mock)
	mock.ExpectClose()

	err = InitAdminUsersIfNeeded(context.Background(), &Data{sqldb: db}, testAdminInitConfig(), log.NewHelper(log.NewStdLogger(io.Discard)))
	if err != nil {
		t.Fatalf("InitAdminUsersIfNeeded() error = %v", err)
	}
	mustCloseDB(t, db)

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("ExpectationsWereMet() error = %v", err)
	}
}

func TestInitAdminUsersIfNeededSkipsWhenAdminAlreadyExists(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error = %v", err)
	}

	mock.ExpectExec(regexp.QuoteMeta(
		"INSERT INTO admin_users (username, password_hash, disabled, created_at, updated_at) VALUES ($1, $2, FALSE, $3, $4) ON CONFLICT (username) DO NOTHING",
	)).
		WithArgs("trialadmin", sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg()).
		WillReturnResult(sqlmock.NewResult(0, 0))
	expectAdminRBACDefaults(mock)
	mock.ExpectClose()

	err = InitAdminUsersIfNeeded(context.Background(), &Data{sqldb: db}, testAdminInitConfig(), log.NewHelper(log.NewStdLogger(io.Discard)))
	if err != nil {
		t.Fatalf("InitAdminUsersIfNeeded() error = %v", err)
	}
	mustCloseDB(t, db)

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("ExpectationsWereMet() error = %v", err)
	}
}

func expectAdminRBACDefaults(mock sqlmock.Sqlmock) {
	for _, p := range biz.DefaultAdminPermissions {
		mock.ExpectExec("INSERT INTO admin_permissions").
			WithArgs(p.Key, p.Name, p.Group, p.Description, sqlmock.AnyArg(), sqlmock.AnyArg()).
			WillReturnResult(sqlmock.NewResult(0, 1))
	}
	mock.ExpectExec("INSERT INTO admin_roles").
		WithArgs(
			biz.SuperAdminRoleKey,
			"超级管理员",
			"模板内置最高权限角色，初始化管理员默认绑定",
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectExec("INSERT INTO admin_role_permissions").
		WithArgs(sqlmock.AnyArg(), biz.SuperAdminRoleKey).
		WillReturnResult(sqlmock.NewResult(0, int64(len(biz.DefaultAdminPermissions))))
	mock.ExpectExec("INSERT INTO admin_user_roles").
		WithArgs(sqlmock.AnyArg(), "trialadmin", biz.SuperAdminRoleKey).
		WillReturnResult(sqlmock.NewResult(0, 1))
}

func TestInitAdminUsersIfNeededSkipsWhenCredentialsMissing(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error = %v", err)
	}
	mock.ExpectClose()

	err = InitAdminUsersIfNeeded(context.Background(), &Data{sqldb: db}, &conf.Data{
		Auth: &conf.Data_Auth{
			Admin: &conf.Data_Auth_Admin{},
		},
	}, log.NewHelper(log.NewStdLogger(io.Discard)))
	if err != nil {
		t.Fatalf("InitAdminUsersIfNeeded() error = %v", err)
	}
	mustCloseDB(t, db)

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("ExpectationsWereMet() error = %v", err)
	}
}

func testAdminInitConfig() *conf.Data {
	return &conf.Data{
		Auth: &conf.Data_Auth{
			Admin: &conf.Data_Auth_Admin{
				Username: "trialadmin",
				Password: "trial-password",
			},
		},
	}
}
