package main

import (
	"crypto/subtle"
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	_ "modernc.org/sqlite"
)

var (
	db       *sql.DB
	cacheDir string
)

func main() {
	// Load /opt/acg-api/.env in-process (avoids systemd EnvironmentFile parse issues).
	loadOptionalEnvFiles("/opt/acg-api/.env", ".env")

	addr := env("ACG_API_ADDR", ":8787")
	dataDir := env("ACG_DATA_DIR", "./data")
	cacheDir = filepath.Join(dataDir, "cache")
	logSMTPMailerConfig()
	_ = os.MkdirAll(dataDir, 0o755)
	_ = os.MkdirAll(cacheDir, 0o755)

	cfg := loadConfig()

	var err error
	db, err = sql.Open("sqlite", filepath.Join(dataDir, "acg.db"))
	if err != nil {
		log.Fatal(err)
	}
	if err := migrateAll(db); err != nil {
		log.Fatal(err)
	}
	seedDefaultACGData(db)

	startSyncLoops(db, cfg, cacheDir)
	startWallpaperPoolLoop(db)

	go func() {
		t := time.NewTicker(24 * time.Hour)
		cleanupCache(cacheDir, 7*24*time.Hour)
		pruneChatHourlyStats(db)
		for range t.C {
			cleanupCache(cacheDir, 7*24*time.Hour)
			pruneChatHourlyStats(db)
		}
	}()

	mux := http.NewServeMux()
	mux.HandleFunc("/api/guestbook/", guestbookRouter)
	mux.HandleFunc("/api/v1/guestbook", guestbookHandler)
	mux.HandleFunc("/api/v1/bangumi/list", bangumiListHandler)
	mux.HandleFunc("/api/v1/github/commits", githubCommitsHandler(cfg))
	mux.HandleFunc("/api/v1/wallpapers/draw", wallpaperDrawHandler)
	mux.HandleFunc("/api/v1/acg/image/", imageHandler)
	mux.HandleFunc("/api/v1/health", func(w http.ResponseWriter, _ *http.Request) {
		// The shelf only needs a username; the token merely widens what is
		// visible, so it is not what decides whether Bangumi is configured.
		bangumiStatus := "not_configured"
		if strings.TrimSpace(cfg.BangumiUsername) != "" {
			bangumiStatus = "public"
		}
		if strings.TrimSpace(cfg.BangumiAccessToken) != "" {
			bangumiStatus = "configured"
		}
		writeJSON(w, map[string]string{"status": "ok", "bangumi": bangumiStatus})
	})
	mux.HandleFunc("/api/chat/stats", chatStatsHandler)
	mux.HandleFunc("/api/server/info", serverInfoHandler)
	mux.HandleFunc("/api/client/network", clientNetworkHandler)
	mux.HandleFunc("/api/chat", chatHandler)
	mux.HandleFunc("/api/ai/image/gallery", aiImageGalleryHandler)
	mux.HandleFunc("/api/ai/image", aiImageHandler)
	mux.HandleFunc("/api/owner/", ownerRouter)
	mux.HandleFunc("/api/integrations/obsidian/publish", obsidianPublishHandler)
	mux.HandleFunc("/api/v1/sync/trigger", syncTriggerHandler(cfg))

	deepseekReady := chatConfigured()
	bangumiReady := strings.TrimSpace(cfg.BangumiUsername) != "" || strings.TrimSpace(cfg.BangumiAccessToken) != ""
	log.Printf("acg-api on %s | bangumi=%v | deepseek=%v\n", addr, bangumiReady, deepseekReady)
	log.Fatal(http.ListenAndServe(addr, withCORS(mux)))
}

var syncRunning atomic.Bool

var syncTriggerQueue = func(cfg AppConfig) bool {
	bangumi := NewBangumiClient(cfg)
	return tryStartSyncJob(func() {
		runBangumiSync(db, bangumi, cacheDir)
	})
}

func tryRunSyncJob(run func()) bool {
	if !syncRunning.CompareAndSwap(false, true) {
		return false
	}
	defer syncRunning.Store(false)
	run()
	return true
}

func tryStartSyncJob(run func()) bool {
	if !syncRunning.CompareAndSwap(false, true) {
		return false
	}
	go func() {
		defer syncRunning.Store(false)
		run()
	}()
	return true
}

func syncTriggerHandler(cfg AppConfig) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if !syncTriggerAuthorized(w, r) {
			return
		}
		if !syncTriggerQueue(cfg) {
			writeJSONStatus(w, http.StatusAccepted, map[string]string{
				"queued": "already_running",
			})
			return
		}
		writeJSON(w, map[string]string{"queued": "sync"})
	}
}

func syncTriggerAuthorized(w http.ResponseWriter, r *http.Request) bool {
	if syncTriggerTokenAuthorized(r) {
		return true
	}
	if strings.TrimSpace(env("SYNC_TRIGGER_TOKEN", "")) != "" {
		if syncTriggerOwnerAuthorized(r) {
			return true
		}
		writeJSONStatus(w, http.StatusForbidden, map[string]any{
			"error":   "FORBIDDEN",
			"message": "valid sync trigger token or owner session required",
		})
		return false
	}
	_, ok := requireOwnerSession(w, r)
	return ok
}

func syncTriggerTokenAuthorized(r *http.Request) bool {
	expected := strings.TrimSpace(env("SYNC_TRIGGER_TOKEN", ""))
	if expected == "" {
		return false
	}
	provided := syncTriggerProvidedToken(r)
	if provided == "" || len(provided) != len(expected) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(provided), []byte(expected)) == 1
}

func syncTriggerProvidedToken(r *http.Request) string {
	if token := strings.TrimSpace(r.Header.Get("X-Sync-Trigger-Token")); token != "" {
		return token
	}
	auth := strings.TrimSpace(r.Header.Get("Authorization"))
	scheme, token, ok := strings.Cut(auth, " ")
	if !ok || !strings.EqualFold(scheme, "Bearer") {
		return ""
	}
	return strings.TrimSpace(token)
}

func syncTriggerOwnerAuthorized(r *http.Request) bool {
	return isOwnerRequest(r)
}

func wallpaperDrawHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	apiOnly := r.URL.Query().Get("source") == "api" || r.URL.Query().Get("apiOnly") == "1"
	if apiOnly {
		item, err := drawAPIWallpaperItem(db)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				runWallpaperPoolSync(db)
				if item, err = drawAPIWallpaperItem(db); err == nil {
					writeJSON(w, map[string]any{"item": item, "apiOnly": true})
					return
				}
				writeJSON(w, map[string]any{"item": apiFallbackWallpaperItem(), "fallback": true, "apiOnly": true})
				return
			}
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, map[string]any{"item": item, "apiOnly": true})
		return
	}
	item, err := drawWallpaperItem(db)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeJSON(w, map[string]any{"item": fallbackWallpaperItem(), "fallback": true})
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]any{"item": item})
}

func bangumiListHandler(w http.ResponseWriter, r *http.Request) {
	status := strings.TrimSpace(r.URL.Query().Get("status"))
	if status == "" {
		status = "watching"
	}
	collectionTypes := map[string]int{
		"watching": bangumiCollectionWatching,
		"watched":  bangumiCollectionWatched,
		"wish":     bangumiCollectionWish,
	}
	collectionType, ok := collectionTypes[status]
	if !ok {
		writeJSONStatus(w, http.StatusBadRequest, map[string]string{
			"error": "INVALID_BANGUMI_STATUS",
		})
		return
	}
	items, err := listBangumiFromDB(db, collectionType)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	counts, err := bangumiCollectionCounts(db)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]any{"items": items, "status": status, "counts": counts})
}

func imageHandler(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(r.URL.Path, "/api/v1/acg/image/")
	if !safeImageName(name) {
		http.NotFound(w, r)
		return
	}
	// Cached cover files are immutable: the name embeds the subject id and the
	// file is replaced wholesale on re-sync. A long browser cache is what keeps
	// a shelf of two hundred cards from refetching every cover on each visit.
	w.Header().Set("Cache-Control", "public, max-age=604800, immutable")
	http.ServeFile(w, r, filepath.Join(cacheDir, name))
}

type guestbookRow struct {
	ID        int64  `json:"id"`
	Name      string `json:"name"`
	Content   string `json:"content"`
	CreatedAt string `json:"createdAt"`
}

func guestbookHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		limit := 50
		if q := r.URL.Query().Get("limit"); q != "" {
			if n, err := strconv.Atoi(q); err == nil && n > 0 && n <= 100 {
				limit = n
			}
		}
		rows, err := db.Query(
			`SELECT id, name, content, created_at FROM guestbook ORDER BY id DESC LIMIT ?`,
			limit,
		)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		defer rows.Close()
		var items []guestbookRow
		for rows.Next() {
			var g guestbookRow
			if err := rows.Scan(&g.ID, &g.Name, &g.Content, &g.CreatedAt); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			items = append(items, g)
		}
		writeJSON(w, map[string]any{"items": items})
	case http.MethodPost:
		var body struct {
			Name    string `json:"name"`
			Content string `json:"content"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		name := strings.TrimSpace(body.Name)
		content := strings.TrimSpace(body.Content)
		if guestbookLooksUnsafe(name) || guestbookLooksUnsafe(content) {
			writeJSONStatus(w, http.StatusBadRequest, map[string]any{
				"error":   "UNSAFE_CONTENT",
				"message": "guestbook content cannot contain scripts, HTML tags, or executable links",
			})
			return
		}
		if content == "" {
			http.Error(w, "content required", http.StatusBadRequest)
			return
		}
		if name == "" {
			name = "anonymous"
		}
		if len(name) > 32 {
			name = name[:32]
		}
		if len(content) > 500 {
			content = content[:500]
		}
		created := time.Now().UTC().Format(time.RFC3339)
		res, err := db.Exec(
			`INSERT INTO guestbook (name, content, created_at) VALUES (?, ?, ?)`,
			name, content, created,
		)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		id, _ := res.LastInsertId()
		writeJSON(w, guestbookRow{ID: id, Name: name, Content: content, CreatedAt: created})
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func env(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if origin := allowedCORSOrigin(r.Header.Get("Origin")); origin != "" {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Access-Control-Allow-Credentials", "true")
			w.Header().Add("Vary", "Origin")
		}
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Accept, X-Blog-User-Id, X-Sync-Trigger-Token, Authorization")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func allowedCORSOrigin(origin string) string {
	origin = strings.TrimSpace(origin)
	if origin == "" {
		return ""
	}
	for _, allowed := range configuredCORSOrigins() {
		if strings.EqualFold(origin, allowed) {
			return origin
		}
	}
	return ""
}

// sitePublicOrigin is the scheme+host this deployment is reachable at, used
// wherever the backend has to build an absolute link back to the site. Empty
// when nothing is configured, which yields root-relative links rather than a
// confidently wrong absolute one.
func sitePublicOrigin() string {
	if v := strings.TrimSpace(env("SITE_PUBLIC_ORIGIN", "")); v != "" {
		return strings.TrimRight(v, "/")
	}
	if origins := configuredCORSOrigins(); len(origins) > 0 {
		return strings.TrimRight(origins[0], "/")
	}
	return ""
}

func configuredCORSOrigins() []string {
	raw := strings.TrimSpace(env("ACG_ALLOWED_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"))
	if raw == "" {
		return nil
	}
	parts := strings.FieldsFunc(raw, func(r rune) bool {
		return r == ',' || r == ' ' || r == '\n' || r == '\t'
	})
	origins := make([]string, 0, len(parts))
	for _, part := range parts {
		if origin := strings.TrimSpace(part); origin != "" {
			origins = append(origins, origin)
		}
	}
	return origins
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	enc := json.NewEncoder(w)
	_ = enc.Encode(v)
}
