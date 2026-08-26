package main

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func postOwnerGate(t *testing.T, body string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/owner/gate", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = "203.0.113.77:1234"
	rr := httptest.NewRecorder()
	ownerGateHandler(rr, req)
	return rr
}

func gateCookie(t *testing.T, rr *httptest.ResponseRecorder) *http.Cookie {
	t.Helper()
	for _, c := range rr.Result().Cookies() {
		if c.Name == sessionCookieName {
			return c
		}
	}
	t.Fatalf("no session cookie in response: %s", rr.Body.String())
	return nil
}

func TestOwnerGateRightPasswordOpensTheConsole(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		t.Setenv("OWNER_GATE_PASSWORD", "correct-horse-battery")

		rr := postOwnerGate(t, `{"password":"correct-horse-battery"}`)
		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
		}
		cookie := gateCookie(t, rr)
		if !cookie.HttpOnly {
			t.Fatal("the session cookie must stay out of reach of page scripts")
		}

		req := httptest.NewRequest(http.MethodGet, "/api/owner/status", nil)
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: cookie.Value})
		statusRR := httptest.NewRecorder()
		ownerRouter(statusRR, req)
		if statusRR.Code != http.StatusOK {
			t.Fatalf("the cookie from the gate should open owner endpoints, got %d body=%s", statusRR.Code, statusRR.Body.String())
		}
	})
}

func TestOwnerGateWrongPasswordIssuesNoSession(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		t.Setenv("OWNER_GATE_PASSWORD", "correct-horse-battery")

		rr := postOwnerGate(t, `{"password":"nope"}`)
		if rr.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d body=%s", rr.Code, rr.Body.String())
		}
		for _, c := range rr.Result().Cookies() {
			if c.Name == sessionCookieName && c.Value != "" {
				t.Fatal("a failed attempt must not hand out a session")
			}
		}
		var sessions int
		if err := db.QueryRow(`SELECT COUNT(*) FROM sessions`).Scan(&sessions); err != nil {
			t.Fatalf("count sessions: %v", err)
		}
		if sessions != 0 {
			t.Fatalf("expected no stored session, got %d", sessions)
		}
	})
}

func TestOwnerGateStaysShutWhenNoPasswordIsConfigured(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		t.Setenv("OWNER_GATE_PASSWORD", "")
		t.Setenv("AUTH_OWNER_PASSWORD", "")

		// An empty submission must not match an empty configuration.
		rr := postOwnerGate(t, `{"password":""}`)
		if rr.Code != http.StatusServiceUnavailable {
			t.Fatalf("expected 503 while the gate is unconfigured, got %d body=%s", rr.Code, rr.Body.String())
		}
	})
}

func TestOwnerGateRejectsAShortConfiguredPassword(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		t.Setenv("OWNER_GATE_PASSWORD", "12345")

		rr := postOwnerGate(t, `{"password":"12345"}`)
		if rr.Code != http.StatusServiceUnavailable {
			t.Fatalf("expected 503 for a too-short gate password, got %d body=%s", rr.Code, rr.Body.String())
		}
		if want := `"error":"GATE_PASSWORD_TOO_SHORT"`; !strings.Contains(rr.Body.String(), want) {
			t.Fatalf("expected GATE_PASSWORD_TOO_SHORT, got body=%s", rr.Body.String())
		}
	})
}

func TestOwnerGateLockClearsTheSession(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		t.Setenv("OWNER_GATE_PASSWORD", "correct-horse-battery")
		cookie := gateCookie(t, postOwnerGate(t, `{"password":"correct-horse-battery"}`))

		req := httptest.NewRequest(http.MethodDelete, "/api/owner/gate", nil)
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: cookie.Value})
		rr := httptest.NewRecorder()
		ownerGateHandler(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
		}

		statusReq := httptest.NewRequest(http.MethodGet, "/api/owner/status", nil)
		statusReq.AddCookie(&http.Cookie{Name: sessionCookieName, Value: cookie.Value})
		statusRR := httptest.NewRecorder()
		ownerRouter(statusRR, statusReq)
		if statusRR.Code != http.StatusUnauthorized {
			t.Fatalf("expected the locked console to answer 401, got %d", statusRR.Code)
		}
	})
}

func TestOwnerGateRateLimitsGuessing(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		t.Setenv("OWNER_GATE_PASSWORD", "correct-horse-battery")
		prev := ownerGateLimiter
		ownerGateLimiter = newIPRateLimiter(3, time.Minute)
		t.Cleanup(func() { ownerGateLimiter = prev })

		for i := 0; i < 3; i++ {
			if code := postOwnerGate(t, `{"password":"nope"}`).Code; code != http.StatusUnauthorized {
				t.Fatalf("attempt %d: expected 401, got %d", i+1, code)
			}
		}
		if code := postOwnerGate(t, `{"password":"nope"}`).Code; code != http.StatusTooManyRequests {
			t.Fatalf("expected the fourth attempt to be rate limited, got %d", code)
		}
	})
}

func TestOwnerGateAcceptsASixCharacterPassword(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		t.Setenv("OWNER_GATE_PASSWORD", "815502")

		rr := postOwnerGate(t, `{"password":"815502"}`)
		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 for a six-character password, got %d body=%s", rr.Code, rr.Body.String())
		}
		if cookie := gateCookie(t, rr); cookie.Value == "" {
			t.Fatal("expected a session cookie")
		}
	})
}
