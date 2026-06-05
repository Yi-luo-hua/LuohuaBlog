package main

import (
	"database/sql"
	"strings"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

func openWallpaperTestDB(t *testing.T) *sql.DB {
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

func TestInsertAPIWallpapersPrunesOldestRows(t *testing.T) {
	testDB := openWallpaperTestDB(t)
	oldNow := time.Date(2026, 6, 5, 8, 0, 0, 0, time.UTC)
	for i := 0; i < wallpaperAPIMaxItems; i++ {
		item := wallpaperItem{
			ID:          "old-" + time.Duration(i).String(),
			URL:         "https://example.com/old-" + time.Duration(i).String() + ".jpg",
			PreviewURL:  "https://example.com/old-" + time.Duration(i).String() + "-preview.jpg",
			Source:      "test",
			Author:      "tester",
			SourceURL:   "https://example.com",
			LicenseNote: "test license",
			Kind:        "api",
			Status:      "active",
			AddedAt:     oldNow.Add(time.Duration(i) * time.Minute),
		}
		if err := insertWallpaperItems(testDB, []wallpaperItem{item}, oldNow); err != nil {
			t.Fatal(err)
		}
	}

	newNow := oldNow.Add(2 * time.Hour)
	newItems := make([]wallpaperItem, 10)
	for i := range newItems {
		newItems[i] = wallpaperItem{
			ID:          "new-" + time.Duration(i).String(),
			URL:         "https://example.com/new-" + time.Duration(i).String() + ".jpg",
			PreviewURL:  "https://example.com/new-" + time.Duration(i).String() + "-preview.jpg",
			Source:      "test",
			Author:      "tester",
			SourceURL:   "https://example.com",
			LicenseNote: "test license",
			Kind:        "api",
			Status:      "active",
			AddedAt:     newNow.Add(time.Duration(i) * time.Minute),
		}
	}
	if err := insertWallpaperItems(testDB, newItems, newNow); err != nil {
		t.Fatal(err)
	}

	var count int
	if err := testDB.QueryRow(`SELECT COUNT(*) FROM wallpaper_pool WHERE kind='api'`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != wallpaperAPIMaxItems {
		t.Fatalf("expected %d api wallpapers, got %d", wallpaperAPIMaxItems, count)
	}

	var oldCount int
	if err := testDB.QueryRow(`SELECT COUNT(*) FROM wallpaper_pool WHERE id LIKE 'old-%'`).Scan(&oldCount); err != nil {
		t.Fatal(err)
	}
	if oldCount != wallpaperAPIMaxItems-10 {
		t.Fatalf("expected oldest 10 rows pruned, old row count = %d", oldCount)
	}
}

func TestDrawWallpaperReturnsActiveItem(t *testing.T) {
	testDB := openWallpaperTestDB(t)
	now := time.Date(2026, 6, 5, 8, 0, 0, 0, time.UTC)
	if err := insertWallpaperItems(testDB, []wallpaperItem{
		{
			ID:          "active-one",
			URL:         "https://example.com/active.jpg",
			PreviewURL:  "https://example.com/active-preview.jpg",
			Source:      "pexels",
			Author:      "tester",
			SourceURL:   "https://example.com/source",
			LicenseNote: "Pexels License",
			Kind:        "api",
			Status:      "active",
			AddedAt:     now,
		},
	}, now); err != nil {
		t.Fatal(err)
	}

	item, err := drawWallpaperItem(testDB)
	if err != nil {
		t.Fatal(err)
	}
	if item.URL != "https://example.com/active.jpg" {
		t.Fatalf("unexpected drawn wallpaper url: %s", item.URL)
	}
	if item.Source != "pexels" {
		t.Fatalf("unexpected source: %s", item.Source)
	}
}

func TestDrawAPIWallpaperIgnoresLocalFallbackRows(t *testing.T) {
	testDB := openWallpaperTestDB(t)
	now := time.Date(2026, 6, 5, 8, 0, 0, 0, time.UTC)
	if err := insertWallpaperItems(testDB, []wallpaperItem{
		{
			ID:          "local-fallback",
			URL:         "https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/local.jpg",
			PreviewURL:  "https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/local-preview.jpg",
			Source:      "local-gallery",
			Author:      "tester",
			SourceURL:   "https://taozhiyy.top/gallery",
			LicenseNote: "local fallback",
			Kind:        "fallback",
			Status:      "active",
			AddedAt:     now,
		},
		{
			ID:          "api-one",
			URL:         "https://images.pexels.com/photos/api.jpg",
			PreviewURL:  "https://images.pexels.com/photos/api-preview.jpg",
			Source:      "pexels",
			Author:      "tester",
			SourceURL:   "https://www.pexels.com/photo/api",
			LicenseNote: "Pexels License",
			Kind:        "api",
			Status:      "active",
			AddedAt:     now,
		},
	}, now); err != nil {
		t.Fatal(err)
	}

	item, err := drawAPIWallpaperItem(testDB)
	if err != nil {
		t.Fatal(err)
	}
	if item.Kind != "api" {
		t.Fatalf("expected api item, got kind %q", item.Kind)
	}
	if item.Source != "pexels" {
		t.Fatalf("expected pexels source, got %q", item.Source)
	}
	if strings.Contains(item.URL, "myqcloud.com") {
		t.Fatalf("expected non-COS api wallpaper, got %s", item.URL)
	}
}

func TestAPIFallbackWallpaperIsNotCOS(t *testing.T) {
	item := apiFallbackWallpaperItem()
	if item.Kind != "api" {
		t.Fatalf("expected api kind, got %q", item.Kind)
	}
	if item.Source == "local-gallery" {
		t.Fatalf("expected external api source, got %q", item.Source)
	}
	if strings.Contains(item.URL, "myqcloud.com") {
		t.Fatalf("expected non-COS fallback, got %s", item.URL)
	}
}
