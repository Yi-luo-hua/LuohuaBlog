package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSyncTriggerRejectsAnonymousRequest(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		queued := 0
		prev := syncTriggerQueue
		syncTriggerQueue = func(AppConfig) { queued++ }
		t.Cleanup(func() { syncTriggerQueue = prev })

		req := httptest.NewRequest(http.MethodPost, "/api/v1/sync/trigger", nil)
		rr := httptest.NewRecorder()

		syncTriggerHandler(AppConfig{})(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Fatalf("expected 401 for anonymous sync trigger, got %d body=%s", rr.Code, rr.Body.String())
		}
		if queued != 0 {
			t.Fatalf("anonymous request should not queue sync, queued=%d", queued)
		}
	})
}

func TestSyncTriggerRejectsNonOwnerSession(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		userID := seedOwnerControllerUser(t, "reader@example.com", false)
		token := seedOwnerControllerSession(t, userID, false)
		queued := 0
		prev := syncTriggerQueue
		syncTriggerQueue = func(AppConfig) { queued++ }
		t.Cleanup(func() { syncTriggerQueue = prev })

		req := httptest.NewRequest(http.MethodPost, "/api/v1/sync/trigger", nil)
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
		rr := httptest.NewRecorder()

		syncTriggerHandler(AppConfig{})(rr, req)

		if rr.Code != http.StatusForbidden {
			t.Fatalf("expected 403 for non-owner sync trigger, got %d body=%s", rr.Code, rr.Body.String())
		}
		if queued != 0 {
			t.Fatalf("non-owner request should not queue sync, queued=%d", queued)
		}
	})
}

func TestSyncTriggerQueuesForUnlimitedOwner(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		token := seedUnlimitedOwnerSession(t)
		queued := 0
		prev := syncTriggerQueue
		syncTriggerQueue = func(AppConfig) { queued++ }
		t.Cleanup(func() { syncTriggerQueue = prev })

		req := httptest.NewRequest(http.MethodPost, "/api/v1/sync/trigger", nil)
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
		rr := httptest.NewRecorder()

		syncTriggerHandler(AppConfig{})(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 for owner sync trigger, got %d body=%s", rr.Code, rr.Body.String())
		}
		if queued != 1 {
			t.Fatalf("owner request should queue sync once, queued=%d", queued)
		}
	})
}
