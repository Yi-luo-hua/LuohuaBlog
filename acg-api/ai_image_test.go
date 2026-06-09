package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

type fakeAIImageGenerator struct {
	result aiImageProviderResult
	err    error
	calls  int
	prompt string
	size   string
}

func (f *fakeAIImageGenerator) Generate(ctx context.Context, prompt, size string) (aiImageProviderResult, error) {
	f.calls++
	f.prompt = prompt
	f.size = size
	if f.err != nil {
		return aiImageProviderResult{}, f.err
	}
	return f.result, nil
}

type recordingAIImageUploader struct {
	result   ownerCOSUploadResult
	err      error
	kind     string
	album    string
	filename string
	mimeType string
	body     []byte
}

func (r *recordingAIImageUploader) UploadImage(kind, album, filename, mimeType string, body []byte) (ownerCOSUploadResult, error) {
	r.kind = kind
	r.album = album
	r.filename = filename
	r.mimeType = mimeType
	r.body = append([]byte(nil), body...)
	if r.err != nil {
		return ownerCOSUploadResult{}, r.err
	}
	return r.result, nil
}

func withAIImageGenerator(t *testing.T, gen aiImageGenerator, fn func()) {
	t.Helper()
	prev := aiImageGeneratorFactory
	aiImageGeneratorFactory = func() (aiImageGenerator, error) { return gen, nil }
	t.Cleanup(func() { aiImageGeneratorFactory = prev })
	fn()
}

func withAIImageDownloader(t *testing.T, downloader aiImageDownloader, fn func()) {
	t.Helper()
	prev := aiImageDownloadURL
	aiImageDownloadURL = downloader
	t.Cleanup(func() { aiImageDownloadURL = prev })
	fn()
}

func TestAIImageStatusForAnonymous(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		t.Setenv("DASHSCOPE_API_KEY", "sk-test")
		req := httptest.NewRequest(http.MethodGet, "/api/ai/image", nil)
		rr := httptest.NewRecorder()

		aiImageHandler(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
		}
		payload := decodeOwnerJSONMap(t, rr)
		if payload["isLogin"] != false {
			t.Fatalf("expected anonymous status, got %#v", payload["isLogin"])
		}
		if payload["canGenerate"] != false {
			t.Fatalf("anonymous users should not be allowed to generate, got %#v", payload["canGenerate"])
		}
		if got := int(payload["limit"].(float64)); got != 0 {
			t.Fatalf("expected limit 0 for anonymous users, got %d", got)
		}
	})
}

func TestAIImageGenerateRejectsAnonymous(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		t.Setenv("DASHSCOPE_API_KEY", "sk-test")
		req := httptest.NewRequest(
			http.MethodPost,
			"/api/ai/image",
			bytes.NewBufferString(`{"prompt":"一只坐在月亮上的猫"}`),
		)
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()

		aiImageHandler(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d body=%s", rr.Code, rr.Body.String())
		}
	})
}

func TestAIImageGenerateUploadsCOSForLoggedInUser(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		t.Setenv("DASHSCOPE_API_KEY", "sk-test")
		userID := seedOwnerControllerUser(t, "artist@example.com", false)
		token := seedOwnerControllerSession(t, userID, false)
		gen := &fakeAIImageGenerator{
			result: aiImageProviderResult{
				ImageURL:  "https://dashscope-result.example/temp.png",
				RequestID: "req-123",
				Model:     "z-image-turbo",
				Size:      "1024*1024",
				Width:     1024,
				Height:    1024,
			},
		}
		uploader := &recordingAIImageUploader{
			result: ownerCOSUploadResult{
				ObjectKey: "ai-images/2026/06/demo.png",
				URL:       "https://cdn.example/ai-images/2026/06/demo.png",
				MIMEType:  "image/png",
				Size:      len(validTinyPNGBytes()),
			},
		}

		withAIImageGenerator(t, gen, func() {
			withAIImageDownloader(t, func(ctx context.Context, rawURL string) ([]byte, string, error) {
				if rawURL != "https://dashscope-result.example/temp.png" {
					t.Fatalf("unexpected download url %q", rawURL)
				}
				return validTinyPNGBytes(), "image/png", nil
			}, func() {
				withOwnerAssetUploader(t, uploader, func() {
					req := httptest.NewRequest(
						http.MethodPost,
						"/api/ai/image",
						bytes.NewBufferString(`{"prompt":"一只坐在月亮上的猫","size":"1024*1024"}`),
					)
					req.Header.Set("Content-Type", "application/json")
					req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
					rr := httptest.NewRecorder()

					aiImageHandler(rr, req)

					if rr.Code != http.StatusOK {
						t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
					}
					payload := decodeOwnerJSONMap(t, rr)
					image := payload["image"].(map[string]any)
					if image["url"] != "https://cdn.example/ai-images/2026/06/demo.png" {
						t.Fatalf("unexpected image url %#v", image["url"])
					}
					if payload["model"] != "z-image-turbo" {
						t.Fatalf("unexpected model %#v", payload["model"])
					}
					if payload["promptExtend"] != false {
						t.Fatalf("prompt extension must stay disabled, got %#v", payload["promptExtend"])
					}
					if got := int(payload["remaining"].(float64)); got != 2 {
						t.Fatalf("expected remaining 2, got %d", got)
					}
					if gen.calls != 1 || gen.prompt != "一只坐在月亮上的猫" || gen.size != "1024*1024" {
						t.Fatalf("unexpected generator call: calls=%d prompt=%q size=%q", gen.calls, gen.prompt, gen.size)
					}
					if uploader.kind != "ai-image" || uploader.mimeType != "image/png" || !bytes.Equal(uploader.body, validTinyPNGBytes()) {
						t.Fatalf("unexpected uploader call kind=%q mime=%q body=%d", uploader.kind, uploader.mimeType, len(uploader.body))
					}

					var count int
					if err := db.QueryRow(`SELECT COUNT(*) FROM ai_image_generations WHERE user_id = ? AND image_url = ?`, userID, image["url"]).Scan(&count); err != nil {
						t.Fatalf("query ai image generations: %v", err)
					}
					if count != 1 {
						t.Fatalf("expected generation record, got %d", count)
					}
				})
			})
		})
	})
}

func TestAIImageGenerateRequiresConfiguredProvider(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		t.Setenv("DASHSCOPE_API_KEY", "")
		userID := seedOwnerControllerUser(t, "artist@example.com", false)
		token := seedOwnerControllerSession(t, userID, false)
		req := httptest.NewRequest(
			http.MethodPost,
			"/api/ai/image",
			bytes.NewBufferString(`{"prompt":"一只坐在月亮上的猫"}`),
		)
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
		rr := httptest.NewRecorder()

		aiImageHandler(rr, req)

		if rr.Code != http.StatusServiceUnavailable {
			t.Fatalf("expected 503, got %d body=%s", rr.Code, rr.Body.String())
		}
		payload := decodeOwnerJSONMap(t, rr)
		if payload["error"] != "IMAGE_NOT_CONFIGURED" {
			t.Fatalf("unexpected error %#v", payload["error"])
		}
	})
}

func TestAIImageGenerateEnforcesDailyLimit(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		t.Setenv("DASHSCOPE_API_KEY", "sk-test")
		userID := seedOwnerControllerUser(t, "artist@example.com", false)
		token := seedOwnerControllerSession(t, userID, false)
		if _, err := db.Exec(
			`INSERT INTO ai_chat_quota (identity_key, quota_date, used, last_request_at) VALUES (?, ?, 3, ?)`,
			"image:user:"+formatUserID(userID),
			todayDate(),
			time.Now().UTC().Add(-time.Hour).Format(time.RFC3339),
		); err != nil {
			t.Fatalf("seed image quota: %v", err)
		}
		gen := &fakeAIImageGenerator{}
		withAIImageGenerator(t, gen, func() {
			req := httptest.NewRequest(
				http.MethodPost,
				"/api/ai/image",
				bytes.NewBufferString(`{"prompt":"一只坐在月亮上的猫"}`),
			)
			req.Header.Set("Content-Type", "application/json")
			req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
			rr := httptest.NewRecorder()

			aiImageHandler(rr, req)

			if rr.Code != http.StatusTooManyRequests {
				t.Fatalf("expected 429, got %d body=%s", rr.Code, rr.Body.String())
			}
			if gen.calls != 0 {
				t.Fatalf("generator should not be called after quota denial")
			}
		})
	})
}

func TestAIImageGenerateRollsBackQuotaWhenUploadFails(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		t.Setenv("DASHSCOPE_API_KEY", "sk-test")
		userID := seedOwnerControllerUser(t, "artist@example.com", false)
		token := seedOwnerControllerSession(t, userID, false)
		gen := &fakeAIImageGenerator{
			result: aiImageProviderResult{
				ImageURL:  "https://dashscope-result.example/temp.png",
				RequestID: "req-123",
				Model:     "z-image-turbo",
				Size:      "1024*1024",
			},
		}
		uploader := &recordingAIImageUploader{err: errors.New("cos failed")}

		withAIImageGenerator(t, gen, func() {
			withAIImageDownloader(t, func(ctx context.Context, rawURL string) ([]byte, string, error) {
				return validTinyPNGBytes(), "image/png", nil
			}, func() {
				withOwnerAssetUploader(t, uploader, func() {
					req := httptest.NewRequest(
						http.MethodPost,
						"/api/ai/image",
						bytes.NewBufferString(`{"prompt":"一只坐在月亮上的猫"}`),
					)
					req.Header.Set("Content-Type", "application/json")
					req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
					rr := httptest.NewRecorder()

					aiImageHandler(rr, req)

					if rr.Code != http.StatusBadGateway {
						t.Fatalf("expected 502, got %d body=%s", rr.Code, rr.Body.String())
					}
					used, _, err := loadQuota(db, "image:user:"+formatUserID(userID), todayDate())
					if err != nil {
						t.Fatalf("load quota: %v", err)
					}
					if used != 0 {
						t.Fatalf("expected quota rollback to 0, got %d", used)
					}
				})
			})
		})
	})
}

func TestDashScopeImageGeneratorPostsPromptExtendFalse(t *testing.T) {
	var gotPath string
	var gotAuth string
	var gotBody map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		gotAuth = r.Header.Get("Authorization")
		raw, _ := io.ReadAll(r.Body)
		if err := json.Unmarshal(raw, &gotBody); err != nil {
			t.Fatalf("decode request body: %v", err)
		}
		writeJSON(w, map[string]any{
			"request_id": "req-456",
			"output": map[string]any{
				"choices": []map[string]any{
					{
						"finish_reason": "stop",
						"message": map[string]any{
							"role": "assistant",
							"content": []map[string]any{
								{"image": "https://dashscope-result.example/temp.png"},
								{"text": "一只坐在月亮上的猫"},
							},
						},
					},
				},
			},
			"usage": map[string]any{"width": 1024, "height": 1024, "image_count": 1},
		})
	}))
	defer server.Close()

	gen := dashScopeImageGenerator{
		apiKey:  "sk-test",
		baseURL: server.URL + "/api/v1",
		model:   "z-image-turbo",
		http:    server.Client(),
	}
	result, err := gen.Generate(context.Background(), "一只坐在月亮上的猫", "1024*1024")
	if err != nil {
		t.Fatalf("Generate failed: %v", err)
	}
	if gotPath != "/api/v1/services/aigc/multimodal-generation/generation" {
		t.Fatalf("unexpected path %q", gotPath)
	}
	if gotAuth != "Bearer sk-test" {
		t.Fatalf("unexpected auth header %q", gotAuth)
	}
	if gotBody["model"] != "z-image-turbo" {
		t.Fatalf("unexpected model %#v", gotBody["model"])
	}
	parameters := gotBody["parameters"].(map[string]any)
	if parameters["prompt_extend"] != false {
		t.Fatalf("prompt_extend must be false, got %#v", parameters["prompt_extend"])
	}
	if parameters["size"] != "1024*1024" {
		t.Fatalf("unexpected size %#v", parameters["size"])
	}
	if result.ImageURL != "https://dashscope-result.example/temp.png" || result.RequestID != "req-456" {
		t.Fatalf("unexpected result %#v", result)
	}
}
