package main

import (
	"bytes"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
)

type securityAuditLogRow struct {
	Event       string
	Outcome     string
	ActorUserID int64
	TargetType  string
	TargetID    string
	Detail      string
}

func latestSecurityAuditLog(t *testing.T) securityAuditLogRow {
	t.Helper()
	var row securityAuditLogRow
	if err := db.QueryRow(
		`SELECT event, outcome, actor_user_id, target_type, target_id, detail
		 FROM security_audit_logs ORDER BY id DESC LIMIT 1`,
	).Scan(&row.Event, &row.Outcome, &row.ActorUserID, &row.TargetType, &row.TargetID, &row.Detail); err != nil {
		t.Fatalf("load latest security audit log: %v", err)
	}
	return row
}

func TestOwnerLoginFailureWritesSecurityAuditLog(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		req := httptest.NewRequest(
			http.MethodPost,
			"/api/auth/login",
			bytes.NewBufferString(`{"email":"173236231@qq.com","password":"wrong-password"}`),
		)
		req.Header.Set("Content-Type", "application/json")
		req.RemoteAddr = "203.0.113.10:1234"
		req.Header.Set("User-Agent", "audit-test")
		rr := httptest.NewRecorder()

		authHandler(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401 for failed owner login, got %d body=%s", rr.Code, rr.Body.String())
		}
		got := latestSecurityAuditLog(t)
		if got.Event != "owner.login" || got.Outcome != "failure" {
			t.Fatalf("unexpected audit event/outcome: %#v", got)
		}
		if got.TargetType != "owner" {
			t.Fatalf("expected owner target type, got %#v", got)
		}
		if strings.Contains(got.Detail, "wrong-password") {
			t.Fatalf("audit detail must not include submitted password: %#v", got.Detail)
		}
	})
}

func TestOwnerSecurityVerifyFailureWritesSecurityAuditLog(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		t.Setenv("AUTH_OWNER_SECURITY_ANSWER", "correct-answer")
		ownerID := seedOwnerControllerUser(t, "173236231@qq.com", true)
		challenge, err := createLoginChallenge(ownerID)
		if err != nil {
			t.Fatalf("create challenge: %v", err)
		}

		req := httptest.NewRequest(
			http.MethodPost,
			"/api/auth/verify-security",
			bytes.NewBufferString(`{"challengeToken":"`+challenge+`","answer":"wrong-answer"}`),
		)
		req.Header.Set("Content-Type", "application/json")
		req.RemoteAddr = "203.0.113.11:1234"
		req.Header.Set("User-Agent", "audit-test")
		rr := httptest.NewRecorder()

		authHandler(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401 for wrong security answer, got %d body=%s", rr.Code, rr.Body.String())
		}
		got := latestSecurityAuditLog(t)
		if got.Event != "owner.security_verify" || got.Outcome != "failure" {
			t.Fatalf("unexpected audit event/outcome: %#v", got)
		}
		if got.ActorUserID != ownerID {
			t.Fatalf("expected owner user id %d, got %d", ownerID, got.ActorUserID)
		}
		if strings.Contains(got.Detail, "wrong-answer") || strings.Contains(got.Detail, challenge) {
			t.Fatalf("audit detail must not include submitted answer or challenge token: %#v", got.Detail)
		}
	})
}

func TestGuestbookAdminStatusChangeWritesSecurityAuditLog(t *testing.T) {
	withGuestbookTestDB(t, func() {
		created := seedGuestbookMessage(t, `{"nickname":"Probe","content":"please hide me"}`, "203.0.113.20:1234")
		messageID := int64(created["item"].(map[string]any)["id"].(float64))
		ownerID := seedGuestbookTestUser(t, "owner@example.com", "Owner", true)
		sessionToken := seedGuestbookTestSession(t, ownerID, true)

		req := httptest.NewRequest(
			http.MethodPatch,
			"/api/guestbook/messages/"+strconv.FormatInt(messageID, 10)+"/status",
			bytes.NewBufferString(`{"status":"hidden"}`),
		)
		req.Header.Set("Content-Type", "application/json")
		req.RemoteAddr = "203.0.113.21:1234"
		req.Header.Set("User-Agent", "audit-test")
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: sessionToken})
		rr := httptest.NewRecorder()

		guestbookRouter(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 for owner status change, got %d body=%s", rr.Code, rr.Body.String())
		}
		got := latestSecurityAuditLog(t)
		if got.Event != "guestbook.status_change" || got.Outcome != "success" {
			t.Fatalf("unexpected audit event/outcome: %#v", got)
		}
		if got.ActorUserID != ownerID || got.TargetType != "guestbook_message" || got.TargetID != strconv.FormatInt(messageID, 10) {
			t.Fatalf("unexpected audit actor/target: %#v", got)
		}
		if !strings.Contains(got.Detail, "hidden") {
			t.Fatalf("expected hidden status in audit detail, got %#v", got.Detail)
		}
	})
}

func TestGuestbookAdminDeleteWritesSecurityAuditLog(t *testing.T) {
	withGuestbookTestDB(t, func() {
		created := seedGuestbookMessage(t, `{"nickname":"Probe","content":"please delete me"}`, "203.0.113.30:1234")
		messageID := int64(created["item"].(map[string]any)["id"].(float64))
		ownerID := seedGuestbookTestUser(t, "owner@example.com", "Owner", true)
		sessionToken := seedGuestbookTestSession(t, ownerID, true)

		req := httptest.NewRequest(
			http.MethodDelete,
			"/api/guestbook/messages/"+strconv.FormatInt(messageID, 10),
			nil,
		)
		req.RemoteAddr = "203.0.113.31:1234"
		req.Header.Set("User-Agent", "audit-test")
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: sessionToken})
		rr := httptest.NewRecorder()

		guestbookRouter(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 for owner delete, got %d body=%s", rr.Code, rr.Body.String())
		}
		got := latestSecurityAuditLog(t)
		if got.Event != "guestbook.delete" || got.Outcome != "success" {
			t.Fatalf("unexpected audit event/outcome: %#v", got)
		}
		if got.ActorUserID != ownerID || got.TargetType != "guestbook_message" || got.TargetID != strconv.FormatInt(messageID, 10) {
			t.Fatalf("unexpected audit actor/target: %#v", got)
		}
		if strings.Contains(got.Detail, "please delete me") {
			t.Fatalf("audit detail must not include deleted message body: %#v", got.Detail)
		}
	})
}

func TestOwnerPublishSuccessWritesSecurityAuditLog(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		ownerID := seedOwnerControllerUser(t, "173236231@qq.com", true)
		token := seedOwnerControllerSession(t, ownerID, true)
		github := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer r.Body.Close()
			if r.Header.Get("Authorization") != "Bearer secret-token" {
				t.Fatalf("expected bearer token auth, got %q", r.Header.Get("Authorization"))
			}
			writeJSON(w, map[string]any{
				"content": map[string]any{
					"path": "blog/source/_posts/security-audit-post.md",
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
			bytes.NewBufferString(`{"title":"Security Audit Post","body":"# Secret draft body\n\nkeep this out of audit"}`),
		)
		req.Header.Set("Content-Type", "application/json")
		req.RemoteAddr = "203.0.113.40:1234"
		req.Header.Set("User-Agent", "audit-test")
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
		rr := httptest.NewRecorder()

		ownerRouter(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 for owner publish, got %d body=%s", rr.Code, rr.Body.String())
		}
		got := latestSecurityAuditLog(t)
		if got.Event != "owner.publish" || got.Outcome != "success" {
			t.Fatalf("unexpected audit event/outcome: %#v", got)
		}
		if got.ActorUserID != ownerID || got.TargetType != "owner_publish" || got.TargetID != "blog/source/_posts/security-audit-post.md" {
			t.Fatalf("unexpected audit actor/target: %#v", got)
		}
		if strings.Contains(got.Detail, "Secret draft body") || strings.Contains(got.Detail, "secret-token") {
			t.Fatalf("audit detail must not include markdown body or token: %#v", got.Detail)
		}
	})
}

func TestOwnerPublishFailureWritesSecurityAuditLog(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		ownerID := seedOwnerControllerUser(t, "173236231@qq.com", true)
		token := seedOwnerControllerSession(t, ownerID, true)
		t.Setenv("OWNER_PUBLISH_GITHUB_TOKEN", "")

		req := httptest.NewRequest(
			http.MethodPost,
			"/api/owner/publish",
			bytes.NewBufferString(`{"title":"Private Title","body":"private body"}`),
		)
		req.Header.Set("Content-Type", "application/json")
		req.RemoteAddr = "203.0.113.41:1234"
		req.Header.Set("User-Agent", "audit-test")
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
		rr := httptest.NewRecorder()

		ownerRouter(rr, req)

		if rr.Code != http.StatusServiceUnavailable {
			t.Fatalf("expected 503 for missing publish config, got %d body=%s", rr.Code, rr.Body.String())
		}
		got := latestSecurityAuditLog(t)
		if got.Event != "owner.publish" || got.Outcome != "failure" {
			t.Fatalf("unexpected audit event/outcome: %#v", got)
		}
		if got.ActorUserID != ownerID || got.TargetType != "owner_publish" {
			t.Fatalf("unexpected audit actor/target: %#v", got)
		}
		if !strings.Contains(got.Detail, "not_configured") {
			t.Fatalf("expected safe failure detail, got %#v", got.Detail)
		}
		if strings.Contains(got.Detail, "Private Title") || strings.Contains(got.Detail, "private body") {
			t.Fatalf("audit detail must not include publish title/body: %#v", got.Detail)
		}
	})
}

func TestOwnerFriendPublishSuccessWritesSecurityAuditLog(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		ownerID := seedOwnerControllerUser(t, "173236231@qq.com", true)
		token := seedOwnerControllerSession(t, ownerID, true)
		mockOwnerPublishGitHubFile(t, ownerFriendCardsDataPath, `export const friendCards = [
];
`)

		req := httptest.NewRequest(
			http.MethodPost,
			"/api/owner/friends",
			bytes.NewBufferString(`{"name":"Audit Friend","desc":"friend card","url":"https://friend.example","avatar":"https://friend.example/avatar.png"}`),
		)
		req.Header.Set("Content-Type", "application/json")
		req.RemoteAddr = "203.0.113.50:1234"
		req.Header.Set("User-Agent", "audit-test")
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
		rr := httptest.NewRecorder()

		ownerRouter(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 for friend publish, got %d body=%s", rr.Code, rr.Body.String())
		}
		got := latestSecurityAuditLog(t)
		if got.Event != "owner.friend_publish" || got.Outcome != "success" {
			t.Fatalf("unexpected audit event/outcome: %#v", got)
		}
		if got.ActorUserID != ownerID || got.TargetType != "owner_publish" || got.TargetID != ownerFriendCardsDataPath {
			t.Fatalf("unexpected audit actor/target: %#v", got)
		}
		if strings.Contains(got.Detail, "Audit Friend") || strings.Contains(got.Detail, "friend.example") {
			t.Fatalf("audit detail must not include friend card content: %#v", got.Detail)
		}
	})
}

func TestOwnerMomentPublishSuccessWritesSecurityAuditLog(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		ownerID := seedOwnerControllerUser(t, "173236231@qq.com", true)
		token := seedOwnerControllerSession(t, ownerID, true)
		mockOwnerPublishGitHubFile(t, ownerMomentsDataPath, `export const moments = [
];
`)

		req := httptest.NewRequest(
			http.MethodPost,
			"/api/owner/moments",
			bytes.NewBufferString(`{"year":"2027","date":"1.1","type":"audit","content":"private moment line"}`),
		)
		req.Header.Set("Content-Type", "application/json")
		req.RemoteAddr = "203.0.113.51:1234"
		req.Header.Set("User-Agent", "audit-test")
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
		rr := httptest.NewRecorder()

		ownerRouter(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 for moment publish, got %d body=%s", rr.Code, rr.Body.String())
		}
		got := latestSecurityAuditLog(t)
		if got.Event != "owner.moment_publish" || got.Outcome != "success" {
			t.Fatalf("unexpected audit event/outcome: %#v", got)
		}
		if got.ActorUserID != ownerID || got.TargetType != "owner_publish" || got.TargetID != ownerMomentsDataPath {
			t.Fatalf("unexpected audit actor/target: %#v", got)
		}
		if strings.Contains(got.Detail, "private moment line") || strings.Contains(got.Detail, "audit") {
			t.Fatalf("audit detail must not include moment content/type: %#v", got.Detail)
		}
	})
}

func TestOwnerGalleryPublishSuccessWritesSecurityAuditLog(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		ownerID := seedOwnerControllerUser(t, "173236231@qq.com", true)
		token := seedOwnerControllerSession(t, ownerID, true)
		mockOwnerPublishGitHubFile(t, ownerGalleryDataPath, `export const galleryAlbums = [
];
`)

		req := httptest.NewRequest(
			http.MethodPost,
			"/api/owner/gallery/images",
			bytes.NewBufferString(`{"albumId":"audit-album","imageUrl":"https://cdn.example/private.jpg"}`),
		)
		req.Header.Set("Content-Type", "application/json")
		req.RemoteAddr = "203.0.113.52:1234"
		req.Header.Set("User-Agent", "audit-test")
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
		rr := httptest.NewRecorder()

		ownerRouter(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 for gallery publish, got %d body=%s", rr.Code, rr.Body.String())
		}
		got := latestSecurityAuditLog(t)
		if got.Event != "owner.gallery_publish" || got.Outcome != "success" {
			t.Fatalf("unexpected audit event/outcome: %#v", got)
		}
		if got.ActorUserID != ownerID || got.TargetType != "owner_publish" || got.TargetID != ownerGalleryDataPath {
			t.Fatalf("unexpected audit actor/target: %#v", got)
		}
		if strings.Contains(got.Detail, "audit-album") || strings.Contains(got.Detail, "private.jpg") {
			t.Fatalf("audit detail must not include gallery album or image url: %#v", got.Detail)
		}
	})
}

func TestSecurityAuditDoesNotExposeRawIPOrUserAgent(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		req := httptest.NewRequest(http.MethodPost, "/audit", nil)
		req.RemoteAddr = "203.0.113.99:1234"
		req.Header.Set("User-Agent", "raw-user-agent")

		recordSecurityAudit(req, "test.event", "success", 0, "test", "1", "ok")

		var ipHash, uaHash string
		if err := db.QueryRow(
			`SELECT ip_hash, user_agent_hash FROM security_audit_logs ORDER BY id DESC LIMIT 1`,
		).Scan(&ipHash, &uaHash); err != nil {
			t.Fatalf("load audit hashes: %v", err)
		}
		if ipHash == "" || uaHash == "" {
			t.Fatalf("expected hashed ip and user agent")
		}
		if ipHash == "203.0.113.99" || uaHash == "raw-user-agent" {
			t.Fatalf("audit log stored raw request metadata")
		}
	})
}

func mockOwnerPublishGitHubFile(t *testing.T, path, source string) {
	t.Helper()
	github := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer r.Body.Close()
		wantPath := "/repos/octo/taozhiyy/contents/" + path
		if r.Header.Get("Authorization") != "Bearer secret-token" {
			t.Fatalf("expected bearer token auth, got %q", r.Header.Get("Authorization"))
		}

		if r.URL.Path == wantPath {
			switch r.Method {
			case http.MethodGet:
				writeJSON(w, map[string]any{
					"path":     path,
					"sha":      "existing-sha",
					"encoding": "base64",
					"content":  base64.StdEncoding.EncodeToString([]byte(source)),
				})
			case http.MethodPut:
				writeJSON(w, map[string]any{
					"content": map[string]any{
						"path": path,
						"sha":  "new-sha",
					},
					"commit": map[string]any{
						"sha": "commit-sha",
					},
				})
			default:
				t.Fatalf("unexpected github method for contents API: %s", r.Method)
			}
			return
		}

		if path != ownerFriendCardsDataPath {
			t.Fatalf("unexpected github path: got %q want %q", r.URL.Path, wantPath)
		}
		switch {
		case r.Method == http.MethodGet && r.URL.Path == "/repos/octo/taozhiyy/git/ref/heads/master":
			writeJSON(w, map[string]any{
				"ref": "refs/heads/master",
				"object": map[string]any{
					"sha": "master-head-sha",
				},
			})
		case r.Method == http.MethodPost && r.URL.Path == "/repos/octo/taozhiyy/git/refs":
			writeJSONStatus(w, http.StatusCreated, map[string]any{
				"ref":    "refs/heads/owner/friend-audit",
				"object": map[string]any{"sha": "master-head-sha"},
			})
		case r.Method == http.MethodPost && r.URL.Path == "/repos/octo/taozhiyy/pulls":
			writeJSONStatus(w, http.StatusCreated, map[string]any{
				"number":   42,
				"html_url": "https://github.com/octo/taozhiyy/pull/42",
			})
		default:
			t.Fatalf("unexpected github request: %s %s", r.Method, r.URL.Path)
		}
	}))
	t.Cleanup(github.Close)

	t.Setenv("OWNER_PUBLISH_GITHUB_API_BASE", github.URL)
	t.Setenv("OWNER_PUBLISH_GITHUB_OWNER", "octo")
	t.Setenv("OWNER_PUBLISH_GITHUB_REPO", "taozhiyy")
	t.Setenv("OWNER_PUBLISH_GITHUB_BRANCH", "master")
	t.Setenv("OWNER_PUBLISH_GITHUB_TOKEN", "secret-token")
}
