package service

import (
	"bytes"
	"context"
	"strings"
	"testing"

	"github.com/go-kratos/kratos/v2/log"
	"google.golang.org/protobuf/types/known/structpb"
)

func TestDispatcherDoesNotLogRPCParameters(t *testing.T) {
	var output bytes.Buffer
	dispatcher := &jsonrpcDispatcher{log: log.NewHelper(log.NewStdLogger(&output))}
	params, err := structpb.NewStruct(map[string]any{
		"password": "dispatcher-password-marker",
		"token":    "dispatcher-token-marker",
	})
	if err != nil {
		t.Fatal(err)
	}
	_, result, err := dispatcher.Handle(context.Background(), "system", "2.0", "ping", "safe-id", params)
	if err != nil || result.Code != 0 {
		t.Fatal("metadata logging must preserve request handling")
	}
	for _, marker := range []string{"dispatcher-password-marker", "dispatcher-token-marker"} {
		if strings.Contains(output.String(), marker) {
			t.Fatal("request parameter leaked into dispatcher logs")
		}
	}
	if !strings.Contains(output.String(), "method=ping") {
		t.Fatal("request metadata missing from dispatcher logs")
	}
}
