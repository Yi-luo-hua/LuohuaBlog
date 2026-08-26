package main

import (
	"bytes"
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestChatPostGlobalIPRateLimit(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		t.Setenv("DEEPSEEK_API_KEY", "")
		if _, err := upsertAIFixedAnswer(db, "hello", "fixed hello"); err != nil {
			t.Fatalf("insert fixed answer: %v", err)
		}
		prev := chatPostLimiter
		chatPostLimiter = newIPRateLimiter(1, time.Minute)
		t.Cleanup(func() { chatPostLimiter = prev })

		first := postChatRateLimitRequest("198.51.100.10:1001")
		if first.Code != http.StatusOK {
			t.Fatalf("expected first chat request 200, got %d body=%s", first.Code, first.Body.String())
		}

		second := postChatRateLimitRequest("198.51.100.10:1002")
		if second.Code != http.StatusTooManyRequests {
			t.Fatalf("expected second chat request 429, got %d body=%s", second.Code, second.Body.String())
		}
		payload := decodeOwnerJSONMap(t, second)
		if payload["error"] != "RATE_LIMITED" {
			t.Fatalf("expected global rate limit error, got %#v", payload["error"])
		}

		statusReq := httptest.NewRequest(http.MethodGet, "/api/chat", nil)
		statusReq.RemoteAddr = "198.51.100.10:1003"
		statusRR := httptest.NewRecorder()
		chatHandler(statusRR, statusReq)
		if statusRR.Code != http.StatusOK {
			t.Fatalf("chat GET status should not be blocked by POST limiter, got %d body=%s", statusRR.Code, statusRR.Body.String())
		}
	})
}

func TestAIImagePostGlobalIPRateLimit(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		t.Setenv("DASHSCOPE_API_KEY", "sk-test")
		userID := seedOwnerControllerUser(t, "artist@example.com", false)
		token := seedOwnerControllerSession(t, userID, true)
		prev := aiImagePostLimiter
		aiImagePostLimiter = newIPRateLimiter(1, time.Minute)
		t.Cleanup(func() { aiImagePostLimiter = prev })

		gen := &fakeAIImageGenerator{
			result: aiImageProviderResult{
				ImageURL:  "https://dashscope-result.example/temp.png",
				RequestID: "req-rl",
				Model:     "z-image-turbo",
				Size:      "1024*1024",
			},
		}
		uploader := &recordingAIImageUploader{
			result: ownerCOSUploadResult{
				ObjectKey: "ai-images/2026/06/rate-limit.png",
				URL:       "https://cdn.example/ai-images/2026/06/rate-limit.png",
				MIMEType:  "image/png",
				Size:      len(validTinyPNGBytes()),
			},
		}

		withAIImageGenerator(t, gen, func() {
			withAIImageDownloader(t, func(ctx context.Context, rawURL string) ([]byte, string, error) {
				return validTinyPNGBytes(), "image/png", nil
			}, func() {
				withOwnerAssetUploader(t, uploader, func() {
					first := postAIImageRateLimitRequest(token, "198.51.100.20:1001")
					if first.Code != http.StatusOK {
						t.Fatalf("expected first image request 200, got %d body=%s", first.Code, first.Body.String())
					}
					if gen.calls != 1 {
						t.Fatalf("expected provider to be called once, got %d", gen.calls)
					}

					second := postAIImageRateLimitRequest(token, "198.51.100.20:1002")
					if second.Code != http.StatusTooManyRequests {
						t.Fatalf("expected second image request 429, got %d body=%s", second.Code, second.Body.String())
					}
					payload := decodeOwnerJSONMap(t, second)
					if payload["error"] != "RATE_LIMITED" {
						t.Fatalf("expected global rate limit error, got %#v", payload["error"])
					}
					if gen.calls != 1 {
						t.Fatalf("global limiter should stop before provider call, got %d calls", gen.calls)
					}
				})
			})
		})
	})
}

func postChatRateLimitRequest(remoteAddr string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(
		http.MethodPost,
		"/api/chat",
		bytes.NewBufferString(`{"message":"hello"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = remoteAddr
	rr := httptest.NewRecorder()
	chatHandler(rr, req)
	return rr
}

func postAIImageRateLimitRequest(sessionToken, remoteAddr string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(
		http.MethodPost,
		"/api/ai/image",
		bytes.NewBufferString(`{"prompt":"rate limit cat","size":"1024*1024"}`),
	)
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = remoteAddr
	req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: sessionToken})
	rr := httptest.NewRecorder()
	aiImageHandler(rr, req)
	return rr
}
