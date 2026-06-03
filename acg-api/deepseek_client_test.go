package main

import (
	"strings"
	"testing"
)

func TestBuildChatUserContentIncludesPageContext(t *testing.T) {
	content := buildChatUserContent(
		"What is on this page?",
		"https://taozhiyy.top/about",
		"About Taozhiyy",
		chatPageContext{
			PagePath:    "/about",
			SiteSection: "main",
			Language:    "zh-CN",
			Headings:    []string{"About", "Tech stack"},
			VisibleText: "This is the real about page text with origin, tech stack, and contact details.",
		},
	)

	for _, want := range []string{
		"Current page context",
		"Path: /about",
		"Headings: About | Tech stack",
		"Visible text: This is the real about page text",
		"User question",
		"What is on this page?",
	} {
		if !strings.Contains(content, want) {
			t.Fatalf("expected content to contain %q, got:\n%s", want, content)
		}
	}
}
