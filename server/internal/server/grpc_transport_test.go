package server

import (
	"context"
	"errors"
	"io"
	"net"
	"testing"
	"time"

	v1 "server/api/jsonrpc/v1"
	"server/internal/biz"
	"server/internal/conf"
	"server/internal/errcode"
	"server/internal/service"

	"github.com/go-kratos/kratos/v2/log"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/test/bufconn"
)

type transportAdminReader struct{}

func (transportAdminReader) GetAdminByID(context.Context, int) (*biz.AdminUser, error) {
	return nil, errors.New("transport test must not read an admin account")
}

func newTransportJSONRPCService(logger log.Logger) *service.JsonrpcService {
	return service.NewJsonrpcService(
		&biz.AuthUsecase{}, &biz.AdminAuthUsecase{}, &biz.UserAdminUsecase{},
		&biz.RBACUsecase{}, transportAdminReader{}, logger,
	)
}

func TestGRPCTransportPublicPingAndAuthentication(t *testing.T) {
	logger := log.NewStdLogger(io.Discard)
	tp := sdktrace.NewTracerProvider()
	t.Cleanup(func() { _ = tp.Shutdown(context.Background()) })

	// Public methods and authentication rejection must finish without repositories.
	svc := newTransportJSONRPCService(logger)
	srv := NewGRPCServer(&conf.Server{}, logger, svc, tp, nil)
	listener := bufconn.Listen(1024 * 1024)
	served := make(chan error, 1)
	go func() { served <- srv.Serve(listener) }()
	t.Cleanup(func() {
		_ = srv.Stop(context.Background())
		_ = listener.Close()
		select {
		case err := <-served:
			if err != nil && !errors.Is(err, grpc.ErrServerStopped) {
				t.Errorf("gRPC serve: %v", err)
			}
		case <-time.After(3 * time.Second):
			t.Error("gRPC server did not stop")
		}
	})
	conn, err := grpc.NewClient("passthrough:///template-test",
		grpc.WithContextDialer(func(ctx context.Context, _ string) (net.Conn, error) {
			return listener.DialContext(ctx)
		}),
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = conn.Close() })
	client := v1.NewJsonrpcClient(conn)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	ping, err := client.PostJsonrpc(ctx, &v1.PostJsonrpcRequest{
		Url: "system", Method: "ping", Jsonrpc: "2.0", Id: "transport-ping",
	})
	if err != nil {
		t.Fatal(err)
	}
	if ping.GetId() != "transport-ping" || ping.GetResult() == nil || ping.GetResult().GetCode() != errcode.OK.Code {
		t.Fatalf("unexpected ping reply: %v", ping)
	}
	if ping.GetResult().GetData().AsMap()["pong"] != "pong" {
		t.Fatalf("missing ping data: %v", ping)
	}

	version, err := client.GetJsonrpc(ctx, &v1.GetJsonrpcRequest{
		Url: "system", Method: "version", Jsonrpc: "2.0", Id: "transport-version",
	})
	if err != nil || version.GetResult() == nil || version.GetResult().GetCode() != errcode.OK.Code {
		t.Fatalf("public GET reply = %v, err = %v", version, err)
	}

	private, err := client.PostJsonrpc(ctx, &v1.PostJsonrpcRequest{
		Url: "user", Method: "list", Jsonrpc: "2.0", Id: "transport-private",
	})
	if err != nil || private.GetResult() == nil || private.GetResult().GetCode() != errcode.AuthRequired.Code {
		t.Fatalf("unauthenticated reply = %v, err = %v", private, err)
	}
}
