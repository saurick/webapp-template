package logger

import (
	"context"
	"os"

	"github.com/go-kratos/kratos/v2/log"
	"github.com/go-kratos/kratos/v2/middleware/tracing"
)

type TaskIDKey struct{}
type RequestIDKey struct{}

func NewDefaultLogger(id, name, version string, debug bool) log.Logger {
	return log.With(NewStdColorLogger(os.Stdout, true, debug),
		"ts", log.DefaultTimestamp,
		"caller", log.DefaultCaller,
		"service.id", id,
		"service.name", name,
		"service.version", version,
		"request_id", RequestID(),
		"trace.id", tracing.TraceID(),
		"span.id", tracing.SpanID(),
		"task.id", TaskID(),
	)
}

// 用于测试的logger
func NewDefaultLoggerForTest() log.Logger {
	return NewDefaultLogger("test-id", "test", "test-version", true)
}

// 自动输出任务ID
func TaskID() log.Valuer {
	return func(ctx context.Context) interface{} {
		v, ok := ctx.Value(TaskIDKey{}).(int64)
		if !ok {
			return ""
		}
		return v
	}
}

func WithTaskID(ctx context.Context, taskId int64) context.Context {
	return context.WithValue(ctx, TaskIDKey{}, taskId)
}

func RequestID() log.Valuer {
	return func(ctx context.Context) interface{} {
		v, ok := ctx.Value(RequestIDKey{}).(string)
		if !ok {
			return ""
		}
		return v
	}
}

func RequestIDFromContext(ctx context.Context) string {
	v, ok := ctx.Value(RequestIDKey{}).(string)
	if !ok {
		return ""
	}
	return v
}

func WithRequestID(ctx context.Context, requestID string) context.Context {
	return context.WithValue(ctx, RequestIDKey{}, requestID)
}
