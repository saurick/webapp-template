package main

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/go-kratos/kratos/v2/log"
	"go.opentelemetry.io/otel"
	collectortrace "go.opentelemetry.io/proto/otlp/collector/trace/v1"
	"google.golang.org/protobuf/proto"
)

func TestTracerProviderOTLPExportAndFailure(t *testing.T) {
	for _, status := range []int{http.StatusOK, http.StatusBadRequest} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			for _, suffix := range []string{"ENDPOINT", "HEADERS", "COMPRESSION"} {
				t.Setenv("OTEL_EXPORTER_OTLP_"+suffix, "")
				t.Setenv("OTEL_EXPORTER_OTLP_TRACES_"+suffix, "")
			}
			requests := make(chan *collectortrace.ExportTraceServiceRequest, 1)
			collector := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method != http.MethodPost || r.URL.Path != "/v1/traces" {
					http.NotFound(w, r)
					return
				}
				body, err := io.ReadAll(io.LimitReader(r.Body, 1024*1024))
				if err != nil {
					t.Errorf("read export: %v", err)
					w.WriteHeader(http.StatusBadRequest)
					return
				}
				request := &collectortrace.ExportTraceServiceRequest{}
				if err := proto.Unmarshal(body, request); err != nil {
					t.Errorf("decode export: %v", err)
					w.WriteHeader(http.StatusBadRequest)
					return
				}
				requests <- request
				w.Header().Set("Content-Type", "application/x-protobuf")
				w.WriteHeader(status)
			}))
			defer collector.Close()
			previous := otel.GetTracerProvider()
			defer otel.SetTracerProvider(previous)
			var logs bytes.Buffer
			endpoint := strings.TrimPrefix(collector.URL, "http://")
			tp := initTracerProvider("template-transport", endpoint, 1, log.NewStdLogger(&logs))
			defer func() { _ = tp.Shutdown(context.Background()) }()
			_, span := tp.Tracer("transport-test").Start(context.Background(), "template-ping")
			span.End()
			ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
			defer cancel()
			err := tp.ForceFlush(ctx)
			if status == http.StatusOK && err != nil {
				t.Fatalf("successful collector rejected: %v", err)
			}
			if status != http.StatusOK && err == nil {
				t.Fatal("collector failure was hidden by ForceFlush")
			}
			if strings.Contains(logs.String(), endpoint) || strings.Contains(logs.String(), "trace_endpoint") {
				t.Fatal("tracer initialization logged collector configuration")
			}
			select {
			case request := <-requests:
				resources := request.GetResourceSpans()
				if len(resources) != 1 || len(resources[0].GetScopeSpans()) != 1 || len(resources[0].GetScopeSpans()[0].GetSpans()) != 1 {
					t.Fatalf("unexpected exported batch: %v", request)
				}
				exported := resources[0].GetScopeSpans()[0].GetSpans()[0]
				if exported.GetName() != "template-ping" || len(exported.GetTraceId()) != 16 || len(exported.GetSpanId()) != 8 {
					t.Fatalf("unexpected exported span: %v", exported)
				}
			case <-ctx.Done():
				t.Fatal("collector did not receive the span")
			}
		})
	}
}
