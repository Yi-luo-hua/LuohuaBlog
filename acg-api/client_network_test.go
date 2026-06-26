package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestClientNetworkHandlerReturnsMaskedVisitorNetwork(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/client/network", nil)
	req.Header.Set("X-Forwarded-For", "203.0.113.42, 10.0.0.10")
	req.RemoteAddr = "10.0.0.10:4567"
	rr := httptest.NewRecorder()

	clientNetworkHandler(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
	}

	var payload map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if payload["ipMasked"] != "203.0.*.*" {
		t.Fatalf("expected masked forwarded IP, got %#v", payload["ipMasked"])
	}
	if payload["regionLabel"] != "访客" {
		t.Fatalf("expected compact fallback region label, got %#v", payload["regionLabel"])
	}
	if _, ok := payload["ip"]; ok {
		t.Fatalf("response must not expose full IP: %#v", payload)
	}
	if strings.Contains(rr.Body.String(), "203.0.113.42") {
		t.Fatalf("response leaked full IP: %s", rr.Body.String())
	}
	if payload["serverTime"] == "" {
		t.Fatalf("expected serverTime in response: %#v", payload)
	}
}

func TestClientNetworkHandlerRejectsNonGET(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/api/client/network", nil)
	rr := httptest.NewRecorder()

	clientNetworkHandler(rr, req)

	if rr.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected 405, got %d body=%s", rr.Code, rr.Body.String())
	}
}

func TestCompactClientRegionLabelKeepsToolbarTextShort(t *testing.T) {
	cases := map[string]string{
		"浙江 杭州":     "杭州",
		"本地":        "本地",
		"未知地区":      "访客",
		"":          "访客",
		"很长很长很长的城市": "很长很长很",
	}

	for input, want := range cases {
		if got := compactClientRegionLabel(input); got != want {
			t.Fatalf("compactClientRegionLabel(%q) = %q, want %q", input, got, want)
		}
	}
}

func TestClientNetworkRegionDoesNotCallExternalLookupByDefault(t *testing.T) {
	prevDB := db
	db = nil
	t.Cleanup(func() { db = prevDB })

	if got := clientNetworkRegion("203.0.113.42"); got != "" {
		t.Fatalf("expected empty public region without db/cache lookup, got %q", got)
	}
	if got := clientNetworkRegion("127.0.0.1"); got != "本地" {
		t.Fatalf("expected local region for loopback, got %q", got)
	}
}
