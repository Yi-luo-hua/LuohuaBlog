package main

import (
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	aiImageGalleryDefaultLimit = 60
	aiImageGalleryMaxLimit     = 200
)

var aiImageGalleryGetLimiter = newIPRateLimiter(60, time.Minute)

// aiImageGalleryHandler serves the public gallery feed of every successfully
// generated AI image. It intentionally omits user_id from the response so the
// gallery stays anonymous from the visitor's perspective.
func aiImageGalleryHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if !allowAPIPost(aiImageGalleryGetLimiter, r) {
		writeAPIRateLimited(w)
		return
	}

	limit := aiImageGalleryDefaultLimit
	if v := strings.TrimSpace(r.URL.Query().Get("limit")); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			if n < 1 {
				n = 1
			}
			if n > aiImageGalleryMaxLimit {
				n = aiImageGalleryMaxLimit
			}
			limit = n
		}
	}

	before := strings.TrimSpace(r.URL.Query().Get("before"))
	if before == "" {
		// Anything strictly greater than every real timestamp keeps the
		// query simple while still letting us reuse the same SQL path.
		before = time.Now().UTC().Add(48 * time.Hour).Format(time.RFC3339Nano)
	}

	rows, err := db.Query(
		`SELECT g.prompt, g.image_url, g.object_key, g.size, g.created_at
		 FROM ai_image_generations g
		 WHERE g.created_at < ?
		 ORDER BY g.created_at DESC
		 LIMIT ?`,
		before,
		limit,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	type item struct {
		Prompt    string `json:"prompt"`
		ImageURL  string `json:"imageUrl"`
		Size      string `json:"size"`
		CreatedAt string `json:"createdAt"`
	}
	items := make([]item, 0, limit)
	for rows.Next() {
		var it item
		var storedURL, objectKey string
		if err := rows.Scan(&it.Prompt, &storedURL, &objectKey, &it.Size, &it.CreatedAt); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		it.ImageURL = storedURL
		if proxyURL := ownerCOSProxyURL(objectKey); proxyURL != "" {
			it.ImageURL = proxyURL
		}
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var nextCursor any
	// Only suggest a cursor when the page is full; otherwise the visitor has
	// reached the tail of the feed.
	if len(items) == limit && limit > 0 {
		nextCursor = items[len(items)-1].CreatedAt
	}

	writeJSON(w, map[string]any{
		"items":      items,
		"nextCursor": nextCursor,
	})
}
