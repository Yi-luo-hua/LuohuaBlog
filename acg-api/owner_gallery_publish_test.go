package main

import (
	"strings"
	"testing"
)

const ownerGalleryDataFixture = `const COS = "https://tzyy-1330068502.cos.ap-beijing.myqcloud.com";

export const galleryAlbums = [
  {
    id: "misaka",
    title: "御坂美琴",
    eyebrow: "Anime Archive 01",
    description: "Existing album.",
    tone: "from-[#EAF6FF] via-[#F7F1FF] to-[#FFF5FA]",
    accent: "#7C5CFF",
    cover: "https://cdn.example/cover.jpg",
    images: [
      "https://cdn.example/old.jpg",
    ],
  },
];

export const getGalleryAlbum = (id) =>
  galleryAlbums.find((album) => album.id === id);
`

func TestOwnerGalleryDataAppendsImageToExistingAlbum(t *testing.T) {
	got, result, err := buildOwnerGalleryDataUpdate(ownerGalleryDataFixture, ownerGalleryPublishRequest{
		AlbumID:  "misaka",
		ImageURL: "https://cdn.example/new.jpg",
	})
	if err != nil {
		t.Fatalf("update gallery data: %v", err)
	}
	if result.AlbumID != "misaka" {
		t.Fatalf("unexpected album id: %q", result.AlbumID)
	}
	if !containsAll(got,
		`id: "misaka"`,
		`"https://cdn.example/old.jpg",`,
		`"https://cdn.example/new.jpg",`,
	) {
		t.Fatalf("updated gallery data did not append image:\n%s", got)
	}
	if countSubstring(got, `"https://cdn.example/new.jpg"`) != 1 {
		t.Fatalf("expected new image once, got:\n%s", got)
	}
}

func TestOwnerGalleryDataCreatesCustomAlbum(t *testing.T) {
	got, result, err := buildOwnerGalleryDataUpdate(ownerGalleryDataFixture, ownerGalleryPublishRequest{
		AlbumTitle: "夏日相册",
		ImageURL:   "https://cdn.example/summer.jpg",
	})
	if err != nil {
		t.Fatalf("update gallery data: %v", err)
	}
	if result.AlbumID != "夏日相册" || result.AlbumID == "default" {
		t.Fatalf("unexpected custom album id: %q", result.AlbumID)
	}
	if !containsAll(got,
		`id: "夏日相册"`,
		`title: "夏日相册"`,
		`cover: "https://cdn.example/summer.jpg"`,
		`"https://cdn.example/summer.jpg",`,
	) {
		t.Fatalf("updated gallery data did not create album:\n%s", got)
	}
}

func containsAll(text string, needles ...string) bool {
	for _, needle := range needles {
		if !strings.Contains(text, needle) {
			return false
		}
	}
	return true
}

func countSubstring(text, needle string) int {
	count := 0
	for {
		idx := strings.Index(text, needle)
		if idx < 0 {
			return count
		}
		count++
		text = text[idx+len(needle):]
	}
}
