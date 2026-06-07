package main

import (
	"strings"
	"testing"
)

func TestOwnerCOSObjectKeyForGallery(t *testing.T) {
	key := ownerCOSObjectKey("gallery", "Misaka Album", "20260607-010203-uuid.png")
	if key != "gallery/misaka-album/20260607-010203-uuid.png" {
		t.Fatalf("unexpected key: %q", key)
	}
}

func TestOwnerCOSObjectKeyForArticle(t *testing.T) {
	key := ownerCOSObjectKey("article", "", "20260607-010203-uuid.png")
	if !strings.HasPrefix(key, "articles/") {
		t.Fatalf("expected article path prefix, got %q", key)
	}
}

func TestOwnerCOSConfigRequiresSecretFields(t *testing.T) {
	t.Setenv("TENCENT_COS_SECRET_ID", "")
	t.Setenv("TENCENT_COS_SECRET_KEY", "")
	t.Setenv("TENCENT_COS_BUCKET", "")
	t.Setenv("TENCENT_COS_REGION", "")

	_, err := loadOwnerCOSConfig()
	if err == nil {
		t.Fatal("expected config error")
	}
}

func TestOwnerCOSPublicURLUsesConfiguredBaseURL(t *testing.T) {
	cfg := ownerCOSConfig{baseURL: "https://cdn.example"}
	got := ownerCOSPublicURL(cfg, "gallery/misaka/test image.png")
	if got != "https://cdn.example/gallery/misaka/test%20image.png" {
		t.Fatalf("unexpected public URL: %q", got)
	}
}
