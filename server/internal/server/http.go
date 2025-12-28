// server/internal/server/http.go
package server

import (
	stdhttp "net/http"
	"os"
	"path/filepath"

	httpx "github.com/go-kratos/kratos/v2/transport/http"

	v1 "server/api/jsonrpc/v1"
	"server/internal/conf"
	"server/internal/data"
	"server/internal/service"

	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/middleware/logging"
	"github.com/go-kratos/kratos/v2/middleware/ratelimit"
	"github.com/go-kratos/kratos/v2/middleware/recovery"
	"go.opentelemetry.io/otel/sdk/trace"
)

func NewHTTPServer(
	c *conf.Server,
	logger log.Logger,
	jsonrpcSvc *service.JsonrpcService,
	tp *trace.TracerProvider,
	data *data.Data,

	// ✅ 新增：Data 配置（用于 JWT secret）
	dc *conf.Data,
) *httpx.Server {
	var opts = []httpx.ServerOption{
		httpx.Middleware(
			recovery.Recovery(),
			// tracing.Server(tracing.WithTracerProvider(tp)),
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

	// ===== 探活接口 =====
	// /ping：最简单的活跃检测
	srv.Handle("/ping", stdhttp.HandlerFunc(
		func(w stdhttp.ResponseWriter, r *stdhttp.Request) {
			w.WriteHeader(stdhttp.StatusOK)
			_, _ = w.Write([]byte("pong"))
		},
	))

	// /healthz：简单健康检查
	srv.Handle("/healthz", stdhttp.HandlerFunc(
		func(w stdhttp.ResponseWriter, r *stdhttp.Request) {
			w.WriteHeader(stdhttp.StatusOK)
			_, _ = w.Write([]byte("ok"))
		}),
	)

	// /readyz：检查下游依赖是否就绪（MySQL 等）
	srv.Handle("/readyz", stdhttp.HandlerFunc(
		func(w stdhttp.ResponseWriter, r *stdhttp.Request) {
			ctx := r.Context()

			// 1. 检查 DB 连通性（MySQL)
			if data.SQLDB() != nil {
				if err := data.SQLDB().PingContext(ctx); err != nil {
					w.WriteHeader(stdhttp.StatusServiceUnavailable)
					_, _ = w.Write([]byte("mysql not ready"))
					return
				}
			}

			// 2. TODO: 其他下游检查

			// 3. 都正常
			w.WriteHeader(stdhttp.StatusOK)
			_, _ = w.Write([]byte("ready"))
		}),
	)

	// ===== 静态前端：Vite build 产物 =====
	// 优先用环境变量 STATIC_DIR，没有的话默认 /app/public（容器内）
	staticDir := os.Getenv("STATIC_DIR")
	if staticDir == "" {
		staticDir = "/app/public"
	}

	if fi, err := os.Stat(staticDir); err == nil && fi.IsDir() {
		log.Infof("http static dir enabled: %s", staticDir)

		// 基础静态文件服务
		fileServer := stdhttp.FileServer(stdhttp.Dir(staticDir))

		// 为了兼容 React Router BrowserRouter：
		// - 如果请求路径对应的文件存在 → 直接返回文件
		// - 否则 → 回退到 index.html，由前端路由接管
		srv.HandlePrefix("/", stdhttp.HandlerFunc(func(w stdhttp.ResponseWriter, r *stdhttp.Request) {
			// 先按静态文件尝试
			path := r.URL.Path
			if path == "" || path == "/" {
				// 根路径，直接交给 fileServer（会返回 index.html）
				fileServer.ServeHTTP(w, r)
				return
			}

			// 拼出磁盘路径
			fp := filepath.Join(staticDir, filepath.Clean(path))

			if fi, err := os.Stat(fp); err == nil && !fi.IsDir() {
				// 找到了对应文件，正常返回
				fileServer.ServeHTTP(w, r)
				return
			}

			// 否则，回退到 index.html（SPA 模式）
			indexPath := filepath.Join(staticDir, "index.html")
			if _, err := os.Stat(indexPath); err == nil {
				stdhttp.ServeFile(w, r, indexPath)
				return
			}

			// index.html 都没有，那就 404
			stdhttp.NotFound(w, r)
		}))
	} else {
		log.Infof("http static dir not found or not dir: %s, skip static handler", staticDir)
	}

	return srv
}
