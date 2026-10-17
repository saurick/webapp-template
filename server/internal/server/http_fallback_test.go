package server

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"server/internal/conf"
	"server/internal/data"

	"github.com/go-kratos/kratos/v2/log"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
)

func TestHTTPServerDoesNotExposeGlobalMux(t *testing.T) {
	previous := http.DefaultServeMux
	http.DefaultServeMux = http.NewServeMux()
	t.Cleanup(func() { http.DefaultServeMux = previous })
	globalCalls := 0
	for _, route := range []string{"/debug/pprof/", "/rpc/system"} {
		http.DefaultServeMux.HandleFunc(route, func(w http.ResponseWriter, _ *http.Request) {
			globalCalls++
			_, _ = io.WriteString(w, "global diagnostic handler")
		})
	}
	t.Setenv("STATIC_DIR", filepath.Join(t.TempDir(), "missing"))
	logger := log.NewStdLogger(io.Discard)
	srv := NewHTTPServer(&conf.Server{}, logger, newTransportJSONRPCService(logger), sdktrace.NewTracerProvider(), &data.Data{}, &conf.Data{})

	for _, tc := range []struct {
		method string
		path   string
		status int
	}{
		{http.MethodGet, "/debug/pprof/", http.StatusNotFound},
		{http.MethodHead, "/debug/pprof/", http.StatusNotFound},
		{http.MethodGet, "/debug/%70prof/", http.StatusNotFound},
		{http.MethodPut, "/rpc/system", http.StatusMethodNotAllowed},
		{http.MethodDelete, "/rpc/system", http.StatusMethodNotAllowed},
	} {
		recorder := httptest.NewRecorder()
		srv.Handler.ServeHTTP(recorder, httptest.NewRequest(tc.method, tc.path, nil))
		if recorder.Code != tc.status {
			t.Errorf("%s %s status=%d, want %d", tc.method, tc.path, recorder.Code, tc.status)
		}
		if strings.Contains(recorder.Body.String(), "global diagnostic handler") {
			t.Errorf("%s %s reached the global mux", tc.method, tc.path)
		}
	}
	if globalCalls != 0 {
		t.Errorf("global mux invoked %d times", globalCalls)
	}
	for _, target := range []string{"/healthz", "/rpc/system?method=ping&jsonrpc=2.0&id=control"} {
		recorder := httptest.NewRecorder()
		srv.Handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, target, nil))
		if recorder.Code != http.StatusOK {
			t.Errorf("normal request %s status=%d, want 200", target, recorder.Code)
		}
	}
}

func TestHTTPServerKeepsSPAFallback(t *testing.T) {
	directory := t.TempDir()
	if err := os.WriteFile(filepath.Join(directory, "index.html"), []byte("template application"), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("STATIC_DIR", directory)
	logger := log.NewStdLogger(io.Discard)
	srv := NewHTTPServer(&conf.Server{}, logger, newTransportJSONRPCService(logger), sdktrace.NewTracerProvider(), &data.Data{}, &conf.Data{})
	recorder := httptest.NewRecorder()
	srv.Handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/admin-menu", nil))
	if recorder.Code != http.StatusOK || recorder.Body.String() != "template application" {
		t.Fatalf("SPA fallback status=%d body=%q", recorder.Code, recorder.Body.String())
	}
}
