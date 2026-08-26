package main

import (
	"encoding/json"
	"errors"
	"io"
	"log"
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
	ownerLatestDraftLimit = 20
)

var ownerAssetUploadFactory = newOwnerAssetUploader

// ownerAuthedSession is what a handler gets once the gate has been passed.
// There is only ever one owner, so it carries no identity beyond the label
// shown in the console header.
type ownerAuthedSession struct {
	UserID      int64
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
	case path == "gate":
		ownerGateHandler(w, r)
		return
	case path == "status":
		if r.Method != http.MethodGet {
			methodNotAllowed(w)
			return
		}
		ownerStatusHandler(w, r)
		return
	case path == "emails":
		if r.Method != http.MethodGet {
			methodNotAllowed(w)
			return
		}
		ownerEmailDirectoryHandler(w, r)
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
	case path == "friends":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		ownerFriendPublishHandler(w, r)
		return
	case path == "moments":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		ownerMomentPublishHandler(w, r)
		return
	case strings.HasPrefix(path, "notifications/") && strings.HasSuffix(path, "/read"):
		if r.Method != http.MethodPatch {
			methodNotAllowed(w)
			return
		}
		idText := strings.TrimSuffix(strings.TrimPrefix(path, "notifications/"), "/read")
		id, err := strconv.ParseInt(strings.Trim(idText, "/"), 10, 64)
		if err != nil || id <= 0 {
			writeJSONStatus(w, http.StatusNotFound, map[string]any{
				"error":   "NOT_FOUND",
				"message": "提醒不存在。",
			})
			return
		}
		ownerNotificationReadHandler(w, r, id)
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
	if !isOwnerRequest(r) {
		writeJSONStatus(w, http.StatusUnauthorized, map[string]any{
			"error":   "LOCKED",
			"message": "请先输入站长密码。",
		})
		return ownerAuthedSession{}, false
	}
	return ownerAuthedSession{DisplayName: ownerDisplayName()}, true
}

// ownerDisplayName is only cosmetic — the console header needs something to
// print now that there is no account to read a name from.
func ownerDisplayName() string {
	if name := strings.TrimSpace(env("OWNER_DISPLAY_NAME", "")); name != "" {
		return name
	}
	return "站长"
}

func ownerStatusHandler(w http.ResponseWriter, r *http.Request) {
	ownerSess, ok := requireOwnerSession(w, r)
	if !ok {
		return
	}

	notifications, err := ownerNotificationSummary()
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
			"displayName": ownerSess.DisplayName,
		},
		"notifications": notifications,
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

func ownerEmailDirectoryHandler(w http.ResponseWriter, r *http.Request) {
	if _, ok := requireOwnerSession(w, r); !ok {
		return
	}

	guestbookContacts, err := ownerGuestbookContactEmails(200)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	writeJSON(w, map[string]any{
		"guestbookContacts": guestbookContacts,
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
			"message": "请求内容格式不正确。",
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
			"message": "草稿标题不能为空。",
		})
		return
	}
	if len([]rune(title)) > ownerDraftTitleMax {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_TITLE",
			"message": "草稿标题太长。",
		})
		return
	}
	if len(body.Body) > ownerDraftBodyMax {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_BODY",
			"message": "草稿正文太大。",
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

func ownerNotificationReadHandler(w http.ResponseWriter, r *http.Request, id int64) {
	if _, ok := requireOwnerSession(w, r); !ok {
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	res, err := db.Exec(
		`UPDATE guestbook_messages
		 SET owner_read_at = ?, updated_at = ?
		 WHERE id = ? AND status = 'visible'`,
		now,
		now,
		id,
	)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		writeJSONStatus(w, http.StatusNotFound, map[string]any{
			"error":   "NOT_FOUND",
			"message": "提醒不存在。",
		})
		return
	}
	writeJSON(w, map[string]any{
		"ok":          true,
		"id":          id,
		"ownerReadAt": now,
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
			"message": "上传表单解析失败。",
		})
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "MISSING_FILE",
			"message": "请选择要上传的文件。",
		})
		return
	}
	defer file.Close()

	if header.Size > ownerUploadMaxBytes {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "FILE_TOO_LARGE",
			"message": "上传文件超过 8 MiB 限制。",
		})
		return
	}

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !ownerUploadExtAllowed(ext) {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_FILE_TYPE",
			"message": "当前只支持上传图片。",
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
			"message": "上传文件超过 8 MiB 限制。",
		})
		return
	}
	if !strings.HasPrefix(http.DetectContentType(buf), "image/") {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_FILE_TYPE",
			"message": "当前只支持上传图片。",
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
			"message": "上传表单解析失败。",
		})
		return
	}

	kind := strings.TrimSpace(r.FormValue("kind"))
	if kind != "gallery" && kind != "article" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_ASSET_KIND",
			"message": "资源类型必须是相册或文章。",
		})
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "MISSING_FILE",
			"message": "请选择要上传的文件。",
		})
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	if !ownerUploadExtAllowed(ext) {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_FILE_TYPE",
			"message": "当前只支持上传图片。",
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
			"message": "上传文件超过 8 MiB 限制。",
		})
		return
	}

	mimeType := http.DetectContentType(buf)
	if !strings.HasPrefix(mimeType, "image/") {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_FILE_TYPE",
			"message": "当前只支持上传图片。",
		})
		return
	}

	uploader, err := ownerAssetUploadFactory()
	if err != nil {
		writeJSONStatus(w, http.StatusServiceUnavailable, map[string]any{
			"error":   "ASSET_UPLOAD_NOT_CONFIGURED",
			"message": "腾讯 COS 上传尚未配置。",
		})
		return
	}

	name := ownerUploadFilename(ext)
	item, err := uploader.UploadImage(kind, name, mimeType, buf)
	if err != nil {
		writeJSONStatus(w, http.StatusBadGateway, map[string]any{
			"error":   "ASSET_UPLOAD_FAILED",
			"message": "无法上传资源到腾讯 COS。",
		})
		return
	}

	response := map[string]any{
		"kind":     kind,
		"url":      item.URL,
		"path":     item.ObjectKey,
		"mimeType": item.MIMEType,
		"size":     item.Size,
	}
	// 相册列表页按等高行排版，一行最高 300px，挂原图太浪费。顺手存一份缩略图，
	// 列表用它、详情页仍旧给原图。做不出来（webp 解不开、图本来就小）就算了，
	// 前端拿不到 thumbUrl 会自动退回原图。
	if kind == "gallery" {
		if thumb, thumbWidth, thumbHeight, err := buildOwnerThumbnail(buf); err == nil {
			thumbKey := ownerThumbnailObjectKey(item.ObjectKey)
			if uploaded, err := uploader.UploadImageAt(thumbKey, "image/jpeg", thumb); err == nil {
				response["thumbUrl"] = uploaded.URL
				response["thumbPath"] = uploaded.ObjectKey
				response["thumbWidth"] = thumbWidth
				response["thumbHeight"] = thumbHeight
			} else {
				log.Println("owner asset: gallery thumbnail upload skipped:", err)
			}
		} else if !errors.Is(err, errThumbnailNotWorthIt) {
			log.Println("owner asset: gallery thumbnail skipped:", err)
		}
	}

	writeJSON(w, map[string]any{"ok": true, "item": response})
}

func ownerUploadServeHandler(w http.ResponseWriter, r *http.Request, name string) {
	if name == "" || strings.Contains(name, "/") || strings.Contains(name, `\`) {
		http.NotFound(w, r)
		return
	}
	target := filepath.Join(ownerUploadsDir(), filepath.Base(name))
	http.ServeFile(w, r, target)
}

func ownerGuestbookContactEmails(limit int) ([]map[string]any, error) {
	rows, err := db.Query(
		`SELECT gm.id, gm.channel, gm.nickname, gm.content, gm.contact_email, gm.created_at
		 FROM guestbook_messages gm
		 WHERE gm.status = 'visible' AND TRIM(gm.contact_email) != ''
		 ORDER BY gm.id DESC
		 LIMIT ?`,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]map[string]any, 0)
	for rows.Next() {
		var id int64
		var channel, nickname, content, submittedEmail, createdAt string
		if err := rows.Scan(&id, &channel, &nickname, &content, &submittedEmail, &createdAt); err != nil {
			return nil, err
		}
		contactEmail := normalizeEmail(submittedEmail)
		if contactEmail == "" {
			continue
		}
		items = append(items, map[string]any{
			"id":           id,
			"source":       channel,
			"nickname":     nickname,
			"content":      content,
			"contactEmail": contactEmail,
			"createdAt":    createdAt,
		})
	}
	return items, rows.Err()
}

func ownerNotificationSummary() (map[string]any, error) {
	rows, err := db.Query(
		`SELECT gm.id, gm.channel, gm.nickname, gm.content, gm.contact_email, gm.created_at
		 FROM guestbook_messages gm
		 WHERE gm.status = 'visible' AND gm.owner_read_at = ''
		 ORDER BY gm.id DESC
		 LIMIT 30`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]map[string]any, 0, 4)
	total := 0
	for rows.Next() {
		var id int64
		var channel, nickname, content, contactEmail, createdAt string
		if err := rows.Scan(&id, &channel, &nickname, &content, &contactEmail, &createdAt); err != nil {
			return nil, err
		}
		total += 1
		items = append(items, map[string]any{
			"id":           id,
			"source":       channel,
			"title":        ownerNotificationTitle(channel),
			"detail":       ownerNotificationMessageDetail(channel, nickname, createdAt),
			"count":        1,
			"nickname":     nickname,
			"content":      content,
			"contactEmail": normalizeEmail(contactEmail),
			"createdAt":    formatGuestbookTime(createdAt),
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
		return "朋友页消息"
	case guestbookChannelMain:
		return "留言板消息"
	default:
		return "站长提醒"
	}
}

func ownerNotificationDetail(channel string, count int) string {
	switch channel {
	case guestbookChannelLink:
		return "朋友页有 " + strconv.Itoa(count) + " 条待处理消息"
	case guestbookChannelMain:
		return "留言板有 " + strconv.Itoa(count) + " 条待处理消息"
	default:
		return "站长控制器有 " + strconv.Itoa(count) + " 条待处理消息"
	}
}

func ownerNotificationMessageDetail(channel, nickname, createdAt string) string {
	source := notificationSourceLabel(channel)
	name := strings.TrimSpace(nickname)
	if name == "" {
		name = "访客"
	}
	when := formatGuestbookTime(createdAt)
	return source + " · " + name + " · " + when
}

func notificationSourceLabel(channel string) string {
	switch channel {
	case guestbookChannelLink:
		return "朋友页"
	case guestbookChannelMain:
		return "留言板"
	default:
		return "站长提醒"
	}
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
