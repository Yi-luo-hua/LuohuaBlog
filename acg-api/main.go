package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
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
	ensureOwnerAccount(db)
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
	mux.HandleFunc("/api/v1/radar/feed", radarFeedHandler)
	mux.HandleFunc("/api/v1/wallpapers/draw", wallpaperDrawHandler)
	mux.HandleFunc("/api/v1/acg/image/", imageHandler)
	mux.HandleFunc("/api/v1/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, map[string]string{"status": "ok", "uid": cfg.BilibiliUID})
	})
	mux.HandleFunc("/api/chat/stats", chatStatsHandler)
	mux.HandleFunc("/api/chat", chatHandler)
	mux.HandleFunc("/api/auth/", authHandler)
	mux.HandleFunc("/api/v1/sync/trigger", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		bili := NewBiliClient(cfg)
		go runBangumiSync(db, bili, cacheDir)
		go runRadarSync(db, bili, cfg, cacheDir)
		writeJSON(w, map[string]string{"queued": "sync"})
	})

	deepseekReady := chatConfigured()
	log.Printf("acg-api on %s | bilibili uid=%s | radar=%d creators | deepseek=%v\n", addr, cfg.BilibiliUID, len(cfg.RadarCreators), deepseekReady)
	log.Fatal(http.ListenAndServe(addr, withCORS(mux)))
}

func wallpaperDrawHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	item, err := drawWallpaperItem(db)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Error(w, "wallpaper pool is empty", http.StatusNotFound)
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]any{"item": item})
}

func bangumiListHandler(w http.ResponseWriter, _ *http.Request) {
	items, err := listBangumiFromDB(db)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]any{"items": items})
}

func radarFeedHandler(w http.ResponseWriter, _ *http.Request) {
	items, err := listRadarFromDB(db)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]any{"items": items})
}

func imageHandler(w http.ResponseWriter, r *http.Request) {
	name := strings.TrimPrefix(r.URL.Path, "/api/v1/acg/image/")
	if !safeImageName(name) {
		http.NotFound(w, r)
		return
	}
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
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Accept, X-Blog-User-Id")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(v)
}
