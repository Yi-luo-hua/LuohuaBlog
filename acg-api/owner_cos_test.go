package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestOwnerCOSObjectKeyForGallery(t *testing.T) {
	// 相册不再分册，照片按年月归档。
	key := ownerCOSObjectKey("gallery", "20260607-010203-uuid.png")
	if !strings.HasPrefix(key, "gallery/") || !strings.HasSuffix(key, "/20260607-010203-uuid.png") {
		t.Fatalf("unexpected key: %q", key)
	}
	if strings.Count(key, "/") != 3 {
		t.Fatalf("expected gallery/<year>/<month>/<file>, got %q", key)
	}
}

func TestOwnerCOSObjectKeyForArticle(t *testing.T) {
	key := ownerCOSObjectKey("article", "20260607-010203-uuid.png")
	if !strings.HasPrefix(key, "articles/") {
		t.Fatalf("expected article path prefix, got %q", key)
	}
}

func TestOwnerLocalMediaUploaderUploadsAndStoresFile(t *testing.T) {
	tmpDir := t.TempDir()
	t.Setenv("COS_LOCAL_DIR", tmpDir)

	uploader, err := newOwnerAssetUploader()
	if err != nil {
		t.Fatalf("newOwnerAssetUploader failed: %v", err)
	}

	result, err := uploader.UploadImage("gallery", "test.png", "image/png", []byte("fake-png-content"))
	if err != nil {
		t.Fatalf("UploadImage failed: %v", err)
	}

	if !strings.HasPrefix(result.URL, "/cos/gallery/") {
		t.Fatalf("expected /cos/gallery/ url, got %q", result.URL)
	}
	if result.MIMEType != "image/png" {
		t.Fatalf("expected image/png, got %q", result.MIMEType)
	}
	if result.Size != len("fake-png-content") {
		t.Fatalf("expected size %d, got %d", len("fake-png-content"), result.Size)
	}

	storedPath := filepath.Join(tmpDir, filepath.FromSlash(result.ObjectKey))
	content, err := os.ReadFile(storedPath)
	if err != nil {
		t.Fatalf("failed to read stored file at %s: %v", storedPath, err)
	}
	if string(content) != "fake-png-content" {
		t.Fatalf("unexpected content: %q", string(content))
	}
}

func TestOwnerCOSProxyURL(t *testing.T) {
	got := ownerCOSProxyURL("gallery/2026/08/test image.png")
	if got != "/cos/gallery/2026/08/test%20image.png" {
		t.Fatalf("unexpected proxy URL: %q", got)
	}
}
