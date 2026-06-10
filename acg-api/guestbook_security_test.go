package main

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func guestbookMessageCount(t *testing.T) int {
	t.Helper()
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM guestbook_messages`).Scan(&count); err != nil {
		t.Fatalf("count guestbook_messages: %v", err)
	}
	return count
}

func legacyGuestbookCount(t *testing.T) int {
	t.Helper()
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM guestbook`).Scan(&count); err != nil {
		t.Fatalf("count guestbook: %v", err)
	}
	return count
}

func TestGuestbookCreateRejectsUnsafePayloads(t *testing.T) {
	cases := []struct {
		name string
		body string
	}{
		{
			name: "script tag in content",
			body: `{"nickname":"Probe","content":"<script>alert(1)</script>","channel":"guestbook"}`,
		},
		{
			name: "event handler tag in content",
			body: `{"nickname":"Probe","content":"<img src=x onerror=alert(1)>","channel":"guestbook"}`,
		},
		{
			name: "javascript url in content",
			body: `{"nickname":"Probe","content":"javascript:alert(document.cookie)","channel":"guestbook"}`,
		},
		{
			name: "fullscreen div overlay in content",
			body: `{"nickname":"Probe","content":"<div style=\"position:fixed;inset:0;z-index:999999\">owned</div>","channel":"guestbook"}`,
		},
		{
			name: "style tag in content",
			body: `{"nickname":"Probe","content":"<style>body{display:none}</style>","channel":"guestbook"}`,
		},
		{
			name: "svg event handler in nickname",
			body: `{"nickname":"<svg/onload=alert(1)>","content":"hello","channel":"guestbook"}`,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			withGuestbookTestDB(t, func() {
				rr := postGuestbookMessageWithSession(t, tc.body, "127.0.0.1:3456", "")

				if rr.Code != http.StatusBadRequest {
					t.Fatalf("expected 400 for unsafe payload, got %d body=%s", rr.Code, rr.Body.String())
				}
				payload := decodeJSONMap(t, rr)
				if payload["error"] != "UNSAFE_CONTENT" {
					t.Fatalf("expected UNSAFE_CONTENT, got %#v", payload["error"])
				}
				if count := guestbookMessageCount(t); count != 0 {
					t.Fatalf("unsafe payload should not be stored, found %d rows", count)
				}
			})
		})
	}
}

func TestLegacyGuestbookRejectsUnsafePayloads(t *testing.T) {
	cases := []struct {
		name string
		body string
	}{
		{
			name: "script tag in content",
			body: `{"name":"Probe","content":"<script>alert(1)</script>"}`,
		},
		{
			name: "event handler tag in content",
			body: `{"name":"Probe","content":"<img src=x onerror=alert(1)>"}`,
		},
		{
			name: "javascript url in content",
			body: `{"name":"Probe","content":"javascript:alert(document.cookie)"}`,
		},
		{
			name: "fullscreen div overlay in content",
			body: `{"name":"Probe","content":"<div style=\"position:fixed;inset:0;z-index:999999\">owned</div>"}`,
		},
		{
			name: "style tag in content",
			body: `{"name":"Probe","content":"<style>body{display:none}</style>"}`,
		},
		{
			name: "svg event handler in name",
			body: `{"name":"<svg/onload=alert(1)>","content":"hello"}`,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			withGuestbookTestDB(t, func() {
				req := httptest.NewRequest(http.MethodPost, "/api/v1/guestbook", bytes.NewBufferString(tc.body))
				req.Header.Set("Content-Type", "application/json")
				rr := httptest.NewRecorder()

				guestbookHandler(rr, req)

				if rr.Code != http.StatusBadRequest {
					t.Fatalf("expected 400 for unsafe legacy payload, got %d body=%s", rr.Code, rr.Body.String())
				}
				if count := legacyGuestbookCount(t); count != 0 {
					t.Fatalf("unsafe legacy payload should not be stored, found %d rows", count)
				}
			})
		})
	}
}

func TestGuestbookCreateRejectsUnsafeLoggedInNickname(t *testing.T) {
	withGuestbookTestDB(t, func() {
		userID := seedGuestbookTestUser(t, "login@example.com", "<img src=x>", false)
		sessionToken := seedGuestbookTestSession(t, userID, false)

		rr := postGuestbookMessageWithSession(
			t,
			`{"content":"hello from account","channel":"guestbook"}`,
			"127.0.0.1:3456",
			sessionToken,
		)

		if rr.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for unsafe logged-in nickname, got %d body=%s", rr.Code, rr.Body.String())
		}
		payload := decodeJSONMap(t, rr)
		if payload["error"] != "UNSAFE_CONTENT" {
			t.Fatalf("expected UNSAFE_CONTENT, got %#v", payload["error"])
		}
		if count := guestbookMessageCount(t); count != 0 {
			t.Fatalf("unsafe logged-in nickname should not be stored, found %d rows", count)
		}
	})
}
