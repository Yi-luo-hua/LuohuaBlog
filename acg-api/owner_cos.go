package main

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"strings"
	"time"

	"github.com/tencentyun/cos-go-sdk-v5"
)

type ownerCOSConfig struct {
	secretID  string
	secretKey string
	bucket    string
	region    string
	baseURL   string
}

type ownerCOSUploadResult struct {
	ObjectKey string
	URL       string
	MIMEType  string
	Size      int
}

type ownerAssetUploader interface {
	UploadImage(kind, album, filename, mimeType string, body []byte) (ownerCOSUploadResult, error)
}

type ownerTencentCOSUploader struct {
	cfg    ownerCOSConfig
	client *cos.Client
}

func loadOwnerCOSConfig() (ownerCOSConfig, error) {
	cfg := ownerCOSConfig{
		secretID:  strings.TrimSpace(env("TENCENT_COS_SECRET_ID", "")),
		secretKey: strings.TrimSpace(env("TENCENT_COS_SECRET_KEY", "")),
		bucket:    strings.TrimSpace(env("TENCENT_COS_BUCKET", "")),
		region:    strings.TrimSpace(env("TENCENT_COS_REGION", "")),
		baseURL:   strings.TrimRight(strings.TrimSpace(env("TENCENT_COS_BASE_URL", "")), "/"),
	}
	if cfg.secretID == "" || cfg.secretKey == "" || cfg.bucket == "" || cfg.region == "" {
		return ownerCOSConfig{}, errors.New("cos upload not configured")
	}
	if cfg.baseURL == "" {
		cfg.baseURL = fmt.Sprintf("https://%s.cos.%s.myqcloud.com", cfg.bucket, cfg.region)
	}
	return cfg, nil
}

func newOwnerAssetUploader() (ownerAssetUploader, error) {
	cfg, err := loadOwnerCOSConfig()
	if err != nil {
		return nil, err
	}
	return ownerTencentCOSUploader{
		cfg:    cfg,
		client: newOwnerCOSClient(cfg),
	}, nil
}

func newOwnerCOSClient(cfg ownerCOSConfig) *cos.Client {
	base, _ := url.Parse(fmt.Sprintf("https://%s.cos.%s.myqcloud.com", cfg.bucket, cfg.region))
	service := &cos.BaseURL{BucketURL: base}
	return cos.NewClient(service, &http.Client{
		Transport: &cos.AuthorizationTransport{
			SecretID:  cfg.secretID,
			SecretKey: cfg.secretKey,
		},
	})
}

func (u ownerTencentCOSUploader) UploadImage(kind, album, filename, mimeType string, body []byte) (ownerCOSUploadResult, error) {
	objectKey := ownerCOSObjectKey(kind, album, filename)
	opt := &cos.ObjectPutOptions{
		ObjectPutHeaderOptions: &cos.ObjectPutHeaderOptions{
			ContentType: mimeType,
		},
	}
	if _, err := u.client.Object.Put(context.Background(), objectKey, bytes.NewReader(body), opt); err != nil {
		return ownerCOSUploadResult{}, err
	}
	return ownerCOSUploadResult{
		ObjectKey: objectKey,
		URL:       ownerCOSPublicURL(u.cfg, objectKey),
		MIMEType:  mimeType,
		Size:      len(body),
	}, nil
}

var ownerAlbumSlugPattern = regexp.MustCompile(`[^a-z0-9]+`)

func ownerAlbumSlug(input string) string {
	raw := strings.ToLower(strings.TrimSpace(input))
	raw = ownerAlbumSlugPattern.ReplaceAllString(raw, "-")
	raw = strings.Trim(raw, "-")
	if raw == "" {
		return "default"
	}
	return raw
}

func ownerCOSObjectKey(kind, album, filename string) string {
	if kind == "gallery" {
		return path.Join("gallery", ownerAlbumSlug(album), filename)
	}
	now := time.Now().UTC()
	return path.Join("articles", now.Format("2006"), now.Format("01"), filename)
}

func ownerCOSPublicURL(cfg ownerCOSConfig, objectKey string) string {
	parts := strings.Split(strings.TrimLeft(objectKey, "/"), "/")
	for i, part := range parts {
		parts[i] = url.PathEscape(part)
	}
	return cfg.baseURL + "/" + strings.Join(parts, "/")
}
