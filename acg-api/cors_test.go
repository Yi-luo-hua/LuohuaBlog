package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCORSAllowsConfiguredOriginWithCredentials(t *testing.T) {
	t.Setenv("ACG_ALLOWED_ORIGINS", "https://taozhiyy.top,http://localhost:5173")

	req := httptest.NewRequest(http.MethodOptions, "/api/guestbook/messages", nil)
	req.Header.Set("Origin", "https://taozhiyy.top")
	req.Header.Set("Access-Control-Request-Method", http.MethodPost)
	rr := httptest.NewRecorder()

	withCORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("preflight should not call next handler")
	})).ServeHTTP(rr, req)

	if rr.Code != http.StatusNoContent {
		t.Fatalf("expected 204 preflight, got %d", rr.Code)
	}
	if got := rr.Header().Get("Access-Control-Allow-Origin"); got != "https://taozhiyy.top" {
		t.Fatalf("expected allowed origin to be echoed, got %q", got)
	}
	if got := rr.Header().Get("Access-Control-Allow-Credentials"); got != "true" {
		t.Fatalf("expected credentials to stay enabled for allowed origin, got %q", got)
	}
	allowHeaders := rr.Header().Get("Access-Control-Allow-Headers")
	for _, header := range []string{"Authorization", "X-Sync-Trigger-Token"} {
		if !strings.Contains(allowHeaders, header) {
			t.Fatalf("expected CORS allow headers to include %s, got %q", header, allowHeaders)
		}
	}
}

func TestCORSDoesNotUseWildcardWithCredentials(t *testing.T) {
	t.Setenv("ACG_ALLOWED_ORIGINS", "https://taozhiyy.top")

	req := httptest.NewRequest(http.MethodGet, "/api/guestbook/messages", nil)
	req.Header.Set("Origin", "https://evil.example")
	rr := httptest.NewRecorder()

	withCORS(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})).ServeHTTP(rr, req)

	if got := rr.Header().Get("Access-Control-Allow-Origin"); got == "*" {
		t.Fatalf("must not return wildcard origin when credentials can be used")
	}
	if got := rr.Header().Get("Access-Control-Allow-Credentials"); got != "" {
		t.Fatalf("must not return credentials header for disallowed origin, got %q", got)
	}
}
