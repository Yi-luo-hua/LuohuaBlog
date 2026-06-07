package main

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"
	"unicode"

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
		secretID:  ownerCOSEnv("TENCENT_COS_SECRET_ID", "COS_SECRET_ID"),
		secretKey: ownerCOSEnv("TENCENT_COS_SECRET_KEY", "COS_SECRET_KEY"),
		bucket:    ownerCOSEnv("TENCENT_COS_BUCKET", "COS_BUCKET"),
		region:    ownerCOSEnv("TENCENT_COS_REGION", "COS_REGION"),
		baseURL:   strings.TrimRight(ownerCOSEnv("TENCENT_COS_BASE_URL", "COS_BASE_URL"), "/"),
	}
	if cfg.secretID == "" || cfg.secretKey == "" || cfg.bucket == "" || cfg.region == "" {
		return ownerCOSConfig{}, errors.New("cos upload not configured")
	}
	if cfg.baseURL == "" {
		cfg.baseURL = fmt.Sprintf("https://%s.cos.%s.myqcloud.com", cfg.bucket, cfg.region)
	}
	return cfg, nil
}

func ownerCOSEnv(primary, legacy string) string {
	value := strings.TrimSpace(env(primary, ""))
	if value != "" {
		return value
	}
	return strings.TrimSpace(env(legacy, ""))
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

func ownerAlbumSlug(input string) string {
	raw := strings.TrimSpace(input)
	if raw == "" {
		return "default"
	}

	var b strings.Builder
	lastDash := false
	for _, r := range raw {
		switch {
		case unicode.IsLetter(r) || unicode.IsNumber(r):
			if r <= unicode.MaxASCII {
				r = unicode.ToLower(r)
			}
			b.WriteRune(r)
			lastDash = false
		default:
			if !lastDash && b.Len() > 0 {
				b.WriteByte('-')
				lastDash = true
			}
		}
	}

	slug := strings.Trim(b.String(), "-")
	if slug == "" {
		return "default"
	}
	return slug
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
