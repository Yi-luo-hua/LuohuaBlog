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

func TestOwnerCOSObjectKeyForGalleryKeepsChineseAlbumNames(t *testing.T) {
	key := ownerCOSObjectKey("gallery", "御坂美琴", "20260607-010203-uuid.png")
	if key != "gallery/御坂美琴/20260607-010203-uuid.png" {
		t.Fatalf("unexpected key for chinese album: %q", key)
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
	t.Setenv("COS_SECRET_ID", "")
	t.Setenv("COS_SECRET_KEY", "")
	t.Setenv("COS_BUCKET", "")
	t.Setenv("COS_REGION", "")

	_, err := loadOwnerCOSConfig()
	if err == nil {
		t.Fatal("expected config error")
	}
}

func TestOwnerCOSConfigFallsBackToLegacyCOSKeys(t *testing.T) {
	t.Setenv("TENCENT_COS_SECRET_ID", "")
	t.Setenv("TENCENT_COS_SECRET_KEY", "")
	t.Setenv("TENCENT_COS_BUCKET", "")
	t.Setenv("TENCENT_COS_REGION", "")
	t.Setenv("TENCENT_COS_BASE_URL", "")
	t.Setenv("COS_SECRET_ID", "legacy-id")
	t.Setenv("COS_SECRET_KEY", "legacy-key")
	t.Setenv("COS_BUCKET", "legacy-bucket")
	t.Setenv("COS_REGION", "ap-beijing")

	cfg, err := loadOwnerCOSConfig()
	if err != nil {
		t.Fatalf("expected legacy COS keys to configure uploader: %v", err)
	}
	if cfg.secretID != "legacy-id" || cfg.secretKey != "legacy-key" || cfg.bucket != "legacy-bucket" || cfg.region != "ap-beijing" {
		t.Fatalf("unexpected config from legacy keys: %+v", cfg)
	}
	if cfg.baseURL != "https://legacy-bucket.cos.ap-beijing.myqcloud.com" {
		t.Fatalf("unexpected default base URL: %q", cfg.baseURL)
	}
}

func TestOwnerCOSPublicURLUsesConfiguredBaseURL(t *testing.T) {
	cfg := ownerCOSConfig{baseURL: "https://cdn.example"}
	got := ownerCOSPublicURL(cfg, "gallery/misaka/test image.png")
	if got != "https://cdn.example/gallery/misaka/test%20image.png" {
		t.Fatalf("unexpected public URL: %q", got)
	}
}
