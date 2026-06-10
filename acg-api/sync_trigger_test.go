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
		syncTriggerQueue = func(AppConfig) bool { queued++; return true }
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

func TestSyncTriggerRejectsMissingDeploymentTokenWhenConfigured(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		t.Setenv("SYNC_TRIGGER_TOKEN", "deploy-token")
		queued := 0
		prev := syncTriggerQueue
		syncTriggerQueue = func(AppConfig) bool { queued++; return true }
		t.Cleanup(func() { syncTriggerQueue = prev })

		req := httptest.NewRequest(http.MethodPost, "/api/v1/sync/trigger", nil)
		rr := httptest.NewRecorder()

		syncTriggerHandler(AppConfig{})(rr, req)

		if rr.Code != http.StatusForbidden {
			t.Fatalf("expected 403 for missing deployment token, got %d body=%s", rr.Code, rr.Body.String())
		}
		if queued != 0 {
			t.Fatalf("missing deployment token should not queue sync, queued=%d", queued)
		}
	})
}

func TestSyncTriggerRejectsWrongDeploymentToken(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		t.Setenv("SYNC_TRIGGER_TOKEN", "deploy-token")
		queued := 0
		prev := syncTriggerQueue
		syncTriggerQueue = func(AppConfig) bool { queued++; return true }
		t.Cleanup(func() { syncTriggerQueue = prev })

		req := httptest.NewRequest(http.MethodPost, "/api/v1/sync/trigger", nil)
		req.Header.Set("X-Sync-Trigger-Token", "wrong-token")
		rr := httptest.NewRecorder()

		syncTriggerHandler(AppConfig{})(rr, req)

		if rr.Code != http.StatusForbidden {
			t.Fatalf("expected 403 for wrong deployment token, got %d body=%s", rr.Code, rr.Body.String())
		}
		if queued != 0 {
			t.Fatalf("wrong deployment token should not queue sync, queued=%d", queued)
		}
	})
}

func TestSyncTriggerQueuesWithDeploymentTokenHeader(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		t.Setenv("SYNC_TRIGGER_TOKEN", "deploy-token")
		queued := 0
		prev := syncTriggerQueue
		syncTriggerQueue = func(AppConfig) bool { queued++; return true }
		t.Cleanup(func() { syncTriggerQueue = prev })

		req := httptest.NewRequest(http.MethodPost, "/api/v1/sync/trigger", nil)
		req.Header.Set("X-Sync-Trigger-Token", "deploy-token")
		rr := httptest.NewRecorder()

		syncTriggerHandler(AppConfig{})(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 for deployment token sync trigger, got %d body=%s", rr.Code, rr.Body.String())
		}
		if queued != 1 {
			t.Fatalf("deployment token should queue sync once, queued=%d", queued)
		}
	})
}

func TestSyncTriggerQueuesWithBearerDeploymentToken(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		t.Setenv("SYNC_TRIGGER_TOKEN", "deploy-token")
		queued := 0
		prev := syncTriggerQueue
		syncTriggerQueue = func(AppConfig) bool { queued++; return true }
		t.Cleanup(func() { syncTriggerQueue = prev })

		req := httptest.NewRequest(http.MethodPost, "/api/v1/sync/trigger", nil)
		req.Header.Set("Authorization", "Bearer deploy-token")
		rr := httptest.NewRecorder()

		syncTriggerHandler(AppConfig{})(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 for bearer deployment token sync trigger, got %d body=%s", rr.Code, rr.Body.String())
		}
		if queued != 1 {
			t.Fatalf("bearer deployment token should queue sync once, queued=%d", queued)
		}
	})
}

func TestSyncTriggerReportsAlreadyRunning(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		token := seedUnlimitedOwnerSession(t)
		queued := 0
		prev := syncTriggerQueue
		syncTriggerQueue = func(AppConfig) bool { queued++; return false }
		t.Cleanup(func() { syncTriggerQueue = prev })

		req := httptest.NewRequest(http.MethodPost, "/api/v1/sync/trigger", nil)
		req.AddCookie(&http.Cookie{Name: sessionCookieName, Value: token})
		rr := httptest.NewRecorder()

		syncTriggerHandler(AppConfig{})(rr, req)

		if rr.Code != http.StatusAccepted {
			t.Fatalf("expected 202 for already-running sync, got %d body=%s", rr.Code, rr.Body.String())
		}
		if queued != 1 {
			t.Fatalf("sync queue should be checked once, queued=%d", queued)
		}
	})
}

func TestSyncTriggerRejectsNonOwnerSession(t *testing.T) {
	withOwnerControllerTestDB(t, func() {
		userID := seedOwnerControllerUser(t, "reader@example.com", false)
		token := seedOwnerControllerSession(t, userID, false)
		queued := 0
		prev := syncTriggerQueue
		syncTriggerQueue = func(AppConfig) bool { queued++; return true }
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
		syncTriggerQueue = func(AppConfig) bool { queued++; return true }
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
