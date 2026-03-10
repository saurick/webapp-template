// server/internal/server/http.go
package server

import (
	httpx "github.com/go-kratos/kratos/v2/transport/http"

	v1 "server/api/jsonrpc/v1"
	"server/internal/conf"
	"server/internal/data"
	"server/internal/service"

	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/middleware/logging"
	"github.com/go-kratos/kratos/v2/middleware/ratelimit"
	"github.com/go-kratos/kratos/v2/middleware/recovery"
	"github.com/go-kratos/kratos/v2/middleware/tracing"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

func NewHTTPServer(
	c *conf.Server,
	logger log.Logger,
	jsonrpcSvc *service.JsonrpcService,
	tp *sdktrace.TracerProvider,
	data *data.Data,

	// ✅ 新增：Data 配置（用于 JWT secret）
	dc *conf.Data,
) *httpx.Server {
	var opts = []httpx.ServerOption{
		httpx.Filter(RequestIDFilter()),
		httpx.Middleware(
			recovery.Recovery(),
			tracing.Server(tracing.WithTracerProvider(tp)),
			logging.Server(log.With(logger, "logger.name", "server.http")),
			// 默认 bbr limiter
			ratelimit.Server(),
			// ✅ 加上这个middleware，用于从请求头中获取 JWT token，并解析成 AuthClaims，然后存储到 context 中
			AuthClaimsMiddleware(dc, logger),
		),
	}

	if c.Http != nil {
		if c.Http.Network != "" {
			opts = append(opts, httpx.Network(c.Http.Network))
		}
		if c.Http.Addr != "" {
			opts = append(opts, httpx.Address(c.Http.Addr))
		}
		if c.Http.Timeout != nil {
			opts = append(opts, httpx.Timeout(c.Http.Timeout.AsDuration()))
		}
	}

	opts = append(opts, httpx.Logger(logger))

	srv := httpx.NewServer(opts...)

	// ===== JSON-RPC HTTP 路由 =====
	// 这里用的是 protoc --go-http_out 生成的注册函数
	v1.RegisterJsonrpcHTTPServer(srv, jsonrpcSvc)

	registerHealthRoutes(srv, logger, tp, data.SQLDB())
	registerStaticHandler(srv, logger, tp)

	return srv
}
