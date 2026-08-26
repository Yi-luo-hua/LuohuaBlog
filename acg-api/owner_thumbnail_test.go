package main

import (
	"bytes"
	"errors"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"testing"
)

// 左半边纯红、右半边纯蓝的测试图，缩放后还能看出颜色有没有被搬错位置。
func twoToneImage(width, height int) image.Image {
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			if x < width/2 {
				img.Set(x, y, color.RGBA{R: 255, A: 255})
			} else {
				img.Set(x, y, color.RGBA{B: 255, A: 255})
			}
		}
	}
	return img
}

func encodeTestJPEG(t *testing.T, img image.Image) []byte {
	t.Helper()
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, nil); err != nil {
		t.Fatalf("encode fixture: %v", err)
	}
	return buf.Bytes()
}

func TestBuildOwnerThumbnailFitsTheLongEdgeAndKeepsAspect(t *testing.T) {
	body := encodeTestJPEG(t, twoToneImage(4000, 3000))

	thumb, width, height, err := buildOwnerThumbnail(body)
	if err != nil {
		t.Fatalf("build thumbnail: %v", err)
	}
	if width != ownerThumbnailMaxEdge {
		t.Fatalf("expected long edge %d, got %d", ownerThumbnailMaxEdge, width)
	}
	if height != 675 {
		t.Fatalf("expected 4:3 aspect preserved (675), got %d", height)
	}
	if len(thumb) >= len(body) {
		t.Fatalf("thumbnail (%d bytes) should be smaller than the original (%d bytes)", len(thumb), len(body))
	}

	decoded, err := jpeg.Decode(bytes.NewReader(thumb))
	if err != nil {
		t.Fatalf("thumbnail is not decodable jpeg: %v", err)
	}
	if decoded.Bounds().Dx() != width || decoded.Bounds().Dy() != height {
		t.Fatalf("thumbnail bounds %v disagree with reported %dx%d", decoded.Bounds(), width, height)
	}
}

func TestBuildOwnerThumbnailKeepsThePictureRatherThanSmearingIt(t *testing.T) {
	body := encodeTestJPEG(t, twoToneImage(2400, 1200))

	thumb, width, height, err := buildOwnerThumbnail(body)
	if err != nil {
		t.Fatalf("build thumbnail: %v", err)
	}
	decoded, err := jpeg.Decode(bytes.NewReader(thumb))
	if err != nil {
		t.Fatalf("decode thumbnail: %v", err)
	}

	// 左侧应当还是红的、右侧还是蓝的；避开正中间那条 JPEG 会晕开的边界。
	leftR, leftG, leftB, _ := decoded.At(width/4, height/2).RGBA()
	rightR, rightG, rightB, _ := decoded.At(width*3/4, height/2).RGBA()

	if leftR < 0xC000 || leftG > 0x4000 || leftB > 0x4000 {
		t.Fatalf("left half is not red: %d %d %d", leftR, leftG, leftB)
	}
	if rightB < 0xC000 || rightR > 0x4000 || rightG > 0x4000 {
		t.Fatalf("right half is not blue: %d %d %d", rightR, rightG, rightB)
	}
}

func TestBuildOwnerThumbnailSkipsImagesThatAreAlreadySmall(t *testing.T) {
	body := encodeTestJPEG(t, twoToneImage(600, 400))

	_, _, _, err := buildOwnerThumbnail(body)
	if !errors.Is(err, errThumbnailNotWorthIt) {
		t.Fatalf("expected errThumbnailNotWorthIt, got %v", err)
	}
}

func TestBuildOwnerThumbnailHandlesPNGAndRejectsGarbage(t *testing.T) {
	var buf bytes.Buffer
	if err := png.Encode(&buf, twoToneImage(1800, 1800)); err != nil {
		t.Fatalf("encode png fixture: %v", err)
	}

	_, width, height, err := buildOwnerThumbnail(buf.Bytes())
	if err != nil {
		t.Fatalf("png thumbnail: %v", err)
	}
	if width != ownerThumbnailMaxEdge || height != ownerThumbnailMaxEdge {
		t.Fatalf("square png should stay square at the max edge, got %dx%d", width, height)
	}

	// 解不开的内容（比如 webp）只该报错，不该 panic。
	if _, _, _, err := buildOwnerThumbnail([]byte("RIFF....WEBPVP8 not really")); err == nil {
		t.Fatal("expected undecodable input to fail")
	}
}

func TestOwnerThumbnailObjectKey(t *testing.T) {
	cases := map[string]string{
		"gallery/2026/08/photo.jpg":  "gallery/2026/08/photo-thumb.jpg",
		"gallery/2026/08/photo.webp": "gallery/2026/08/photo-thumb.jpg",
		"gallery/2026/08/photo":      "gallery/2026/08/photo-thumb.jpg",
	}
	for input, want := range cases {
		if got := ownerThumbnailObjectKey(input); got != want {
			t.Fatalf("key for %q: want %q, got %q", input, want, got)
		}
	}
}
