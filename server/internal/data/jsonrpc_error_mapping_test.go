package data

import (
	"context"
	"io"
	"testing"

	"server/internal/biz"
	"server/internal/errcode"

	"github.com/go-kratos/kratos/v2/log"
)

func TestJsonrpcData_AuthMe_UnauthorizedUsesAuthRequired(t *testing.T) {
	j := &JsonrpcData{
		log: log.NewHelper(log.With(log.NewStdLogger(io.Discard), "module", "data.jsonrpc.test")),
	}

	_, res, err := j.handleAuth(context.Background(), "me", "1", nil)
	if err != nil {
		t.Fatalf("expected nil err, got %v", err)
	}
	if res == nil {
		t.Fatalf("expected result not nil")
	}
	if res.Code != errcode.AuthRequired.Code {
		t.Fatalf("expected code=%d, got %d", errcode.AuthRequired.Code, res.Code)
	}
}

func TestJsonrpcData_ErrorMappers_NoPermissionUsesPermissionDenied(t *testing.T) {
	j := &JsonrpcData{
		log: log.NewHelper(log.With(log.NewStdLogger(io.Discard), "module", "data.jsonrpc.test")),
	}

	userRes := j.mapUserAdminError(context.Background(), biz.ErrNoPermission)
	if userRes == nil {
		t.Fatalf("expected user result not nil")
	}
	if userRes.Code != errcode.PermissionDenied.Code {
		t.Fatalf("expected user code=%d, got %d", errcode.PermissionDenied.Code, userRes.Code)
	}

	adminRes := j.mapAdminManageError(context.Background(), biz.ErrNoPermission)
	if adminRes == nil {
		t.Fatalf("expected admin result not nil")
	}
	if adminRes.Code != errcode.PermissionDenied.Code {
		t.Fatalf("expected admin code=%d, got %d", errcode.PermissionDenied.Code, adminRes.Code)
	}
}
