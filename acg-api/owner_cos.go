package main

import (
	"fmt"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"
)

type ownerCOSUploadResult struct {
	ObjectKey string
	URL       string
	MIMEType  string
	Size      int
}

type ownerAssetUploader interface {
	UploadImage(kind, filename, mimeType string, body []byte) (ownerCOSUploadResult, error)
	UploadImageAt(objectKey, mimeType string, body []byte) (ownerCOSUploadResult, error)
}

type ownerLocalMediaUploader struct {
	baseDir string
}

func ownerMediaLocalDir() string {
	if dir := strings.TrimSpace(os.Getenv("COS_LOCAL_DIR")); dir != "" {
		return dir
	}
	if fi, err := os.Stat("/var/www/luohua/cos"); err == nil && fi.IsDir() {
		return "/var/www/luohua/cos"
	}
	for _, candidate := range []string{"../assets/cos", "assets/cos"} {
		if fi, err := os.Stat(candidate); err == nil && fi.IsDir() {
			return candidate
		}
	}
	return filepath.Join(ownerUploadsDir(), "cos")
}

func newOwnerAssetUploader() (ownerAssetUploader, error) {
	dir := ownerMediaLocalDir()
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return nil, fmt.Errorf("failed to initialize media directory %s: %w", dir, err)
	}
	return ownerLocalMediaUploader{baseDir: dir}, nil
}

func (u ownerLocalMediaUploader) UploadImage(kind, filename, mimeType string, body []byte) (ownerCOSUploadResult, error) {
	return u.UploadImageAt(ownerCOSObjectKey(kind, filename), mimeType, body)
}

func (u ownerLocalMediaUploader) UploadImageAt(objectKey, mimeType string, body []byte) (ownerCOSUploadResult, error) {
	cleanKey := strings.TrimLeft(filepath.Clean("/"+objectKey), "/")
	targetPath := filepath.Join(u.baseDir, filepath.FromSlash(cleanKey))
	if err := os.MkdirAll(filepath.Dir(targetPath), 0o755); err != nil {
		return ownerCOSUploadResult{}, err
	}
	if err := os.WriteFile(targetPath, body, 0o644); err != nil {
		return ownerCOSUploadResult{}, err
	}
	return ownerCOSUploadResult{
		ObjectKey: objectKey,
		URL:       ownerCOSProxyURL(objectKey),
		MIMEType:  mimeType,
		Size:      len(body),
	}, nil
}

func ownerCOSObjectKey(kind, filename string) string {
	now := time.Now().UTC()
	if kind == "gallery" {
		return path.Join("gallery", now.Format("2006"), now.Format("01"), filename)
	}
	if kind == "ai-image" {
		return path.Join("ai-images", now.Format("2006"), now.Format("01"), filename)
	}
	if kind == "avatar" {
		return path.Join("avatars", now.Format("2006"), now.Format("01"), filename)
	}
	return path.Join("articles", now.Format("2006"), now.Format("01"), filename)
}

func ownerCOSProxyURL(objectKey string) string {
	escapedPath := ownerCOSEscapedObjectPath(objectKey)
	if escapedPath == "" {
		return ""
	}
	return "/cos/" + escapedPath
}

func ownerCOSEscapedObjectPath(objectKey string) string {
	parts := strings.Split(strings.TrimLeft(objectKey, "/"), "/")
	for i, part := range parts {
		parts[i] = url.PathEscape(part)
	}
	return strings.Join(parts, "/")
}
