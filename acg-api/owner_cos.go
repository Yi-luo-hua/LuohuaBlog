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
	UploadImage(kind, filename, mimeType string, body []byte) (ownerCOSUploadResult, error)
	// 缩略图要跟原图放在同一个目录、同一个文件名下，所以得能指定对象键。
	UploadImageAt(objectKey, mimeType string, body []byte) (ownerCOSUploadResult, error)
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

func (u ownerTencentCOSUploader) UploadImage(kind, filename, mimeType string, body []byte) (ownerCOSUploadResult, error) {
	return u.UploadImageAt(ownerCOSObjectKey(kind, filename), mimeType, body)
}

func (u ownerTencentCOSUploader) UploadImageAt(objectKey, mimeType string, body []byte) (ownerCOSUploadResult, error) {
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

func ownerCOSObjectKey(kind, filename string) string {
	// 相册不再分册，照片跟其他资源一样按年月归档。
	if kind == "gallery" {
		now := time.Now().UTC()
		return path.Join("gallery", now.Format("2006"), now.Format("01"), filename)
	}
	if kind == "ai-image" {
		now := time.Now().UTC()
		return path.Join("ai-images", now.Format("2006"), now.Format("01"), filename)
	}
	if kind == "avatar" {
		now := time.Now().UTC()
		return path.Join("avatars", now.Format("2006"), now.Format("01"), filename)
	}
	now := time.Now().UTC()
	return path.Join("articles", now.Format("2006"), now.Format("01"), filename)
}

func ownerCOSPublicURL(cfg ownerCOSConfig, objectKey string) string {
	escapedPath := ownerCOSEscapedObjectPath(objectKey)
	if escapedPath == "" {
		return cfg.baseURL
	}
	return cfg.baseURL + "/" + escapedPath
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
