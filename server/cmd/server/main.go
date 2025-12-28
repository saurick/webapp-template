// server/cmd/server/main.go
package main

import (
	"context"
	"flag"
	"fmt"
	"os"

	"server/internal/conf"
	"server/pkg/logger"
	"server/pkg/threading"

	"github.com/go-kratos/kratos/v2"
	"github.com/go-kratos/kratos/v2/config"
	"github.com/go-kratos/kratos/v2/config/file"
	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/transport/grpc"
	"github.com/go-kratos/kratos/v2/transport/http"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/sdk/resource"
	tracesdk "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.4.0"

	_ "go.uber.org/automaxprocs"
	"go.uber.org/automaxprocs/maxprocs"
)

// go build -ldflags "-X main.Version=x.y.z"
var (
	Name      string = "simulator-server"
	TraceName string = "simulator-server.service"
	Version   string

	flagconf string

	id, _ = os.Hostname()
)

func init() {
	// 自动设置 GOMAXPROCS，关闭它自带的日志
	_, _ = maxprocs.Set(maxprocs.Logger(nil))

	// 默认给空，真正用的时候再自动探测
	flag.StringVar(&flagconf, "conf", "", "config path, eg: -conf ./server/configs/dev or -conf ./server/configs/prod")
}

func newApp(logger log.Logger, gs *grpc.Server, hs *http.Server) *kratos.App {
	return kratos.New(
		kratos.ID(id),
		kratos.Name(Name),
		kratos.Version(Version),
		kratos.Metadata(map[string]string{}),
		kratos.Logger(logger),
		kratos.Server(
			gs,
			hs,
		),
	)
}

// 既兼容 kratos run（仓库根）又兼容 cd server/go run
func resolveConfPath(flagVal string) string {
	if flagVal != "" {
		return flagVal
	}

	// 返回的是 config.yaml，而不是目录
	candidates := []string{
		"./configs/dev/config.yaml",
		"./server/configs/dev/config.yaml",
		"../configs/dev/config.yaml",
		"../../configs/dev/config.yaml",
	}

	for _, p := range candidates {
		if fi, err := os.Stat(p); err == nil && !fi.IsDir() {
			return p
		}
	}

	return "./configs/dev/config.yaml"
}

// 初始化 TracerProvider：优先远端 OTLP（异步 Batch），失败或未配置就本地 no-op 风格
func initTracerProvider(traceName, traceEndpoint string, baseLogger log.Logger) *tracesdk.TracerProvider {
	helper := log.NewHelper(baseLogger)
	var tp *tracesdk.TracerProvider

	// 1) 有 endpoint → 尝试 OTLP HTTP exporter
	if traceEndpoint != "" {
		fmt.Println("init tp with endpoint", traceEndpoint)

		exp, err := otlptracehttp.New(
			context.Background(),
			otlptracehttp.WithEndpoint(traceEndpoint),
			otlptracehttp.WithInsecure(),
		)
		if err != nil {
			helper.Errorf("init otlp exporter failed: %v, fallback to local tracer", err)
		} else {
			tp = tracesdk.NewTracerProvider(
				tracesdk.WithBatcher(exp), // ✅ 异步批量导出，不阻塞请求
				tracesdk.WithResource(resource.NewSchemaless(
					semconv.ServiceNameKey.String(traceName),
				)),
			)
		}
	}

	// 2) 没配 endpoint 或 exporter 初始化失败 → 本地 TracerProvider（无 exporter，近似 no-op）
	if tp == nil {
		fmt.Println("init tp failed or endpoint empty, use local tracer")
		tp = tracesdk.NewTracerProvider(
			tracesdk.WithResource(resource.NewSchemaless(
				semconv.ServiceNameKey.String(traceName),
			)),
		)
	}

	otel.SetTracerProvider(tp) // 设置全局tp
	return tp
}

func main() {
	flag.Parse()

	confPath := resolveConfPath(flagconf)
	fmt.Println("using conf path:", confPath)

	// ===== 1. 加载配置文件 =====
	c := config.New(
		config.WithSource(
			file.NewSource(confPath),
		),
	)
	defer c.Close()

	if err := c.Load(); err != nil {
		panic(fmt.Errorf("load config failed: %w (conf=%s)", err, confPath))
	}

	var bc conf.Bootstrap
	if err := c.Scan(&bc); err != nil {
		panic(fmt.Errorf("scan bootstrap config failed: %w", err))
	}

	// ===== 2. 安全地读取 Log 配置 =====
	debug := false
	if bc.Log != nil {
		debug = bc.Log.Debug
	}

	logger := logger.NewDefaultLogger(id, Name, Version, debug)
	log.SetLogger(logger) // 设置全局日志

	// ===== 3. 安全地读取 Trace 配置（避免 nil pointer） =====
	traceName := TraceName
	traceEndpoint := ""

	if bc.Trace != nil && bc.Trace.Jaeger != nil {
		if bc.Trace.Jaeger.TraceName != "" {
			traceName = bc.Trace.Jaeger.TraceName
		}
		traceEndpoint = bc.Trace.Jaeger.Endpoint
	}

	// ===== 4. 初始化协程管理器 =====
	cleanupThreading := threading.Init()
	defer cleanupThreading()

	// ===== 5. 初始化 OpenTelemetry（带兜底，不会因为没连上 Jaeger 就阻塞） =====
	tp := initTracerProvider(traceName, traceEndpoint, logger)
	// 进程退出前 flush 一下（不阻塞请求，只在退出时）
	defer func() {
		_ = tp.ForceFlush(context.Background())
	}()

	// ===== 5.5 启动时打一个 span，方便在 Jaeger 里排查 =====
	{
		tr := otel.Tracer("bootstrap")
		ctx, span := tr.Start(context.Background(), "startup-span")
		span.SetAttributes(
			semconv.ServiceNameKey.String(traceName),
		)
		span.End()
		_ = ctx
	}

	// ===== 6. 严格检查 Server / Data 配置，缺了就直接报错 =====
	serverCfg := bc.Server
	if serverCfg == nil {
		panic(fmt.Errorf("bootstrap server config is nil, please check %s", confPath))
	}

	dataCfg := bc.Data
	if dataCfg == nil {
		panic(fmt.Errorf("bootstrap data config is nil, please check %s", confPath))
	}

	// ===== 7. 组装应用（wireApp） =====
	// 这里 wireApp 里用到的 TracerProvider 类型要记得是 *tracesdk.TracerProvider
	app, cleanup, err := wireApp(serverCfg, dataCfg, logger, tp)
	if err != nil {
		panic(fmt.Errorf("wireApp init failed: %w", err))
	}
	if app == nil {
		panic("wireApp returned nil app")
	}
	defer cleanup()

	// ===== 8. 启动应用 =====
	if err := app.Run(); err != nil {
		panic(fmt.Errorf("app run failed: %w", err))
	}
}
