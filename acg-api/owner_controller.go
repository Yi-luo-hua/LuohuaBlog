package main

import (
	"database/sql"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
)

const (
	ownerUploadMaxBytes   = 8 * 1024 * 1024
	ownerDraftTitleMax    = 120
	ownerDraftBodyMax     = 200000
	ownerLatestUserLimit  = 5
	ownerLatestDraftLimit = 20
)

var ownerAssetUploadFactory = newOwnerAssetUploader

type ownerAuthedSession struct {
	Session     sessionInfo
	UserID      int64
	Email       string
	DisplayName string
}

type ownerDraftRow struct {
	ID        int64  `json:"id"`
	Kind      string `json:"kind"`
	Title     string `json:"title"`
	Body      string `json:"body"`
	CoverURL  string `json:"coverUrl"`
	Status    string `json:"status"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

func ownerRouter(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/owner/")
	path = strings.Trim(path, "/")

	switch {
	case path == "status":
		if r.Method != http.MethodGet {
			methodNotAllowed(w)
			return
		}
		ownerStatusHandler(w, r)
		return
	case path == "drafts":
		switch r.Method {
		case http.MethodGet:
			ownerDraftListHandler(w, r)
		case http.MethodPost:
			ownerDraftCreateHandler(w, r)
		default:
			methodNotAllowed(w)
		}
		return
	case path == "uploads":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		ownerUploadCreateHandler(w, r)
		return
	case path == "assets":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		ownerAssetCreateHandler(w, r)
		return
	case path == "gallery/images":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		ownerGalleryPublishHandler(w, r)
		return
	case path == "publish":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		ownerPublishHandler(w, r)
		return
	case strings.HasPrefix(path, "uploads/"):
		if r.Method != http.MethodGet {
			methodNotAllowed(w)
			return
		}
		ownerUploadServeHandler(w, r, strings.TrimPrefix(path, "uploads/"))
		return
	default:
		http.NotFound(w, r)
	}
}

func requireOwnerSession(w http.ResponseWriter, r *http.Request) (ownerAuthedSession, bool) {
	sess, ok := sessionFromRequest(r)
	if !ok {
		writeJSONStatus(w, http.StatusUnauthorized, map[string]any{
			"error":   "UNAUTHORIZED",
			"message": "Please log in first.",
		})
		return ownerAuthedSession{}, false
	}

	var (
		email       string
		displayName string
		isOwner     int
	)
	err := db.QueryRow(
		`SELECT email, display_name, is_owner FROM users WHERE id = ?`,
		sess.UserID,
	).Scan(&email, &displayName, &isOwner)
	if err == sql.ErrNoRows {
		writeJSONStatus(w, http.StatusUnauthorized, map[string]any{
			"error":   "UNAUTHORIZED",
			"message": "Session user was not found.",
		})
		return ownerAuthedSession{}, false
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return ownerAuthedSession{}, false
	}
	if isOwner != 1 || !sess.Unlimited {
		writeJSONStatus(w, http.StatusForbidden, map[string]any{
			"error":   "FORBIDDEN",
			"message": "Owner access required.",
		})
		return ownerAuthedSession{}, false
	}

	return ownerAuthedSession{
		Session:     sess,
		UserID:      sess.UserID,
		Email:       email,
		DisplayName: displayNameOrEmail(email, displayName),
	}, true
}

func ownerStatusHandler(w http.ResponseWriter, r *http.Request) {
	ownerSess, ok := requireOwnerSession(w, r)
	if !ok {
		return
	}

	totalUsers, err := ownerUserTotal()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	latestUsers, err := ownerLatestUsers(ownerLatestUserLimit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	notifications, err := ownerNotificationSummary()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	aiToday, err := ownerTodayAISuccess()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	drafts, err := listOwnerDrafts(ownerLatestDraftLimit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]any{
		"owner": map[string]any{
			"id":          ownerSess.UserID,
			"email":       ownerSess.Email,
			"displayName": ownerSess.DisplayName,
		},
		"users": map[string]any{
			"total":  totalUsers,
			"latest": latestUsers,
		},
		"notifications": notifications,
		"ai": map[string]any{
			"today": aiToday,
		},
		"uploads": map[string]any{
			"maxBytes": ownerUploadMaxBytes,
			"baseURL":  "/api/owner/uploads/",
		},
		"drafts": map[string]any{
			"total": len(drafts),
			"items": drafts,
		},
	})
}

func ownerDraftListHandler(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireOwnerSession(w, r); !ok {
		return
	}
	items, err := listOwnerDrafts(ownerLatestDraftLimit)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]any{
		"items": items,
		"total": len(items),
	})
}

func ownerDraftCreateHandler(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireOwnerSession(w, r); !ok {
		return
	}

	var body struct {
		Kind     string `json:"kind"`
		Title    string `json:"title"`
		Body     string `json:"body"`
		CoverURL string `json:"coverUrl"`
		Status   string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_JSON",
			"message": "Invalid request body.",
		})
		return
	}

	kind := strings.TrimSpace(body.Kind)
	if kind == "" {
		kind = "article"
	}
	title := strings.TrimSpace(body.Title)
	if title == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_TITLE",
			"message": "Draft title is required.",
		})
		return
	}
	if len([]rune(title)) > ownerDraftTitleMax {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_TITLE",
			"message": "Draft title is too long.",
		})
		return
	}
	if len(body.Body) > ownerDraftBodyMax {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_BODY",
			"message": "Draft body is too large.",
		})
		return
	}

	status := strings.TrimSpace(body.Status)
	if status == "" {
		status = "draft"
	}
	now := time.Now().UTC().Format(time.RFC3339)
	res, err := db.Exec(
		`INSERT INTO owner_drafts (kind, title, body, cover_url, status, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		kind,
		title,
		body.Body,
		strings.TrimSpace(body.CoverURL),
		status,
		now,
		now,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	id, err := res.LastInsertId()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]any{
		"ok": true,
		"item": ownerDraftRow{
			ID:        id,
			Kind:      kind,
			Title:     title,
			Body:      body.Body,
			CoverURL:  strings.TrimSpace(body.CoverURL),
			Status:    status,
			CreatedAt: now,
			UpdatedAt: now,
		},
	})
}

func ownerUploadCreateHandler(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireOwnerSession(w, r); !ok {
		return
	}

	if err := os.MkdirAll(ownerUploadsDir(), 0o755); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, ownerUploadMaxBytes+1024*1024)
	if err := r.ParseMultipartForm(ownerUploadMaxBytes + 1024*1024); err != nil {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_UPLOAD",
			"message": "Unable to parse upload form.",
		})
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "MISSING_FILE",
			"message": "Upload file is required.",
		})
		return
	}
	defer file.Close()

	if header.Size > ownerUploadMaxBytes {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "FILE_TOO_LARGE",
			"message": "Upload exceeds the 8 MiB limit.",
		})
		return
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !ownerUploadExtAllowed(ext) {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_FILE_TYPE",
			"message": "Only image uploads are supported.",
		})
		return
	}

	buf, err := io.ReadAll(io.LimitReader(file, ownerUploadMaxBytes+1))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if int64(len(buf)) > ownerUploadMaxBytes {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "FILE_TOO_LARGE",
			"message": "Upload exceeds the 8 MiB limit.",
		})
		return
	}
	if !strings.HasPrefix(http.DetectContentType(buf), "image/") {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_FILE_TYPE",
			"message": "Only image uploads are supported.",
		})
		return
	}

	name := ownerUploadFilename(ext)
	target := filepath.Join(ownerUploadsDir(), name)
	if err := os.WriteFile(target, buf, 0o644); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]any{
		"ok": true,
		"item": map[string]any{
			"name":     name,
			"url":      "/api/owner/uploads/" + name,
			"size":     len(buf),
			"mimeType": http.DetectContentType(buf),
		},
	})
}

func ownerAssetCreateHandler(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireOwnerSession(w, r); !ok {
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, ownerUploadMaxBytes+1024*1024)
	if err := r.ParseMultipartForm(ownerUploadMaxBytes + 1024*1024); err != nil {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_UPLOAD",
			"message": "Unable to parse upload form.",
		})
		return
	}

	kind := strings.TrimSpace(r.FormValue("kind"))
	if kind != "gallery" && kind != "article" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_ASSET_KIND",
			"message": "Asset kind must be gallery or article.",
		})
		return
	}

	album := strings.TrimSpace(r.FormValue("album"))
	if kind == "gallery" && album == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_ALBUM",
			"message": "Gallery uploads require an album.",
		})
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "MISSING_FILE",
			"message": "Upload file is required.",
		})
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !ownerUploadExtAllowed(ext) {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_FILE_TYPE",
			"message": "Only image uploads are supported.",
		})
		return
	}

	buf, err := io.ReadAll(io.LimitReader(file, ownerUploadMaxBytes+1))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if int64(len(buf)) > ownerUploadMaxBytes {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "FILE_TOO_LARGE",
			"message": "Upload exceeds the 8 MiB limit.",
		})
		return
	}

	mimeType := http.DetectContentType(buf)
	if !strings.HasPrefix(mimeType, "image/") {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_FILE_TYPE",
			"message": "Only image uploads are supported.",
		})
		return
	}

	uploader, err := ownerAssetUploadFactory()
	if err != nil {
		writeJSONStatus(w, http.StatusServiceUnavailable, map[string]any{
			"error":   "ASSET_UPLOAD_NOT_CONFIGURED",
			"message": "Tencent COS upload is not configured.",
		})
		return
	}

	name := ownerUploadFilename(ext)
	item, err := uploader.UploadImage(kind, album, name, mimeType, buf)
	if err != nil {
		writeJSONStatus(w, http.StatusBadGateway, map[string]any{
			"error":   "ASSET_UPLOAD_FAILED",
			"message": "Unable to upload asset to Tencent COS.",
		})
		return
	}

	writeJSON(w, map[string]any{
		"ok": true,
		"item": map[string]any{
			"kind":     kind,
			"url":      item.URL,
			"path":     item.ObjectKey,
			"mimeType": item.MIMEType,
			"size":     item.Size,
		},
	})
}

func ownerUploadServeHandler(w http.ResponseWriter, r *http.Request, name string) {
	if name == "" || strings.Contains(name, "/") || strings.Contains(name, `\`) {
		http.NotFound(w, r)
		return
	}
	target := filepath.Join(ownerUploadsDir(), filepath.Base(name))
	http.ServeFile(w, r, target)
}

func ownerUserTotal() (int, error) {
	var total int
	err := db.QueryRow(`SELECT COUNT(*) FROM users`).Scan(&total)
	return total, err
}

func ownerLatestUsers(limit int) ([]map[string]any, error) {
	rows, err := db.Query(
		`SELECT email, display_name, is_owner, created_at
		 FROM users
		 ORDER BY id DESC
		 LIMIT ?`,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	latest := make([]map[string]any, 0, limit)
	for rows.Next() {
		var email, displayName, createdAt string
		var isOwner int
		if err := rows.Scan(&email, &displayName, &isOwner, &createdAt); err != nil {
			return nil, err
		}
		latest = append(latest, map[string]any{
			"email":       email,
			"displayName": displayNameOrEmail(email, displayName),
			"isOwner":     isOwner == 1,
			"createdAt":   createdAt,
		})
	}
	return latest, rows.Err()
}

func ownerNotificationSummary() (map[string]any, error) {
	rows, err := db.Query(
		`SELECT channel, COUNT(*)
		 FROM guestbook_messages
		 WHERE status = 'visible'
		 GROUP BY channel`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]map[string]any, 0, 4)
	total := 0
	for rows.Next() {
		var channel string
		var count int
		if err := rows.Scan(&channel, &count); err != nil {
			return nil, err
		}
		total += count
		items = append(items, map[string]any{
			"source": channel,
			"title":  ownerNotificationTitle(channel),
			"detail": ownerNotificationDetail(channel, count),
			"count":  count,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return map[string]any{
		"total": total,
		"items": items,
	}, nil
}

func ownerNotificationTitle(channel string) string {
	switch channel {
	case guestbookChannelLink:
		return "Friends messages"
	case guestbookChannelMain:
		return "Guestbook messages"
	default:
		return "Owner notifications"
	}
}

func ownerNotificationDetail(channel string, count int) string {
	switch channel {
	case guestbookChannelLink:
		return "Pending messages from the friends channel: " + strconv.Itoa(count)
	case guestbookChannelMain:
		return "Pending messages from the guestbook: " + strconv.Itoa(count)
	default:
		return "Pending owner messages: " + strconv.Itoa(count)
	}
}

func ownerTodayAISuccess() (int, error) {
	var total int
	prefix := time.Now().UTC().Format("2006-01-02") + "T"
	err := db.QueryRow(
		`SELECT COALESCE(SUM(success), 0) FROM ai_chat_hourly WHERE bucket LIKE ? || '%'`,
		prefix,
	).Scan(&total)
	return total, err
}

func listOwnerDrafts(limit int) ([]ownerDraftRow, error) {
	rows, err := db.Query(
		`SELECT id, kind, title, body, cover_url, status, created_at, updated_at
		 FROM owner_drafts
		 ORDER BY updated_at DESC, id DESC
		 LIMIT ?`,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]ownerDraftRow, 0, limit)
	for rows.Next() {
		var item ownerDraftRow
		if err := rows.Scan(
			&item.ID,
			&item.Kind,
			&item.Title,
			&item.Body,
			&item.CoverURL,
			&item.Status,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func ownerUploadsDir() string {
	return filepath.Join(env("ACG_DATA_DIR", "./data"), "owner-uploads")
}

func ownerUploadExtAllowed(ext string) bool {
	switch ext {
	case ".png", ".jpg", ".jpeg", ".webp", ".gif":
		return true
	default:
		return false
	}
}

func ownerUploadFilename(ext string) string {
	return time.Now().UTC().Format("20060102-150405") + "-" + uuid.NewString() + ext
}

func ownerUploadMIMEFromHeader(header *multipart.FileHeader) string {
	if header == nil {
		return ""
	}
	return header.Header.Get("Content-Type")
}
