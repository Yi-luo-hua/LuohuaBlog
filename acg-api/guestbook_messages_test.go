package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/google/uuid"
	_ "modernc.org/sqlite"
)

func openGuestbookMessageTestDB(t *testing.T) *sql.DB {
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

func withGuestbookTestDB(t *testing.T, fn func()) {
	t.Helper()
	prev := db
	db = openGuestbookMessageTestDB(t)
	t.Cleanup(func() { db = prev })
	fn()
}

func decodeJSONMap(t *testing.T, rr *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var out map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &out); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	return out
}

func seedGuestbookMessage(t *testing.T, body string, remoteAddr string) map[string]any {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/guestbook/messages", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = remoteAddr
	rr := httptest.NewRecorder()
	guestbookCreateHandler(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("seed create failed: %d %s", rr.Code, rr.Body.String())
	}
	return decodeJSONMap(t, rr)
}

func seedGuestbookTestUser(t *testing.T, email, displayName string, isOwner bool) int64 {
	t.Helper()
	now := time.Now().UTC().Format(time.RFC3339)
	ownerFlag := 0
	if isOwner {
		ownerFlag = 1
	}
	res, err := db.Exec(
		`INSERT INTO users (email, display_name, password_hash, created_at, is_owner) VALUES (?, ?, 'hash', ?, ?)`,
		normalizeEmail(email),
		displayName,
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

func seedGuestbookTestSession(t *testing.T, userID int64, unlimited bool) string {
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

func postGuestbookMessageWithSession(t *testing.T, body, remoteAddr, sessionToken string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, "/api/guestbook/messages", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	req.RemoteAddr = remoteAddr
	if sessionToken != "" {
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: sessionToken})
	}
	rr := httptest.NewRecorder()
	guestbookCreateHandler(rr, req)
	return rr
}

func guestbookStoredContactEmail(t *testing.T, id int64) string {
	t.Helper()
	var email string
	if err := db.QueryRow(`SELECT contact_email FROM guestbook_messages WHERE id = ?`, id).Scan(&email); err != nil {
		t.Fatalf("select contact_email: %v", err)
	}
	return email
}

func TestGuestbookCreateTopLevelMessage(t *testing.T) {
	withGuestbookTestDB(t, func() {
		payload := seedGuestbookMessage(t, `{"nickname":"Tao","content":"站点名称：A\n站点链接：https://a.test"}`, "127.0.0.1:3456")
		item := payload["item"].(map[string]any)
		if item["parentId"].(float64) != 0 {
			t.Fatalf("expected top-level parentId 0, got %#v", item["parentId"])
		}
	})
}

func TestFriendsAnonymousTopLevelMessageRequiresContactEmail(t *testing.T) {
	withGuestbookTestDB(t, func() {
		rr := postGuestbookMessageWithSession(
			t,
			`{"nickname":"Friend","content":"friends root","channel":"friends"}`,
			"127.0.0.1:3456",
			"",
		)

		if rr.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for missing friends contact email, got %d body=%s", rr.Code, rr.Body.String())
		}
		payload := decodeJSONMap(t, rr)
		if payload["error"] != "INVALID_EMAIL" {
			t.Fatalf("expected INVALID_EMAIL, got %#v", payload["error"])
		}
	})
}

func TestFriendsAnonymousTopLevelMessageStoresPrivateContactEmail(t *testing.T) {
	withGuestbookTestDB(t, func() {
		payload := seedGuestbookMessage(t, `{"nickname":"Friend","content":"friends root","channel":"friends","contactEmail":" Visitor@Example.COM "}`, "127.0.0.1:3456")
		item := payload["item"].(map[string]any)
		id := int64(item["id"].(float64))

		if stored := guestbookStoredContactEmail(t, id); stored != "visitor@example.com" {
			t.Fatalf("expected normalized contact email, got %q", stored)
		}
		if _, ok := item["contactEmail"]; ok {
			t.Fatalf("public response leaked contactEmail: %#v", item)
		}
	})
}

func TestFriendsLoggedInTopLevelMessageUsesSubmittedContactEmail(t *testing.T) {
	withGuestbookTestDB(t, func() {
		userID := seedGuestbookTestUser(t, "login@example.com", "Login", false)
		sessionToken := seedGuestbookTestSession(t, userID, false)

		rr := postGuestbookMessageWithSession(
			t,
			`{"content":"friends root","channel":"friends","contactEmail":"Preferred@Example.com"}`,
			"127.0.0.1:3456",
			sessionToken,
		)
		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
		}
		item := decodeJSONMap(t, rr)["item"].(map[string]any)
		id := int64(item["id"].(float64))

		if stored := guestbookStoredContactEmail(t, id); stored != "preferred@example.com" {
			t.Fatalf("expected submitted email override, got %q", stored)
		}
	})
}

func TestFriendsLoggedInTopLevelMessageFallsBackToAccountEmail(t *testing.T) {
	withGuestbookTestDB(t, func() {
		userID := seedGuestbookTestUser(t, "Login@Example.com", "Login", false)
		sessionToken := seedGuestbookTestSession(t, userID, false)

		rr := postGuestbookMessageWithSession(
			t,
			`{"content":"friends root","channel":"friends"}`,
			"127.0.0.1:3456",
			sessionToken,
		)
		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
		}
		item := decodeJSONMap(t, rr)["item"].(map[string]any)
		id := int64(item["id"].(float64))

		if stored := guestbookStoredContactEmail(t, id); stored != "login@example.com" {
			t.Fatalf("expected account email fallback, got %q", stored)
		}
	})
}

func TestGuestbookChannelDoesNotRequireContactEmail(t *testing.T) {
	withGuestbookTestDB(t, func() {
		payload := seedGuestbookMessage(t, `{"nickname":"Guestbook","content":"plain guestbook","channel":"guestbook"}`, "127.0.0.1:3456")
		item := payload["item"].(map[string]any)
		id := int64(item["id"].(float64))

		if stored := guestbookStoredContactEmail(t, id); stored != "" {
			t.Fatalf("expected empty contact email for generic guestbook, got %q", stored)
		}
	})
}

func TestGuestbookChannelKeepsGuestbookAndFriendsSeparate(t *testing.T) {
	withGuestbookTestDB(t, func() {
		seedGuestbookMessage(t, `{"nickname":"Guestbook","content":"only guestbook"}`, "127.0.0.1:3456")
		seedGuestbookMessage(t, `{"nickname":"Friend","content":"only friends","channel":"friends","contactEmail":"friend@example.com"}`, "127.0.0.1:4567")

		guestbookReq := httptest.NewRequest(http.MethodGet, "/api/guestbook/messages?page=1&pageSize=20&channel=guestbook", nil)
		guestbookRR := httptest.NewRecorder()
		guestbookListHandler(guestbookRR, guestbookReq)
		if guestbookRR.Code != http.StatusOK {
			t.Fatalf("guestbook list expected 200, got %d body=%s", guestbookRR.Code, guestbookRR.Body.String())
		}
		guestbookPayload := decodeJSONMap(t, guestbookRR)
		guestbookItems := guestbookPayload["items"].([]any)
		if len(guestbookItems) != 1 {
			t.Fatalf("expected 1 guestbook item, got %d", len(guestbookItems))
		}

		friendsReq := httptest.NewRequest(http.MethodGet, "/api/guestbook/messages?page=1&pageSize=20&channel=friends", nil)
		friendsRR := httptest.NewRecorder()
		guestbookListHandler(friendsRR, friendsReq)
		if friendsRR.Code != http.StatusOK {
			t.Fatalf("friends list expected 200, got %d body=%s", friendsRR.Code, friendsRR.Body.String())
		}
		friendsPayload := decodeJSONMap(t, friendsRR)
		friendsItems := friendsPayload["items"].([]any)
		if len(friendsItems) != 1 {
			t.Fatalf("expected 1 friends item, got %d", len(friendsItems))
		}
	})
}

func TestGuestbookRejectsReplyAcrossChannels(t *testing.T) {
	withGuestbookTestDB(t, func() {
		first := seedGuestbookMessage(t, `{"nickname":"Friend","content":"friends root","channel":"friends","contactEmail":"friend@example.com"}`, "127.0.0.1:3456")
		parentID := int(first["item"].(map[string]any)["id"].(float64))

		req := httptest.NewRequest(
			http.MethodPost,
			"/api/guestbook/messages",
			bytes.NewBufferString(`{"nickname":"Reply","content":"cross reply","parentId":1,"channel":"guestbook"}`),
		)
		req.Header.Set("Content-Type", "application/json")
		req.RemoteAddr = "127.0.0.1:4567"
		rr := httptest.NewRecorder()

		guestbookCreateHandler(rr, req)

		if rr.Code != http.StatusBadRequest {
			t.Fatalf("expected 400 for cross-channel reply to %d, got %d body=%s", parentID, rr.Code, rr.Body.String())
		}
	})
}

func TestGuestbookCreateReplyWithParentID(t *testing.T) {
	withGuestbookTestDB(t, func() {
		first := seedGuestbookMessage(t, `{"nickname":"Tao","content":"站点名称：A\n站点链接：https://a.test"}`, "127.0.0.1:3456")
		parentID := int(first["item"].(map[string]any)["id"].(float64))

		replyBody := `{"nickname":"Reply","content":"已看到，晚点回链。","parentId":1}`
		payload := seedGuestbookMessage(t, replyBody, "127.0.0.1:4567")
		item := payload["item"].(map[string]any)
		if int(item["parentId"].(float64)) != parentID {
			t.Fatalf("expected parentId %d, got %#v", parentID, item["parentId"])
		}
	})
}

func TestGuestbookRejectsReplyToMissingParent(t *testing.T) {
	withGuestbookTestDB(t, func() {
		req := httptest.NewRequest(
			http.MethodPost,
			"/api/guestbook/messages",
			bytes.NewBufferString(`{"nickname":"Reply","content":"找不到楼层","parentId":999}`),
		)
		req.Header.Set("Content-Type", "application/json")
		req.RemoteAddr = "127.0.0.1:5678"
		rr := httptest.NewRecorder()

		guestbookCreateHandler(rr, req)

		if rr.Code != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d body=%s", rr.Code, rr.Body.String())
		}
	})
}

func TestGuestbookListReturnsNestedReplies(t *testing.T) {
	withGuestbookTestDB(t, func() {
		seedGuestbookMessage(t, `{"nickname":"Tao","content":"站点名称：A\n站点链接：https://a.test"}`, "127.0.0.1:3456")
		seedGuestbookMessage(t, `{"nickname":"Friend","content":"已添加，来回访啦。","parentId":1}`, "127.0.0.1:4567")

		req := httptest.NewRequest(http.MethodGet, "/api/guestbook/messages?page=1&pageSize=20", nil)
		rr := httptest.NewRecorder()
		guestbookListHandler(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
		}
		payload := decodeJSONMap(t, rr)
		items := payload["items"].([]any)
		if len(items) != 1 {
			t.Fatalf("expected 1 top-level item, got %d", len(items))
		}
		top := items[0].(map[string]any)
		if int(top["replyCount"].(float64)) != 1 {
			t.Fatalf("expected replyCount 1, got %#v", top["replyCount"])
		}
		replies := top["replies"].([]any)
		if len(replies) != 1 {
			t.Fatalf("expected 1 reply, got %d", len(replies))
		}
	})
}
