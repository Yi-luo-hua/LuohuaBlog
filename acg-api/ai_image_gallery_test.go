package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func seedAIImageGeneration(t *testing.T, prompt, url, size string, createdAt time.Time) {
	t.Helper()
	_, err := db.Exec(
		`INSERT INTO ai_image_generations
		 (user_id, identity_key, prompt, model, size, image_url, object_key, provider_request_id, created_at)
		 VALUES (NULL, 'image:test', ?, 'z-image-turbo', ?, ?, 'ai-images/test.png', '', ?)`,
		prompt, size, url, createdAt.UTC().Format(time.RFC3339Nano),
	)
	if err != nil {
		t.Fatalf("seed ai_image_generations: %v", err)
	}
}

func TestAIImageGalleryListsLatestFirst(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		now := time.Date(2026, 6, 22, 12, 0, 0, 0, time.UTC)
		seedAIImageGeneration(t, "older sunrise", "https://cdn.example/older.png", "1024*1024", now.Add(-2*time.Hour))
		seedAIImageGeneration(t, "middle moon", "https://cdn.example/middle.png", "1024*1024", now.Add(-1*time.Hour))
		seedAIImageGeneration(t, "newest star", "https://cdn.example/newest.png", "1024*1024", now)

		req := httptest.NewRequest(http.MethodGet, "/api/ai/image/gallery", nil)
		rr := httptest.NewRecorder()
		aiImageGalleryHandler(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
		}
		var payload struct {
			Items []map[string]any `json:"items"`
		}
		if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
			t.Fatalf("decode body: %v", err)
		}
		if len(payload.Items) != 3 {
			t.Fatalf("expected 3 items, got %d", len(payload.Items))
		}
		if got := payload.Items[0]["prompt"]; got != "newest star" {
			t.Fatalf("expected newest first, got %v", got)
		}
		if got := payload.Items[2]["prompt"]; got != "older sunrise" {
			t.Fatalf("expected oldest last, got %v", got)
		}
		// Privacy guard: the public feed must not leak the user_id.
		if _, exists := payload.Items[0]["userId"]; exists {
			t.Fatalf("user id should not be exposed in public gallery")
		}
		if _, exists := payload.Items[0]["user_id"]; exists {
			t.Fatalf("user id should not be exposed in public gallery")
		}
	})
}

func TestAIImageGalleryRespectsLimit(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		base := time.Date(2026, 6, 22, 12, 0, 0, 0, time.UTC)
		for i := 0; i < 5; i++ {
			seedAIImageGeneration(t,
				"prompt "+time.Duration(i).String(),
				"https://cdn.example/img-"+time.Duration(i).String()+".png",
				"1024*1024",
				base.Add(time.Duration(i)*time.Minute),
			)
		}

		req := httptest.NewRequest(http.MethodGet, "/api/ai/image/gallery?limit=2", nil)
		rr := httptest.NewRecorder()
		aiImageGalleryHandler(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
		}
		var payload struct {
			Items      []map[string]any `json:"items"`
			NextCursor any              `json:"nextCursor"`
		}
		if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if len(payload.Items) != 2 {
			t.Fatalf("expected 2 items for limit=2, got %d", len(payload.Items))
		}
		if payload.NextCursor == nil {
			t.Fatal("expected a next cursor when page is full")
		}
	})
}

func TestAIImageGalleryEmptyTable(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		req := httptest.NewRequest(http.MethodGet, "/api/ai/image/gallery", nil)
		rr := httptest.NewRecorder()
		aiImageGalleryHandler(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d", rr.Code)
		}
		var payload struct {
			Items      []map[string]any `json:"items"`
			NextCursor any              `json:"nextCursor"`
		}
		if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if len(payload.Items) != 0 {
			t.Fatalf("expected empty items, got %d", len(payload.Items))
		}
		if payload.NextCursor != nil {
			t.Fatalf("empty feed should have nil next cursor, got %v", payload.NextCursor)
		}
	})
}

func TestAIImageGalleryRejectsNonGet(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		req := httptest.NewRequest(http.MethodPost, "/api/ai/image/gallery", nil)
		rr := httptest.NewRecorder()
		aiImageGalleryHandler(rr, req)
		if rr.Code != http.StatusMethodNotAllowed {
			t.Fatalf("expected 405, got %d", rr.Code)
		}
	})
}
