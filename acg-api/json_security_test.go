package main

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestWriteJSONEscapesHTMLByDefault(t *testing.T) {
	rr := httptest.NewRecorder()

	writeJSON(rr, map[string]string{
		"content": `<script>alert(1)</script>`,
	})

	body := rr.Body.String()
	if strings.Contains(body, "<script>") {
		t.Fatalf("writeJSON must HTML-escape script-like content, got %q", body)
	}
	if !strings.Contains(body, `\u003cscript\u003ealert(1)\u003c/script\u003e`) {
		t.Fatalf("expected escaped script-like content, got %q", body)
	}
}

func TestWriteJSONStatusEscapesHTMLByDefault(t *testing.T) {
	rr := httptest.NewRecorder()

	writeJSONStatus(rr, http.StatusBadRequest, map[string]string{
		"message": `<img src=x onerror=alert(1)>`,
	})

	body := rr.Body.String()
	if strings.Contains(body, "<img") {
		t.Fatalf("writeJSONStatus must HTML-escape tag-like content, got %q", body)
	}
	if !strings.Contains(body, `\u003cimg src=x onerror=alert(1)\u003e`) {
		t.Fatalf("expected escaped tag-like content, got %q", body)
	}
}
