package main

import (
	"bytes"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	_ "modernc.org/sqlite"
)

func openOwnerControllerTestDB(t *testing.T) *sql.DB {
	t.Helper()
	testDB, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	if err := migrateAll(testDB); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = testDB.Close() })
	return testDB
}

func withOwnerControllerTestDB(t *testing.T, fn func()) {
	t.Helper()
	prev := db
	db = openOwnerControllerTestDB(t)
	t.Cleanup(func() { db = prev })
	fn()
}

func decodeOwnerJSONMap(t *testing.T, rr *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var out map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return out
}

func decodeBase64String(raw string) (string, error) {
	buf, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		return "", err
	}
	return string(buf), nil
}

func seedOwnerControllerUser(t *testing.T, email string, isOwner bool) int64 {
	t.Helper()
	now := time.Now().UTC().Format(time.RFC3339)
	ownerFlag := 0
	if isOwner {
		ownerFlag = 1
	}
	res, err := db.Exec(
		`INSERT INTO users (email, display_name, password_hash, created_at, is_owner) VALUES (?, ?, 'hash', ?, ?)`,
		email,
		nicknameFromEmail(email),
		now,
		ownerFlag,
	)
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		t.Fatalf("user last insert id: %v", err)
	}
	return id
}

func seedOwnerControllerSession(t *testing.T, userID int64, unlimited bool) string {
	t.Helper()
	token := uuid.NewString()
	unlimitedFlag := 0
	if unlimited {
		unlimitedFlag = 1
	}
	expires := time.Now().UTC().Add(24 * time.Hour).Format(time.RFC3339)
	if _, err := db.Exec(
		`INSERT INTO sessions (id, user_id, expires_at, unlimited) VALUES (?, ?, ?, ?)`,
		token,
		userID,
		expires,
		unlimitedFlag,
	); err != nil {
		t.Fatalf("insert session: %v", err)
	}
	return token
}

func seedOwnerNotificationMessage(t *testing.T, nickname, channel, content string) int64 {
	t.Helper()
	now := time.Now().UTC().Format(time.RFC3339)
	res, err := db.Exec(
		`INSERT INTO guestbook_messages
		 (nickname, avatar, channel, content, content_hash, ip_hash, ip_region, ip_masked, user_agent_hash, parent_id, status, is_login_user, is_admin_user, created_at, updated_at)
		 VALUES (?, '', ?, ?, 'content-hash', 'ip-hash', '', '', '', 0, 'visible', 0, 0, ?, ?)`,
		nickname,
		channel,
		content,
		now,
		now,
	)
	if err != nil {
		t.Fatalf("insert guestbook message: %v", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		t.Fatalf("message last insert id: %v", err)
	}
	return id
}

func seedOwnerChatHourlySuccess(t *testing.T, count int) {
	t.Helper()
	bucket := chatHourBucket(time.Now().UTC())
	if _, err := db.Exec(
		`INSERT INTO ai_chat_hourly (bucket, success, guest_calls, user_calls)
		 VALUES (?, ?, ?, 0)`,
		bucket,
		count,
		count,
	); err != nil {
		t.Fatalf("insert ai stats: %v", err)
	}
}

func seedUnlimitedOwnerSession(t *testing.T) string {
	t.Helper()
	ownerID := seedOwnerControllerUser(t, "173236231@qq.com", true)
	return seedOwnerControllerSession(t, ownerID, true)
}

func validTinyPNGBytes() []byte {
	return []byte{
		0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
		0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
		0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
		0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
		0x89, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x44, 0x41,
		0x54, 0x78, 0x9c, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
		0x00, 0x03, 0x01, 0x01, 0x00, 0xc9, 0xfe, 0x92,
		0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
		0x44, 0xae, 0x42, 0x60, 0x82,
	}
}

type fakeOwnerAssetUploader struct {
	result ownerCOSUploadResult
	err    error
}

func (f fakeOwnerAssetUploader) UploadImage(kind, album, filename, mimeType string, body []byte) (ownerCOSUploadResult, error) {
	if f.err != nil {
		return ownerCOSUploadResult{}, f.err
	}
	return f.result, nil
}

func withOwnerAssetUploader(t *testing.T, uploader ownerAssetUploader, fn func()) {
	t.Helper()
	prev := ownerAssetUploadFactory
	ownerAssetUploadFactory = func() (ownerAssetUploader, error) { return uploader, nil }
	t.Cleanup(func() { ownerAssetUploadFactory = prev })
	fn()
}

func TestOwnerStatusRequiresLogin(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		req := httptest.NewRequest(http.MethodGet, "/api/owner/status", nil)
		rr := httptest.NewRecorder()

		ownerRouter(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d body=%s", rr.Code, rr.Body.String())
		}
	})
}

func TestOwnerStatusRejectsNonOwner(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		userID := seedOwnerControllerUser(t, "user@example.com", false)
		token := seedOwnerControllerSession(t, userID, false)
		req := httptest.NewRequest(http.MethodGet, "/api/owner/status", nil)
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
		rr := httptest.NewRecorder()

		ownerRouter(rr, req)

		if rr.Code != http.StatusForbidden {
			t.Fatalf("expected 403, got %d body=%s", rr.Code, rr.Body.String())
		}
	})
}

func TestOwnerStatusReturnsSummaryForUnlimitedOwner(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		ownerID := seedOwnerControllerUser(t, "173236231@qq.com", true)
		seedOwnerControllerUser(t, "reader@example.com", false)
		token := seedOwnerControllerSession(t, ownerID, true)
		seedOwnerNotificationMessage(t, "guest", guestbookChannelMain, "hello from guestbook")
		seedOwnerChatHourlySuccess(t, 3)
		if _, err := upsertAIFixedAnswer(
			db,
			"How do friend links work?",
			"Use the friends page application flow.",
		); err != nil {
			t.Fatalf("insert ai fixed answer: %v", err)
		}

		req := httptest.NewRequest(http.MethodGet, "/api/owner/status", nil)
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
		rr := httptest.NewRecorder()

		ownerRouter(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
		}

		payload := decodeOwnerJSONMap(t, rr)
		users := payload["users"].(map[string]any)
		notifications := payload["notifications"].(map[string]any)
		ai := payload["ai"].(map[string]any)
		uploads := payload["uploads"].(map[string]any)

		if got := int(users["total"].(float64)); got != 2 {
			t.Fatalf("expected users.total 2, got %d", got)
		}
		if got := int(notifications["total"].(float64)); got != 1 {
			t.Fatalf("expected notifications.total 1, got %d", got)
		}
		items := notifications["items"].([]any)
		if len(items) != 1 {
			t.Fatalf("expected one notification item, got %d", len(items))
		}
		item := items[0].(map[string]any)
		if item["title"] != "留言板消息" {
			t.Fatalf("expected Chinese notification title, got %#v", item["title"])
		}
		detail := item["detail"].(string)
		if !strings.Contains(detail, "留言板 · guest · ") {
			t.Fatalf("expected Chinese notification detail, got %#v", item["detail"])
		}
		if item["content"] != "hello from guestbook" {
			t.Fatalf("expected notification content, got %#v", item["content"])
		}
		if item["nickname"] != "guest" {
			t.Fatalf("expected notification nickname, got %#v", item["nickname"])
		}
		registered := users["registered"].([]any)
		if len(registered) != 1 {
			t.Fatalf("expected one registered user, got %d", len(registered))
		}
		reader := registered[0].(map[string]any)
		if reader["email"] != "reader@example.com" {
			t.Fatalf("expected registered user email, got %#v", reader["email"])
		}
		if reader["createdAt"] == "" {
			t.Fatalf("expected registered user createdAt")
		}
		if got := int(ai["today"].(float64)); got != 3 {
			t.Fatalf("expected ai.today 3, got %d", got)
		}
		fixedAnswers := ai["fixedAnswers"].([]any)
		if len(fixedAnswers) != 1 {
			t.Fatalf("expected one fixed answer, got %d", len(fixedAnswers))
		}
		fixed := fixedAnswers[0].(map[string]any)
		if fixed["question"] != "How do friend links work?" {
			t.Fatalf("unexpected fixed answer question: %#v", fixed["question"])
		}
		if fixed["answer"] != "Use the friends page application flow." {
			t.Fatalf("unexpected fixed answer body: %#v", fixed["answer"])
		}
		if got := int64(uploads["maxBytes"].(float64)); got != 8*1024*1024 {
			t.Fatalf("expected uploads.maxBytes 8388608, got %d", got)
		}
	})
}

func TestOwnerNotificationReadMarksMessageWithoutHidingIt(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		token := seedUnlimitedOwnerSession(t)
		messageID := seedOwnerNotificationMessage(t, "guest", guestbookChannelMain, "please read me")

		req := httptest.NewRequest(
			http.MethodPatch,
			"/api/owner/notifications/"+strconv.FormatInt(messageID, 10)+"/read",
			nil,
		)
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
		rr := httptest.NewRecorder()

		ownerRouter(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
		}

		var status, ownerReadAt string
		if err := db.QueryRow(
			`SELECT status, owner_read_at FROM guestbook_messages WHERE id = ?`,
			messageID,
		).Scan(&status, &ownerReadAt); err != nil {
			t.Fatalf("read message status: %v", err)
		}
		if status != "visible" {
			t.Fatalf("expected public status to remain visible, got %q", status)
		}
		if ownerReadAt == "" {
			t.Fatalf("expected owner_read_at to be set after read")
		}
	})
}

func TestOwnerDraftCreateAndList(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		token := seedUnlimitedOwnerSession(t)

		createReq := httptest.NewRequest(
			http.MethodPost,
			"/api/owner/drafts",
			bytes.NewBufferString(`{"kind":"article","title":"Owner draft","body":"hello markdown","status":"draft"}`),
		)
		createReq.Header.Set("Content-Type", "application/json")
		createReq.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
		createRR := httptest.NewRecorder()

		ownerRouter(createRR, createReq)

		if createRR.Code != http.StatusOK {
			t.Fatalf("expected 200 from create draft, got %d body=%s", createRR.Code, createRR.Body.String())
		}

		listReq := httptest.NewRequest(http.MethodGet, "/api/owner/drafts", nil)
		listReq.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
		listRR := httptest.NewRecorder()

		ownerRouter(listRR, listReq)

		if listRR.Code != http.StatusOK {
			t.Fatalf("expected 200 from list drafts, got %d body=%s", listRR.Code, listRR.Body.String())
		}

		payload := decodeOwnerJSONMap(t, listRR)
		if got := int(payload["total"].(float64)); got != 1 {
			t.Fatalf("expected 1 draft, got %d", got)
		}
		items := payload["items"].([]any)
		first := items[0].(map[string]any)
		if first["title"].(string) != "Owner draft" {
			t.Fatalf("expected draft title %q, got %#v", "Owner draft", first["title"])
		}
	})
}

func TestOwnerUploadRejectsAnonymous(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		req := httptest.NewRequest(http.MethodPost, "/api/owner/uploads", bytes.NewBuffer(nil))
		rr := httptest.NewRecorder()

		ownerRouter(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d body=%s", rr.Code, rr.Body.String())
		}
	})
}

func TestOwnerUploadSavesImageForOwner(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		t.Setenv("ACG_DATA_DIR", t.TempDir())
		token := seedUnlimitedOwnerSession(t)

		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		part, err := writer.CreateFormFile("file", "tiny.png")
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write(validTinyPNGBytes()); err != nil {
			t.Fatal(err)
		}
		if err := writer.Close(); err != nil {
			t.Fatal(err)
		}

		req := httptest.NewRequest(http.MethodPost, "/api/owner/uploads", &body)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
		rr := httptest.NewRecorder()

		ownerRouter(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
		}

		payload := decodeOwnerJSONMap(t, rr)
		item := payload["item"].(map[string]any)
		url := item["url"].(string)
		if !strings.HasPrefix(url, "/api/owner/uploads/") {
			t.Fatalf("expected upload url prefix, got %q", url)
		}

		name := filepath.Base(url)
		if _, err := os.Stat(filepath.Join(t.TempDir(), name)); err == nil {
			t.Fatalf("unexpected file in unrelated temp dir")
		}

		target := filepath.Join(ownerUploadsDir(), name)
		if _, err := os.Stat(target); err != nil {
			t.Fatalf("expected uploaded file at %s: %v", target, err)
		}
	})
}

func TestOwnerAssetUploadRejectsMissingAlbumForGallery(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		token := seedUnlimitedOwnerSession(t)

		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		part, err := writer.CreateFormFile("file", "tiny.png")
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write(validTinyPNGBytes()); err != nil {
			t.Fatal(err)
		}
		if err := writer.WriteField("kind", "gallery"); err != nil {
			t.Fatal(err)
		}
		if err := writer.Close(); err != nil {
			t.Fatal(err)
		}

		req := httptest.NewRequest(http.MethodPost, "/api/owner/assets", &body)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
		rr := httptest.NewRecorder()

		ownerRouter(rr, req)

		if rr.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d body=%s", rr.Code, rr.Body.String())
		}
	})
}

func TestOwnerAssetUploadRejectsWhenCOSNotConfigured(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		token := seedUnlimitedOwnerSession(t)

		var body bytes.Buffer
		writer := multipart.NewWriter(&body)
		part, err := writer.CreateFormFile("file", "tiny.png")
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write(validTinyPNGBytes()); err != nil {
			t.Fatal(err)
		}
		if err := writer.WriteField("kind", "article"); err != nil {
			t.Fatal(err)
		}
		if err := writer.Close(); err != nil {
			t.Fatal(err)
		}

		req := httptest.NewRequest(http.MethodPost, "/api/owner/assets", &body)
		req.Header.Set("Content-Type", writer.FormDataContentType())
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
		rr := httptest.NewRecorder()

		ownerRouter(rr, req)

		if rr.Code != http.StatusServiceUnavailable {
			t.Fatalf("expected 503, got %d body=%s", rr.Code, rr.Body.String())
		}
	})
}

func TestOwnerAssetUploadStoresGalleryImageInCOS(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		token := seedUnlimitedOwnerSession(t)
		withOwnerAssetUploader(t, fakeOwnerAssetUploader{
			result: ownerCOSUploadResult{
				ObjectKey: "gallery/misaka/20260607-010203-uuid.png",
				URL:       "https://cdn.example/gallery/misaka/20260607-010203-uuid.png",
				MIMEType:  "image/png",
				Size:      68,
			},
		}, func() {
			var body bytes.Buffer
			writer := multipart.NewWriter(&body)
			part, err := writer.CreateFormFile("file", "tiny.png")
			if err != nil {
				t.Fatal(err)
			}
			if _, err := part.Write(validTinyPNGBytes()); err != nil {
				t.Fatal(err)
			}
			if err := writer.WriteField("kind", "gallery"); err != nil {
				t.Fatal(err)
			}
			if err := writer.WriteField("album", "Misaka"); err != nil {
				t.Fatal(err)
			}
			if err := writer.Close(); err != nil {
				t.Fatal(err)
			}

			req := httptest.NewRequest(http.MethodPost, "/api/owner/assets", &body)
			req.Header.Set("Content-Type", writer.FormDataContentType())
			req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
			rr := httptest.NewRecorder()

			ownerRouter(rr, req)

			if rr.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
			}

			payload := decodeOwnerJSONMap(t, rr)
			item := payload["item"].(map[string]any)
			if item["path"] != "gallery/misaka/20260607-010203-uuid.png" {
				t.Fatalf("unexpected object key: %#v", item["path"])
			}
			if item["url"] != "https://cdn.example/gallery/misaka/20260607-010203-uuid.png" {
				t.Fatalf("unexpected url: %#v", item["url"])
			}
		})
	})
}

func TestOwnerAssetUploadStoresArticleImageInCOS(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		token := seedUnlimitedOwnerSession(t)
		withOwnerAssetUploader(t, fakeOwnerAssetUploader{
			result: ownerCOSUploadResult{
				ObjectKey: "articles/2026/06/20260607-010203-uuid.png",
				URL:       "https://cdn.example/articles/2026/06/20260607-010203-uuid.png",
				MIMEType:  "image/png",
				Size:      68,
			},
		}, func() {
			var body bytes.Buffer
			writer := multipart.NewWriter(&body)
			part, err := writer.CreateFormFile("file", "tiny.png")
			if err != nil {
				t.Fatal(err)
			}
			if _, err := part.Write(validTinyPNGBytes()); err != nil {
				t.Fatal(err)
			}
			if err := writer.WriteField("kind", "article"); err != nil {
				t.Fatal(err)
			}
			if err := writer.Close(); err != nil {
				t.Fatal(err)
			}

			req := httptest.NewRequest(http.MethodPost, "/api/owner/assets", &body)
			req.Header.Set("Content-Type", writer.FormDataContentType())
			req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
			rr := httptest.NewRecorder()

			ownerRouter(rr, req)

			if rr.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
			}

			payload := decodeOwnerJSONMap(t, rr)
			item := payload["item"].(map[string]any)
			if item["path"] != "articles/2026/06/20260607-010203-uuid.png" {
				t.Fatalf("unexpected object key: %#v", item["path"])
			}
			if item["kind"] != "article" {
				t.Fatalf("unexpected kind: %#v", item["kind"])
			}
		})
	})
}

func TestOwnerAssetUploadReturnsBadGatewayWhenUploaderFails(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		token := seedUnlimitedOwnerSession(t)
		withOwnerAssetUploader(t, fakeOwnerAssetUploader{
			err: errors.New("upload failed"),
		}, func() {
			var body bytes.Buffer
			writer := multipart.NewWriter(&body)
			part, err := writer.CreateFormFile("file", "tiny.png")
			if err != nil {
				t.Fatal(err)
			}
			if _, err := part.Write(validTinyPNGBytes()); err != nil {
				t.Fatal(err)
			}
			if err := writer.WriteField("kind", "article"); err != nil {
				t.Fatal(err)
			}
			if err := writer.Close(); err != nil {
				t.Fatal(err)
			}

			req := httptest.NewRequest(http.MethodPost, "/api/owner/assets", &body)
			req.Header.Set("Content-Type", writer.FormDataContentType())
			req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
			rr := httptest.NewRecorder()

			ownerRouter(rr, req)

			if rr.Code != http.StatusBadGateway {
				t.Fatalf("expected 502, got %d body=%s", rr.Code, rr.Body.String())
			}
		})
	})
}

func TestOwnerPublishRequiresOwnerSession(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		req := httptest.NewRequest(http.MethodPost, "/api/owner/publish", bytes.NewBufferString(`{}`))
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()

		ownerRouter(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401, got %d body=%s", rr.Code, rr.Body.String())
		}
	})
}

func TestOwnerPublishWritesMarkdownViaGitHubContentsAPI(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		token := seedUnlimitedOwnerSession(t)
		var (
			gotMethod string
			gotPath   string
			gotAuth   string
			gotBody   map[string]any
		)
		github := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			gotMethod = r.Method
			gotPath = r.URL.Path
			gotAuth = r.Header.Get("Authorization")
			defer r.Body.Close()
			if err := json.NewDecoder(r.Body).Decode(&gotBody); err != nil {
				t.Fatalf("decode github request: %v", err)
			}
			writeJSON(w, map[string]any{
				"content": map[string]any{
					"path": "blog/source/_posts/test-owner-publish.md",
					"sha":  "new-sha",
				},
				"commit": map[string]any{
					"sha": "commit-sha",
				},
			})
		}))
		defer github.Close()

		t.Setenv("OWNER_PUBLISH_GITHUB_API_BASE", github.URL)
		t.Setenv("OWNER_PUBLISH_GITHUB_OWNER", "octo")
		t.Setenv("OWNER_PUBLISH_GITHUB_REPO", "taozhiyy")
		t.Setenv("OWNER_PUBLISH_GITHUB_BRANCH", "master")
		t.Setenv("OWNER_PUBLISH_GITHUB_TOKEN", "secret-token")

		req := httptest.NewRequest(
			http.MethodPost,
			"/api/owner/publish",
			bytes.NewBufferString(`{"title":"Test Owner Publish","body":"# Hello publish\n\ncontent","coverUrl":"https://img.example/cover.png"}`),
		)
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
		rr := httptest.NewRecorder()

		ownerRouter(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
		}

		if gotMethod != http.MethodPut {
			t.Fatalf("expected github PUT, got %q", gotMethod)
		}
		if gotPath != "/repos/octo/taozhiyy/contents/blog/source/_posts/test-owner-publish.md" {
			t.Fatalf("unexpected github path: %q", gotPath)
		}
		if gotAuth != "Bearer secret-token" {
			t.Fatalf("expected bearer token auth, got %q", gotAuth)
		}

		if gotBody["branch"] != "master" {
			t.Fatalf("expected master branch, got %#v", gotBody["branch"])
		}
		if gotBody["message"] != "feat: publish Test Owner Publish" {
			t.Fatalf("unexpected commit message: %#v", gotBody["message"])
		}
		contentRaw, ok := gotBody["content"].(string)
		if !ok || contentRaw == "" {
			t.Fatalf("expected base64 content payload, got %#v", gotBody["content"])
		}

		markdown, err := decodeBase64String(contentRaw)
		if err != nil {
			t.Fatalf("decode base64 markdown: %v", err)
		}
		if !strings.Contains(markdown, "title: Test Owner Publish") {
			t.Fatalf("expected title front matter in markdown, got %q", markdown)
		}
		if !strings.Contains(markdown, "cover: https://img.example/cover.png") {
			t.Fatalf("expected cover front matter in markdown, got %q", markdown)
		}
		if !strings.Contains(markdown, "# Hello publish") {
			t.Fatalf("expected body content in markdown, got %q", markdown)
		}

		payload := decodeOwnerJSONMap(t, rr)
		item := payload["item"].(map[string]any)
		if item["path"] != "blog/source/_posts/test-owner-publish.md" {
			t.Fatalf("unexpected publish path: %#v", item["path"])
		}
		if item["commitSha"] != "commit-sha" {
			t.Fatalf("unexpected commit sha: %#v", item["commitSha"])
		}
	})
}

func TestOwnerPublishNormalizesDefaultBranchCase(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		token := seedUnlimitedOwnerSession(t)
		var gotBody map[string]any
		github := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer r.Body.Close()
			if err := json.NewDecoder(r.Body).Decode(&gotBody); err != nil {
				t.Fatalf("decode github request: %v", err)
			}
			writeJSON(w, map[string]any{
				"content": map[string]any{
					"path": "blog/source/_posts/test-owner-publish.md",
				},
				"commit": map[string]any{
					"sha": "commit-sha",
				},
			})
		}))
		defer github.Close()

		t.Setenv("OWNER_PUBLISH_GITHUB_API_BASE", github.URL)
		t.Setenv("OWNER_PUBLISH_GITHUB_OWNER", "octo")
		t.Setenv("OWNER_PUBLISH_GITHUB_REPO", "taozhiyy")
		t.Setenv("OWNER_PUBLISH_GITHUB_BRANCH", "MASTER")
		t.Setenv("OWNER_PUBLISH_GITHUB_TOKEN", "secret-token")

		req := httptest.NewRequest(
			http.MethodPost,
			"/api/owner/publish",
			bytes.NewBufferString(`{"title":"Test Owner Publish","body":"# Hello publish\n\ncontent"}`),
		)
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
		rr := httptest.NewRecorder()

		ownerRouter(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
		}
		if gotBody["branch"] != "master" {
			t.Fatalf("expected normalized master branch, got %#v", gotBody["branch"])
		}

		payload := decodeOwnerJSONMap(t, rr)
		item := payload["item"].(map[string]any)
		if item["branch"] != "master" {
			t.Fatalf("expected normalized branch in response, got %#v", item["branch"])
		}
	})
}

func TestOwnerGalleryPublishWritesGalleryDataViaGitHubContentsAPI(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		token := seedUnlimitedOwnerSession(t)
		var (
			gotMethods []string
			gotPaths   []string
			gotAuths   []string
			gotPutBody map[string]any
		)
		github := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			gotMethods = append(gotMethods, r.Method)
			gotPaths = append(gotPaths, r.URL.RequestURI())
			gotAuths = append(gotAuths, r.Header.Get("Authorization"))
			defer r.Body.Close()

			switch r.Method {
			case http.MethodGet:
				if r.URL.Path != "/repos/octo/taozhiyy/contents/main/src/data/galleryAlbums.js" {
					t.Fatalf("unexpected github GET path: %q", r.URL.RequestURI())
				}
				if r.URL.Query().Get("ref") != "master" {
					t.Fatalf("expected master ref, got %q", r.URL.Query().Get("ref"))
				}
				writeJSON(w, map[string]any{
					"path":     "main/src/data/galleryAlbums.js",
					"sha":      "gallery-sha",
					"encoding": "base64",
					"content":  base64.StdEncoding.EncodeToString([]byte(ownerGalleryDataFixture)),
				})
			case http.MethodPut:
				if r.URL.Path != "/repos/octo/taozhiyy/contents/main/src/data/galleryAlbums.js" {
					t.Fatalf("unexpected github PUT path: %q", r.URL.RequestURI())
				}
				if err := json.NewDecoder(r.Body).Decode(&gotPutBody); err != nil {
					t.Fatalf("decode github put request: %v", err)
				}
				writeJSON(w, map[string]any{
					"content": map[string]any{
						"path": "main/src/data/galleryAlbums.js",
						"sha":  "new-gallery-sha",
					},
					"commit": map[string]any{
						"sha": "gallery-commit-sha",
					},
				})
			default:
				t.Fatalf("unexpected github method: %s", r.Method)
			}
		}))
		defer github.Close()

		t.Setenv("OWNER_PUBLISH_GITHUB_API_BASE", github.URL)
		t.Setenv("OWNER_PUBLISH_GITHUB_OWNER", "octo")
		t.Setenv("OWNER_PUBLISH_GITHUB_REPO", "taozhiyy")
		t.Setenv("OWNER_PUBLISH_GITHUB_BRANCH", "master")
		t.Setenv("OWNER_PUBLISH_GITHUB_TOKEN", "secret-token")

		req := httptest.NewRequest(
			http.MethodPost,
			"/api/owner/gallery/images",
			bytes.NewBufferString(`{"albumId":"misaka","imageUrl":"https://cdn.example/new.jpg"}`),
		)
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
		rr := httptest.NewRecorder()

		ownerRouter(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
		}
		if strings.Join(gotMethods, ",") != "GET,PUT" {
			t.Fatalf("expected github GET then PUT, got methods=%v paths=%v", gotMethods, gotPaths)
		}
		for _, auth := range gotAuths {
			if auth != "Bearer secret-token" {
				t.Fatalf("expected bearer token auth, got %q", auth)
			}
		}
		if gotPutBody["branch"] != "master" {
			t.Fatalf("expected master branch, got %#v", gotPutBody["branch"])
		}
		if gotPutBody["sha"] != "gallery-sha" {
			t.Fatalf("expected existing file sha, got %#v", gotPutBody["sha"])
		}
		message, ok := gotPutBody["message"].(string)
		if !ok || !strings.Contains(message, "feat: publish gallery image to misaka") {
			t.Fatalf("unexpected commit message: %#v", gotPutBody["message"])
		}
		contentRaw, ok := gotPutBody["content"].(string)
		if !ok || contentRaw == "" {
			t.Fatalf("expected base64 content payload, got %#v", gotPutBody["content"])
		}
		updated, err := decodeBase64String(contentRaw)
		if err != nil {
			t.Fatalf("decode base64 gallery data: %v", err)
		}
		if !strings.Contains(updated, `"https://cdn.example/new.jpg",`) {
			t.Fatalf("expected published image in gallery data, got %q", updated)
		}

		payload := decodeOwnerJSONMap(t, rr)
		item := payload["item"].(map[string]any)
		if item["albumId"] != "misaka" {
			t.Fatalf("unexpected album id: %#v", item["albumId"])
		}
		if item["path"] != "main/src/data/galleryAlbums.js" {
			t.Fatalf("unexpected publish path: %#v", item["path"])
		}
		if item["commitSha"] != "gallery-commit-sha" {
			t.Fatalf("unexpected commit sha: %#v", item["commitSha"])
		}
	})
}

func TestOwnerFriendPublishWritesFriendCardsViaGitHubContentsAPI(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		token := seedUnlimitedOwnerSession(t)
		var (
			gotMethods []string
			gotPaths   []string
			gotPutBody map[string]any
		)
		github := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			gotMethods = append(gotMethods, r.Method)
			gotPaths = append(gotPaths, r.URL.RequestURI())
			defer r.Body.Close()

			switch r.Method {
			case http.MethodGet:
				if r.URL.Path != "/repos/octo/taozhiyy/contents/main/src/data/friendCards.js" {
					t.Fatalf("unexpected github GET path: %q", r.URL.RequestURI())
				}
				writeJSON(w, map[string]any{
					"path":     "main/src/data/friendCards.js",
					"sha":      "friends-sha",
					"encoding": "base64",
					"content": base64.StdEncoding.EncodeToString([]byte(`export const friendCards = [
  {
    name: "KoBariDev",
    desc: "Ciallo",
    url: "https://hub.131714.xyz/",
    avatar: "https://cdn.example/kobari.png",
    note: "FRIEND",
  },
];
`)),
				})
			case http.MethodPut:
				if r.URL.Path != "/repos/octo/taozhiyy/contents/main/src/data/friendCards.js" {
					t.Fatalf("unexpected github PUT path: %q", r.URL.RequestURI())
				}
				if err := json.NewDecoder(r.Body).Decode(&gotPutBody); err != nil {
					t.Fatalf("decode github put request: %v", err)
				}
				writeJSON(w, map[string]any{
					"content": map[string]any{
						"path": "main/src/data/friendCards.js",
						"sha":  "new-friends-sha",
					},
					"commit": map[string]any{
						"sha": "friend-commit-sha",
					},
				})
			default:
				t.Fatalf("unexpected github method: %s", r.Method)
			}
		}))
		defer github.Close()

		t.Setenv("OWNER_PUBLISH_GITHUB_API_BASE", github.URL)
		t.Setenv("OWNER_PUBLISH_GITHUB_OWNER", "octo")
		t.Setenv("OWNER_PUBLISH_GITHUB_REPO", "taozhiyy")
		t.Setenv("OWNER_PUBLISH_GITHUB_BRANCH", "master")
		t.Setenv("OWNER_PUBLISH_GITHUB_TOKEN", "secret-token")

		req := httptest.NewRequest(
			http.MethodPost,
			"/api/owner/friends",
			bytes.NewBufferString(`{"name":"Example Friend","desc":"A readable friend card","url":"https://friend.example","avatar":"https://friend.example/avatar.png"}`),
		)
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
		rr := httptest.NewRecorder()

		ownerRouter(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
		}
		if strings.Join(gotMethods, ",") != "GET,PUT" {
			t.Fatalf("expected github GET then PUT, got methods=%v paths=%v", gotMethods, gotPaths)
		}
		if gotPutBody["branch"] != "master" {
			t.Fatalf("expected master branch, got %#v", gotPutBody["branch"])
		}
		if gotPutBody["sha"] != "friends-sha" {
			t.Fatalf("expected existing file sha, got %#v", gotPutBody["sha"])
		}
		contentRaw, ok := gotPutBody["content"].(string)
		if !ok || contentRaw == "" {
			t.Fatalf("expected base64 content payload, got %#v", gotPutBody["content"])
		}
		updated, err := decodeBase64String(contentRaw)
		if err != nil {
			t.Fatalf("decode base64 friend data: %v", err)
		}
		if !strings.Contains(updated, `name: "Example Friend"`) {
			t.Fatalf("expected friend name in updated data, got %q", updated)
		}
		if !strings.Contains(updated, `url: "https://friend.example"`) {
			t.Fatalf("expected friend url in updated data, got %q", updated)
		}

		payload := decodeOwnerJSONMap(t, rr)
		item := payload["item"].(map[string]any)
		if item["path"] != "main/src/data/friendCards.js" {
			t.Fatalf("unexpected publish path: %#v", item["path"])
		}
		if item["commitSha"] != "friend-commit-sha" {
			t.Fatalf("unexpected commit sha: %#v", item["commitSha"])
		}
	})
}

func TestOwnerMomentPublishWritesMomentsDataViaGitHubContentsAPI(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		token := seedUnlimitedOwnerSession(t)
		var (
			gotMethods []string
			gotPaths   []string
			gotPutBody map[string]any
		)
		github := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			gotMethods = append(gotMethods, r.Method)
			gotPaths = append(gotPaths, r.URL.RequestURI())
			defer r.Body.Close()

			switch r.Method {
			case http.MethodGet:
				if r.URL.Path != "/repos/octo/taozhiyy/contents/main/src/data/moments.js" {
					t.Fatalf("unexpected github GET path: %q", r.URL.RequestURI())
				}
				writeJSON(w, map[string]any{
					"path":     "main/src/data/moments.js",
					"sha":      "moments-sha",
					"encoding": "base64",
					"content": base64.StdEncoding.EncodeToString([]byte(`export const moments = [
  {
    year: "2026",
    date: "6.8",
    type: "心事",
    tone: "aurora",
    module: "postcard",
    lines: ["一滴泪真正的重量取决于它落在谁的心上"],
  },
];
`)),
				})
			case http.MethodPut:
				if r.URL.Path != "/repos/octo/taozhiyy/contents/main/src/data/moments.js" {
					t.Fatalf("unexpected github PUT path: %q", r.URL.RequestURI())
				}
				if err := json.NewDecoder(r.Body).Decode(&gotPutBody); err != nil {
					t.Fatalf("decode github put request: %v", err)
				}
				writeJSON(w, map[string]any{
					"content": map[string]any{
						"path": "main/src/data/moments.js",
						"sha":  "new-moments-sha",
					},
					"commit": map[string]any{
						"sha": "moment-commit-sha",
					},
				})
			default:
				t.Fatalf("unexpected github method: %s", r.Method)
			}
		}))
		defer github.Close()

		t.Setenv("OWNER_PUBLISH_GITHUB_API_BASE", github.URL)
		t.Setenv("OWNER_PUBLISH_GITHUB_OWNER", "octo")
		t.Setenv("OWNER_PUBLISH_GITHUB_REPO", "taozhiyy")
		t.Setenv("OWNER_PUBLISH_GITHUB_BRANCH", "master")
		t.Setenv("OWNER_PUBLISH_GITHUB_TOKEN", "secret-token")

		req := httptest.NewRequest(
			http.MethodPost,
			"/api/owner/moments",
			bytes.NewBufferString(`{"year":"2027","date":"1.1","type":"碎碎念","content":"今天也想把小碎片写下来\n第二行"}`),
		)
		req.Header.Set("Content-Type", "application/json")
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
		rr := httptest.NewRecorder()

		ownerRouter(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
		}
		if strings.Join(gotMethods, ",") != "GET,PUT" {
			t.Fatalf("expected github GET then PUT, got methods=%v paths=%v", gotMethods, gotPaths)
		}
		if gotPutBody["branch"] != "master" {
			t.Fatalf("expected master branch, got %#v", gotPutBody["branch"])
		}
		if gotPutBody["sha"] != "moments-sha" {
			t.Fatalf("expected existing file sha, got %#v", gotPutBody["sha"])
		}
		contentRaw, ok := gotPutBody["content"].(string)
		if !ok || contentRaw == "" {
			t.Fatalf("expected base64 content payload, got %#v", gotPutBody["content"])
		}
		updated, err := decodeBase64String(contentRaw)
		if err != nil {
			t.Fatalf("decode base64 moments data: %v", err)
		}
		if !strings.Contains(updated, `year: "2027"`) {
			t.Fatalf("expected new moment year in updated data, got %q", updated)
		}
		if !strings.Contains(updated, `date: "1.1"`) {
			t.Fatalf("expected new moment date in updated data, got %q", updated)
		}
		if !strings.Contains(updated, `type: "碎碎念"`) {
			t.Fatalf("expected new moment type in updated data, got %q", updated)
		}
		if !strings.Contains(updated, `lines: ["今天也想把小碎片写下来", "第二行"]`) {
			t.Fatalf("expected split moment lines in updated data, got %q", updated)
		}
		if strings.Index(updated, `year: "2027"`) > strings.Index(updated, `year: "2026"`) {
			t.Fatalf("expected newest published moment before existing moments, got %q", updated)
		}

		payload := decodeOwnerJSONMap(t, rr)
		item := payload["item"].(map[string]any)
		if item["path"] != "main/src/data/moments.js" {
			t.Fatalf("unexpected publish path: %#v", item["path"])
		}
		if item["commitSha"] != "moment-commit-sha" {
			t.Fatalf("unexpected commit sha: %#v", item["commitSha"])
		}
	})
}
