package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestObsidianPublishRequiresBearerToken(t *testing.T) {
	t.Setenv("OBSIDIAN_PUBLISH_TOKEN", "publish-secret")
	req := httptest.NewRequest(http.MethodPost, "/api/integrations/obsidian/publish", strings.NewReader(`{"title":"Test","body":"Body"}`))
	rr := httptest.NewRecorder()

	obsidianPublishHandler(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d body=%s", rr.Code, rr.Body.String())
	}
}

func TestObsidianPublishDryRunBuildsMarkdownWithoutGitHub(t *testing.T) {
	t.Setenv("OBSIDIAN_PUBLISH_TOKEN", "publish-secret")
	req := httptest.NewRequest(
		http.MethodPost,
		"/api/integrations/obsidian/publish",
		strings.NewReader(`{"body":"---\ntitle: Obsidian 里的文章\ntags: [Obsidian, Claudian]\n---\n\n正文","dryRun":true}`),
	)
	req.Header.Set("Authorization", "Bearer publish-secret")
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()

	obsidianPublishHandler(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", rr.Code, rr.Body.String())
	}
	var payload map[string]any
	if err := json.NewDecoder(rr.Body).Decode(&payload); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	item := payload["item"].(map[string]any)
	if item["title"] != "Obsidian 里的文章" || item["dryRun"] != true {
		t.Fatalf("unexpected dry-run item: %#v", item)
	}
	markdown := item["markdown"].(string)
	if !strings.Contains(markdown, "tags: [Obsidian, Claudian]") || !strings.Contains(markdown, "正文") {
		t.Fatalf("unexpected markdown: %q", markdown)
	}
}

func TestObsidianTitleFallsBackToMarkdownHeading(t *testing.T) {
	if got := obsidianTitleFromMarkdown("# 从标题发布\n\n正文"); got != "从标题发布" {
		t.Fatalf("unexpected title: %q", got)
	}
}
