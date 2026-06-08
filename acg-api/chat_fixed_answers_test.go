package main

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestChatUsesFixedAnswerWithoutDeepSeek(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		t.Setenv("DEEPSEEK_API_KEY", "")
		if _, err := upsertAIFixedAnswer(
			db,
			"How do friend links work?",
			"Use the friends page application flow.",
		); err != nil {
			t.Fatalf("insert ai fixed answer: %v", err)
		}

		req := httptest.NewRequest(
			http.MethodPost,
			"/api/chat",
			bytes.NewBufferString(`{"message":"How do friend links work?"}`),
		)
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()

		chatHandler(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
		}
		payload := decodeOwnerJSONMap(t, rr)
		if payload["reply"] != "Use the friends page application flow." {
			t.Fatalf("expected fixed answer reply, got %#v", payload["reply"])
		}
		if payload["fixedAnswer"] != true {
			t.Fatalf("expected fixedAnswer flag, got %#v", payload["fixedAnswer"])
		}
		if got := int(payload["used"].(float64)); got != 0 {
			t.Fatalf("expected fixed answer to avoid quota usage, got used=%d", got)
		}
	})
}
