package v1

import (
	"bytes"
	"context"
	"strings"
	"testing"

	"github.com/go-kratos/kratos/v2/errors"
	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/middleware/logging"
	"google.golang.org/protobuf/types/known/structpb"
)

func TestFrameworkLogsOmitRPCParameters(t *testing.T) {
	params, err := structpb.NewStruct(map[string]any{
		"password":     "password-log-marker",
		"access_token": "token-log-marker",
		"nested":       map[string]any{"private": "nested-log-marker"},
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name string
		req  any
	}{
		{"GET", &GetJsonrpcRequest{Url: "auth", Method: "admin_login", Id: "safe-id", Params: params}},
		{"POST", &PostJsonrpcRequest{Url: "auth", Method: "admin_login", Id: "safe-id", Params: params}},
	} {
		for _, failure := range []bool{false, true} {
			t.Run(tc.name+map[bool]string{false: "/success", true: "/failure"}[failure], func(t *testing.T) {
				var output bytes.Buffer
				called := false
				handler := logging.Server(log.NewStdLogger(&output))(func(_ context.Context, req any) (any, error) {
					called = true
					if req != tc.req || req.(interface{ GetParams() *structpb.Struct }).GetParams() != params {
						t.Fatal("logging must preserve the original request and parameters")
					}
					if failure {
						return nil, errors.BadRequest("TEST", "request rejected")
					}
					return "ok", nil
				})
				_, err := handler(context.Background(), tc.req)
				if !called || (err != nil) != failure {
					t.Fatal("logging changed handler execution")
				}
				for _, marker := range []string{"password-log-marker", "token-log-marker", "nested-log-marker"} {
					if strings.Contains(output.String(), marker) {
						t.Fatal("request parameter leaked into framework logs")
					}
				}
				if !strings.Contains(output.String(), "admin_login") || !strings.Contains(output.String(), "safe-id") {
					t.Fatal("request metadata missing from framework logs")
				}
			})
		}
	}
}
