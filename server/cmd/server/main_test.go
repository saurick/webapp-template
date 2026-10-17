package main

import (
	"context"
	"math"
	"testing"

	"server/internal/conf"

	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	oteltrace "go.opentelemetry.io/otel/trace"
)

func TestReplaceAddressPort(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		address string
		port    string
		want    string
		wantErr bool
	}{
		{name: "ipv4", address: "0.0.0.0:8200", port: "8500", want: "0.0.0.0:8500"},
		{name: "ipv6", address: "[::]:9200", port: "9500", want: "[::]:9500"},
		{name: "empty override", address: "127.0.0.1:8200", want: "127.0.0.1:8200"},
		{name: "invalid port", address: "127.0.0.1:8200", port: "80", wantErr: true},
		{name: "invalid address", address: "8200", port: "8500", wantErr: true},
	}
	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got, err := replaceAddressPort(tc.address, tc.port)
			if (err != nil) != tc.wantErr {
				t.Fatalf("replaceAddressPort() error = %v, wantErr %v", err, tc.wantErr)
			}
			if got != tc.want {
				t.Fatalf("replaceAddressPort() = %q, want %q", got, tc.want)
			}
		})
	}
}

func TestOverrideDevServerPortsFromEnv(t *testing.T) {
	t.Setenv("DEV_HTTP_PORT", "8500")
	t.Setenv("DEV_GRPC_PORT", "9500")
	serverCfg := &conf.Server{
		Http: &conf.Server_HTTP{Addr: "0.0.0.0:8200"},
		Grpc: &conf.Server_GRPC{Addr: "0.0.0.0:9200"},
	}

	if err := overrideDevServerPortsFromEnv("./configs/dev/config.yaml", serverCfg); err != nil {
		t.Fatalf("overrideDevServerPortsFromEnv() error = %v", err)
	}
	if serverCfg.Http.Addr != "0.0.0.0:8500" || serverCfg.Grpc.Addr != "0.0.0.0:9500" {
		t.Fatalf("unexpected overridden addresses: http=%q grpc=%q", serverCfg.Http.Addr, serverCfg.Grpc.Addr)
	}
}

func TestOverrideDevServerPortsFromEnvIgnoresProductionConfig(t *testing.T) {
	t.Setenv("DEV_HTTP_PORT", "8500")
	t.Setenv("DEV_GRPC_PORT", "9500")
	serverCfg := &conf.Server{
		Http: &conf.Server_HTTP{Addr: "0.0.0.0:8200"},
		Grpc: &conf.Server_GRPC{Addr: "0.0.0.0:9200"},
	}

	if err := overrideDevServerPortsFromEnv("./configs/prod/config.yaml", serverCfg); err != nil {
		t.Fatalf("overrideDevServerPortsFromEnv() error = %v", err)
	}
	if serverCfg.Http.Addr != "0.0.0.0:8200" || serverCfg.Grpc.Addr != "0.0.0.0:9200" {
		t.Fatalf("production addresses changed: http=%q grpc=%q", serverCfg.Http.Addr, serverCfg.Grpc.Addr)
	}
}

func TestNormalizeTraceRatio(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name  string
		input float64
		want  float64
	}{
		{name: "nan falls back to zero", input: math.NaN(), want: 0},
		{name: "negative clamps to zero", input: -0.5, want: 0},
		{name: "zero keeps zero", input: 0, want: 0},
		{name: "fraction keeps ratio", input: 0.25, want: 0.25},
		{name: "one keeps one", input: 1, want: 1},
		{name: "above one clamps to one", input: 3, want: 1},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := normalizeTraceRatio(tc.input); got != tc.want {
				t.Fatalf("normalizeTraceRatio(%v) = %v, want %v", tc.input, got, tc.want)
			}
		})
	}
}

func TestBuildTraceSamplerHonorsParentDecision(t *testing.T) {
	t.Parallel()

	traceID := oteltrace.TraceID{1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1}
	sampledParent := oteltrace.NewSpanContext(oteltrace.SpanContextConfig{
		TraceID:    traceID,
		SpanID:     oteltrace.SpanID{2, 2, 2, 2, 2, 2, 2, 2},
		TraceFlags: oteltrace.FlagsSampled,
		Remote:     true,
	})
	unsampledParent := oteltrace.NewSpanContext(oteltrace.SpanContextConfig{
		TraceID: traceID,
		SpanID:  oteltrace.SpanID{3, 3, 3, 3, 3, 3, 3, 3},
		Remote:  true,
	})

	cases := []struct {
		name   string
		ratio  float64
		parent oteltrace.SpanContext
		want   sdktrace.SamplingDecision
	}{
		{
			name:   "zero ratio drops root spans",
			ratio:  0,
			parent: oteltrace.SpanContext{},
			want:   sdktrace.Drop,
		},
		{
			name:   "full ratio samples root spans",
			ratio:  1,
			parent: oteltrace.SpanContext{},
			want:   sdktrace.RecordAndSample,
		},
		{
			name:   "sampled parent still wins when local ratio is zero",
			ratio:  0,
			parent: sampledParent,
			want:   sdktrace.RecordAndSample,
		},
		{
			name:   "unsampled parent stays unsampled",
			ratio:  1,
			parent: unsampledParent,
			want:   sdktrace.Drop,
		},
	}

	for _, tc := range cases {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			ctx := context.Background()
			if tc.parent.IsValid() {
				ctx = oteltrace.ContextWithSpanContext(ctx, tc.parent)
			}
			got := buildTraceSampler(tc.ratio).ShouldSample(sdktrace.SamplingParameters{
				ParentContext: ctx,
				TraceID:       traceID,
				Name:          "test-operation",
				Kind:          oteltrace.SpanKindServer,
			}).Decision
			if got != tc.want {
				t.Fatalf("buildTraceSampler(%v) decision = %v, want %v", tc.ratio, got, tc.want)
			}
		})
	}
}
