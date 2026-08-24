package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestBangumiFetchWatchingUsesAuthenticatedAnimeDoingCollection(t *testing.T) {
	var collectionRequestSeen bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if got := r.Header.Get("Authorization"); got != "Bearer test-token" {
			t.Fatalf("unexpected authorization header: %q", got)
		}
		if got := r.Header.Get("User-Agent"); got != bangumiUA {
			t.Fatalf("unexpected user-agent: %q", got)
		}

		switch r.URL.Path {
		case "/v0/me":
			_ = json.NewEncoder(w).Encode(map[string]any{"username": "yi-luo-hua"})
		case "/v0/users/yi-luo-hua/collections":
			collectionRequestSeen = true
			if got := r.URL.Query().Get("subject_type"); got != "2" {
				t.Fatalf("subject_type = %q, want 2", got)
			}
			if got := r.URL.Query().Get("type"); got != "3" {
				t.Fatalf("type = %q, want 3", got)
			}
			_ = json.NewEncoder(w).Encode(map[string]any{
				"total":  1,
				"limit":  50,
				"offset": 0,
				"data": []any{map[string]any{
					"subject_id": 123,
					"ep_status":  7,
					"rate":       9,
					"updated_at": "2026-08-24T12:00:00+08:00",
					"subject": map[string]any{
						"id":            123,
						"name":          "Original Name",
						"name_cn":       "中文番剧名",
						"short_summary": "简介",
						"date":          "2025-07-05",
						"eps":           12,
						"score":         8.4,
						"rank":          321,
						"tags": []any{
							map[string]any{"name": "校园"},
							map[string]any{"name": "恋爱"},
						},
						"images": map[string]any{"large": "https://lain.bgm.tv/cover.jpg"},
					},
				}},
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer server.Close()

	client := NewBangumiClient(AppConfig{
		BangumiAccessToken: "test-token",
		BangumiAPIBaseURL:  server.URL,
	})
	items, err := client.FetchWatching()
	if err != nil {
		t.Fatal(err)
	}
	if !collectionRequestSeen {
		t.Fatal("collection endpoint was not requested")
	}
	if len(items) != 1 {
		t.Fatalf("got %d items, want 1", len(items))
	}
	item := items[0]
	if item.ID != "123" || item.Title != "中文番剧名" || item.OriginalTitle != "Original Name" {
		t.Fatalf("unexpected mapped identity: %#v", item)
	}
	if item.Watched != 7 || item.Total != 12 || item.Score != 8.4 || item.Rank != 321 {
		t.Fatalf("unexpected mapped progress: %#v", item)
	}
	if item.MyRating != 9 {
		t.Fatalf("my rating = %d, want 9", item.MyRating)
	}
	if item.CollectionType != bangumiCollectionWatching {
		t.Fatalf("collection type = %d, want watching", item.CollectionType)
	}
	if item.AirDate != "2025-07-05" || len(item.Tags) != 2 || item.Tags[0] != "校园" {
		t.Fatalf("unexpected date or tags: %#v", item)
	}
	if item.LinkURL != "https://bgm.tv/subject/123" || item.CoverURL != "https://lain.bgm.tv/cover.jpg" {
		t.Fatalf("unexpected mapped links: %#v", item)
	}
}

func TestBangumiFetchLibraryLoadsThreeCollectionTypes(t *testing.T) {
	seen := map[string]bool{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/v0/me" {
			_ = json.NewEncoder(w).Encode(map[string]any{"username": "library-user"})
			return
		}
		if r.URL.Path != "/v0/users/library-user/collections" {
			http.NotFound(w, r)
			return
		}
		collectionType := r.URL.Query().Get("type")
		seen[collectionType] = true
		_ = json.NewEncoder(w).Encode(map[string]any{
			"total": 1,
			"data": []any{map[string]any{
				"subject_id": 100,
				"ep_status":  1,
				"subject": map[string]any{
					"id":     100,
					"name":   "Collection " + collectionType,
					"eps":    12,
					"images": map[string]any{},
				},
			}},
		})
	}))
	defer server.Close()

	client := NewBangumiClient(AppConfig{
		BangumiAccessToken: "test-token",
		BangumiAPIBaseURL:  server.URL,
	})
	items, err := client.FetchLibrary()
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 3 {
		t.Fatalf("got %d items, want 3", len(items))
	}
	for _, collectionType := range []string{"1", "2", "3"} {
		if !seen[collectionType] {
			t.Fatalf("collection type %s was not requested", collectionType)
		}
	}
}

func TestBangumiFetchWatchingNeedsAUsernameOrAToken(t *testing.T) {
	client := NewBangumiClient(AppConfig{BangumiAPIBaseURL: "https://api.bgm.tv"})
	if _, err := client.FetchWatching(); err == nil {
		t.Fatal("expected an error when neither username nor token is set")
	}
}

// A Bangumi collection listing is public, so a configured username is enough to
// show the shelf. Requiring a token meant a deployment holding no secrets
// displayed an empty shelf even though the data was there for the asking.
func TestBangumiReadsPublicShelfWithoutAToken(t *testing.T) {
	var sawAuthHeader bool
	var meCalls int
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "" {
			sawAuthHeader = true
		}
		if r.URL.Path == "/v0/me" {
			meCalls++
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if r.URL.Path != "/v0/users/936756/collections" {
			t.Errorf("unexpected path %q", r.URL.Path)
			w.WriteHeader(http.StatusNotFound)
			return
		}
		if r.URL.Query().Get("offset") != "0" {
			writeTestJSON(w, `{"total":1,"limit":50,"offset":50,"data":[]}`)
			return
		}
		writeTestJSON(w, `{"total":1,"limit":50,"offset":0,"data":[
			{"subject_id":1,"subject":{"id":1,"name":"碧蓝之海","name_cn":"碧蓝之海","images":{"large":"http://img/1.jpg"}}}
		]}`)
	}))
	defer server.Close()

	client := NewBangumiClient(AppConfig{
		BangumiAPIBaseURL: server.URL,
		BangumiUsername:   "936756",
	})
	items, err := client.FetchWatching()
	if err != nil {
		t.Fatalf("FetchWatching with only a username: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(items))
	}
	if meCalls != 0 {
		t.Fatalf("a configured username must skip the /v0/me lookup, saw %d calls", meCalls)
	}
	// Bangumi rejects a bearer header carrying an empty token, so an anonymous
	// request must not send one at all.
	if sawAuthHeader {
		t.Fatal("no Authorization header should be sent when there is no token")
	}
}

// The token still matters: it is what makes private collections visible, so a
// configured username must not stop it from being sent.
func TestBangumiStillSendsTheTokenWhenBothAreConfigured(t *testing.T) {
	var authorization string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authorization = r.Header.Get("Authorization")
		writeTestJSON(w, `{"total":0,"limit":50,"offset":0,"data":[]}`)
	}))
	defer server.Close()

	client := NewBangumiClient(AppConfig{
		BangumiAPIBaseURL:  server.URL,
		BangumiUsername:    "936756",
		BangumiAccessToken: "secret-token",
	})
	if _, err := client.FetchWatching(); err != nil {
		t.Fatalf("FetchWatching: %v", err)
	}
	if authorization != "Bearer secret-token" {
		t.Fatalf("expected the token to be sent, got %q", authorization)
	}
}

func writeTestJSON(w http.ResponseWriter, body string) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write([]byte(body))
}
