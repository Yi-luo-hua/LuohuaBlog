package main

import (
	"strings"
	"testing"
	"time"
)

const ownerGalleryDataFixture = `export const galleryPhotos = [
  {
    id: "20260101-000000-aaaaaa",
    src: "/cos/gallery/2026/01/old.jpg",
    width: 1600,
    height: 1200,
    publishedAt: "2026-01-01T00:00:00Z",
  },
];

export const getGalleryPhoto = (id) =>
  galleryPhotosNewestFirst.find((photo) => photo.id === id);
`

const ownerEmptyGalleryDataFixture = `export const galleryPhotos = [];

export const getGalleryPhoto = (id) =>
  galleryPhotosNewestFirst.find((photo) => photo.id === id);
`

func TestOwnerGalleryDataInsertsNewestPhotoFirst(t *testing.T) {
	got, result, err := buildOwnerGalleryDataUpdate(ownerGalleryDataFixture, ownerGalleryPublishRequest{
		ImageURL: "/cos/gallery/2026/08/new.jpg",
		Width:    4000,
		Height:   3000,
		Title:    "夏天的海",
	})
	if err != nil {
		t.Fatalf("update gallery data: %v", err)
	}
	if !result.Changed {
		t.Fatal("expected the publish to change the file")
	}
	if !containsAll(got,
		`src: "/cos/gallery/2026/08/new.jpg"`,
		`width: 4000,`,
		`height: 3000,`,
		`title: "夏天的海"`,
		`id: `+jsStringLiteral(result.PhotoID),
	) {
		t.Fatalf("updated gallery data is missing the new photo:\n%s", got)
	}

	// 新照片必须排在老照片前面，页面才会“新发布的在上面”。
	newIndex := strings.Index(got, "/cos/gallery/2026/08/new.jpg")
	oldIndex := strings.Index(got, "/cos/gallery/2026/01/old.jpg")
	if newIndex < 0 || oldIndex < 0 || newIndex > oldIndex {
		t.Fatalf("new photo did not land at the top:\n%s", got)
	}
	if !strings.Contains(got, "export const galleryPhotos = [\n  {\n    id:") {
		t.Fatalf("array opening looks malformed:\n%s", got)
	}
}

func TestOwnerGalleryDataInsertsIntoEmptyGallery(t *testing.T) {
	got, result, err := buildOwnerGalleryDataUpdate(ownerEmptyGalleryDataFixture, ownerGalleryPublishRequest{
		ImageURL: "https://cdn.example/first.jpg",
		Width:    1200,
		Height:   1600,
	})
	if err != nil {
		t.Fatalf("update gallery data: %v", err)
	}
	if !result.Changed {
		t.Fatal("expected the publish to change the file")
	}
	if strings.Contains(got, "galleryPhotos = [];") {
		t.Fatalf("empty array literal survived the insert:\n%s", got)
	}
	if !containsAll(got, `src: "https://cdn.example/first.jpg"`, "\n];\n") {
		t.Fatalf("photo was not inserted into the empty array:\n%s", got)
	}
	// 没填说明就不该写出一个空的 title 字段。
	if strings.Contains(got, "title:") {
		t.Fatalf("unexpected empty title in output:\n%s", got)
	}
}

func TestOwnerGalleryDataSkipsAPhotoItAlreadyHas(t *testing.T) {
	got, result, err := buildOwnerGalleryDataUpdate(ownerGalleryDataFixture, ownerGalleryPublishRequest{
		ImageURL: "/cos/gallery/2026/01/old.jpg",
		Width:    1600,
		Height:   1200,
	})
	if err != nil {
		t.Fatalf("update gallery data: %v", err)
	}
	if result.Changed {
		t.Fatal("republishing the same photo should not change the file")
	}
	if got != ownerGalleryDataFixture {
		t.Fatalf("file was modified despite no change:\n%s", got)
	}
	if countSubstring(got, "/cos/gallery/2026/01/old.jpg") != 1 {
		t.Fatalf("photo was duplicated:\n%s", got)
	}
}

func TestOwnerGalleryDataRejectsBadInput(t *testing.T) {
	cases := []struct {
		name string
		req  ownerGalleryPublishRequest
	}{
		{"empty url", ownerGalleryPublishRequest{ImageURL: "", Width: 100, Height: 100}},
		{"relative path", ownerGalleryPublishRequest{ImageURL: "gallery/x.jpg", Width: 100, Height: 100}},
		{"non-cos same origin", ownerGalleryPublishRequest{ImageURL: "/api/owner/assets", Width: 100, Height: 100}},
		{"protocol relative", ownerGalleryPublishRequest{ImageURL: "//evil.example/cos/x.jpg", Width: 100, Height: 100}},
		{"missing size", ownerGalleryPublishRequest{ImageURL: "https://cdn.example/x.jpg"}},
		{"negative size", ownerGalleryPublishRequest{ImageURL: "https://cdn.example/x.jpg", Width: -1, Height: 100}},
		{"absurd size", ownerGalleryPublishRequest{ImageURL: "https://cdn.example/x.jpg", Width: 999999, Height: 100}},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, _, err := buildOwnerGalleryDataUpdate(ownerEmptyGalleryDataFixture, tc.req); err == nil {
				t.Fatal("expected the publish to be rejected")
			}
		})
	}
}

func TestOwnerGalleryPhotoIDIsStableAndDistinct(t *testing.T) {
	now := time.Date(2026, 8, 26, 14, 30, 12, 0, time.UTC)

	id := ownerGalleryPhotoIDFor("/cos/gallery/a.jpg", now)
	if id != ownerGalleryPhotoIDFor("/cos/gallery/a.jpg", now) {
		t.Fatal("the same url and time should produce the same id")
	}
	if !strings.HasPrefix(id, "20260826-143012-") {
		t.Fatalf("id is not timestamp prefixed: %q", id)
	}
	if id == ownerGalleryPhotoIDFor("/cos/gallery/b.jpg", now) {
		t.Fatal("different urls should not collide at the same second")
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

func TestOwnerGalleryDataRecordsAnOptionalThumbnail(t *testing.T) {
	got, _, err := buildOwnerGalleryDataUpdate(ownerEmptyGalleryDataFixture, ownerGalleryPublishRequest{
		ImageURL: "/cos/gallery/2026/08/photo.jpg",
		ThumbURL: "/cos/gallery/2026/08/photo-thumb.jpg",
		Width:    4000,
		Height:   3000,
	})
	if err != nil {
		t.Fatalf("update gallery data: %v", err)
	}
	if !containsAll(got, `thumb: "/cos/gallery/2026/08/photo-thumb.jpg"`) {
		t.Fatalf("thumbnail was not recorded:\n%s", got)
	}
}

func TestOwnerGalleryDataOmitsTheThumbnailFieldWhenThereIsNone(t *testing.T) {
	got, _, err := buildOwnerGalleryDataUpdate(ownerEmptyGalleryDataFixture, ownerGalleryPublishRequest{
		ImageURL: "/cos/gallery/2026/08/photo.jpg",
		Width:    4000,
		Height:   3000,
	})
	if err != nil {
		t.Fatalf("update gallery data: %v", err)
	}
	if strings.Contains(got, "thumb:") {
		t.Fatalf("expected no thumb field:\n%s", got)
	}
}

func TestOwnerGalleryDataRejectsABogusThumbnailURL(t *testing.T) {
	_, _, err := buildOwnerGalleryDataUpdate(ownerEmptyGalleryDataFixture, ownerGalleryPublishRequest{
		ImageURL: "/cos/gallery/2026/08/photo.jpg",
		ThumbURL: "//evil.example/cos/thumb.jpg",
		Width:    4000,
		Height:   3000,
	})
	if err == nil {
		t.Fatal("expected a protocol-relative thumbnail url to be rejected")
	}
}
