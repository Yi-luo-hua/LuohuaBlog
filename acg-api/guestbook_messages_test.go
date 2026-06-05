package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

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

func TestGuestbookCreateTopLevelMessage(t *testing.T) {
	withGuestbookTestDB(t, func() {
		payload := seedGuestbookMessage(t, `{"nickname":"Tao","content":"站点名称：A\n站点链接：https://a.test"}`, "127.0.0.1:3456")
		item := payload["item"].(map[string]any)
		if item["parentId"].(float64) != 0 {
			t.Fatalf("expected top-level parentId 0, got %#v", item["parentId"])
		}
	})
}

func TestGuestbookChannelKeepsGuestbookAndFriendsSeparate(t *testing.T) {
	withGuestbookTestDB(t, func() {
		seedGuestbookMessage(t, `{"nickname":"Guestbook","content":"only guestbook"}`, "127.0.0.1:3456")
		seedGuestbookMessage(t, `{"nickname":"Friend","content":"only friends","channel":"friends"}`, "127.0.0.1:4567")

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
		first := seedGuestbookMessage(t, `{"nickname":"Friend","content":"friends root","channel":"friends"}`, "127.0.0.1:3456")
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
