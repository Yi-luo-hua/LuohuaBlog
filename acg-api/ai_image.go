package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	aiImageDailyLimit              = 3
	aiImageMaxRunes                = 400
	aiImageDefaultSize             = "1024*1024"
	aiImageMaxBytes                = 12 * 1024 * 1024
	aiImageDefaultAgnesModel       = "agnes-image-2.1-flash"
	aiImageDefaultDashScopeModel   = "z-image-turbo"
	aiImageDefaultAgnesBaseURL     = "https://apihub.agnes-ai.com"
	aiImageDefaultDashScopeBaseURL = "https://dashscope.aliyuncs.com/api/v1"
)

var (
	aiImageGeneratorFactory                   = newAIImageGenerator
	aiImageDownloadURL      aiImageDownloader = downloadAIImageURL
)

type aiImageDownloader func(ctx context.Context, rawURL string) ([]byte, string, error)

type aiImageGenerator interface {
	Generate(ctx context.Context, prompt, size string) (aiImageProviderResult, error)
}

type aiImageProviderResult struct {
	ImageURL  string
	RequestID string
	Model     string
	Size      string
	Width     int
	Height    int
}

type dashScopeImageGenerator struct {
	apiKey  string
	baseURL string
	model   string
	http    *http.Client
}

type agnesImageGenerator struct {
	apiKey  string
	baseURL string
	model   string
	http    *http.Client
}

func aiImageHandler(w http.ResponseWriter, r *http.Request) {
	id, userID, loggedIn := resolveAIImageIdentity(r)
	configured := aiImageConfigured()

	switch r.Method {
	case http.MethodGet:
		snap, err := getQuotaSnapshot(db, id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		out := chatQuotaJSON(snap)
		out["imageEnabled"] = configured
		out["canGenerate"] = loggedIn && configured && (id.Unlimited || snap.Remaining > 0)
		out["model"] = aiImageModel()
		out["promptExtend"] = false
		out["userId"] = userID
		writeJSON(w, out)
	case http.MethodPost:
		if !allowAPIPost(aiImagePostLimiter, r) {
			writeAPIRateLimited(w)
			return
		}
		handleAIImagePost(w, r, id, userID, loggedIn, configured)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func handleAIImagePost(w http.ResponseWriter, r *http.Request, id chatIdentity, userID int64, loggedIn, configured bool) {
	if !loggedIn {
		writeJSONStatus(w, http.StatusUnauthorized, map[string]any{
			"error":   "LOGIN_REQUIRED",
			"message": "请先登录后再生图，避免额度被刷爆。",
		})
		return
	}
	if !configured {
		snap, _ := getQuotaSnapshot(db, id)
		writeJSONStatus(w, http.StatusServiceUnavailable, map[string]any{
			"error":        "IMAGE_NOT_CONFIGURED",
			"message":      "生图还没配置 Agnes API Key，站长配好后就能用了。",
			"imageEnabled": false,
			"limit":        snap.Limit,
			"used":         snap.Used,
			"remaining":    snap.Remaining,
			"isLogin":      id.IsLogin,
			"unlimited":    snap.Unlimited,
		})
		return
	}

	var body struct {
		Prompt string `json:"prompt"`
		Size   string `json:"size"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_JSON",
			"message": "请求格式不正确。",
		})
		return
	}
	prompt := normalizeAIImagePrompt(body.Prompt)
	if prompt == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "EMPTY_PROMPT",
			"message": "先写一句想生成什么画面吧。",
		})
		return
	}
	if utf8.RuneCountInString(prompt) > aiImageMaxRunes {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "PROMPT_TOO_LONG",
			"message": "生图描述最多 400 个字。",
		})
		return
	}
	size := normalizeAIImageSize(body.Size)

	preSnap, _ := getQuotaSnapshot(db, id)
	if !id.Unlimited && preSnap.Used >= id.Limit {
		writeJSONStatus(w, http.StatusTooManyRequests, quotaErrBody(id, preSnap, errDailyExceeded))
		return
	}
	snap, err := reserveQuota(db, id)
	if err != nil {
		var qe *quotaError
		if errors.As(err, &qe) {
			if snap.Used == 0 {
				snap, _ = getQuotaSnapshot(db, id)
			}
			writeJSONStatus(w, http.StatusTooManyRequests, quotaErrBody(id, snap, qe))
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	generator, err := aiImageGeneratorFactory()
	if err != nil {
		rollbackQuota(db, id)
		snap, _ = getQuotaSnapshot(db, id)
		writeJSONStatus(w, http.StatusServiceUnavailable, map[string]any{
			"error":     "IMAGE_NOT_CONFIGURED",
			"message":   "生图还没配置 Agnes API Key，站长配好后就能用了。",
			"limit":     snap.Limit,
			"used":      snap.Used,
			"remaining": snap.Remaining,
			"isLogin":   id.IsLogin,
			"unlimited": snap.Unlimited,
		})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 90*time.Second)
	defer cancel()

	providerResult, err := generator.Generate(ctx, prompt, size)
	if err != nil {
		rollbackQuota(db, id)
		snap, _ = getQuotaSnapshot(db, id)
		writeJSONStatus(w, http.StatusBadGateway, map[string]any{
			"error":     "IMAGE_PROVIDER_ERROR",
			"message":   "Agnes 生图暂时失败了，请稍后再试。",
			"limit":     snap.Limit,
			"used":      snap.Used,
			"remaining": snap.Remaining,
			"isLogin":   id.IsLogin,
			"unlimited": snap.Unlimited,
		})
		return
	}
	imageBytes, mimeType, err := aiImageDownloadURL(ctx, providerResult.ImageURL)
	if err != nil {
		rollbackQuota(db, id)
		snap, _ = getQuotaSnapshot(db, id)
		writeJSONStatus(w, http.StatusBadGateway, map[string]any{
			"error":     "IMAGE_DOWNLOAD_ERROR",
			"message":   "生图完成了，但临时图片下载失败，请稍后再试。",
			"limit":     snap.Limit,
			"used":      snap.Used,
			"remaining": snap.Remaining,
			"isLogin":   id.IsLogin,
			"unlimited": snap.Unlimited,
		})
		return
	}

	uploader, err := ownerAssetUploadFactory()
	if err != nil {
		rollbackQuota(db, id)
		snap, _ = getQuotaSnapshot(db, id)
		writeJSONStatus(w, http.StatusServiceUnavailable, map[string]any{
			"error":     "COS_NOT_CONFIGURED",
			"message":   "腾讯 COS 上传尚未配置，不能保存生成图。",
			"limit":     snap.Limit,
			"used":      snap.Used,
			"remaining": snap.Remaining,
			"isLogin":   id.IsLogin,
			"unlimited": snap.Unlimited,
		})
		return
	}
	ext := aiImageExtFromMIME(mimeType)
	item, err := uploader.UploadImage("ai-image", "", ownerUploadFilename(ext), mimeType, imageBytes)
	if err != nil {
		rollbackQuota(db, id)
		snap, _ = getQuotaSnapshot(db, id)
		writeJSONStatus(w, http.StatusBadGateway, map[string]any{
			"error":     "COS_UPLOAD_ERROR",
			"message":   "生成图保存到 COS 失败，请稍后再试。",
			"limit":     snap.Limit,
			"used":      snap.Used,
			"remaining": snap.Remaining,
			"isLogin":   id.IsLogin,
			"unlimited": snap.Unlimited,
		})
		return
	}

	if err := recordAIImageGeneration(db, userID, id.Key, prompt, providerResult, item); err != nil {
		rollbackQuota(db, id)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	out := chatQuotaJSON(snap)
	out["imageEnabled"] = true
	out["canGenerate"] = id.Unlimited || snap.Remaining > 0
	out["model"] = providerResult.Model
	out["size"] = providerResult.Size
	out["requestId"] = providerResult.RequestID
	out["promptExtend"] = false
	imageURL := ownerCOSProxyURL(item.ObjectKey)
	if imageURL == "" {
		imageURL = item.URL
	}
	out["image"] = map[string]any{
		"url":      imageURL,
		"path":     item.ObjectKey,
		"mimeType": item.MIMEType,
		"size":     item.Size,
		"width":    providerResult.Width,
		"height":   providerResult.Height,
	}
	writeJSON(w, out)
}

func resolveAIImageIdentity(r *http.Request) (chatIdentity, int64, bool) {
	sess, ok := sessionFromRequest(r)
	if !ok {
		return chatIdentity{Key: "image:guest", IsLogin: false, Limit: 0}, 0, false
	}
	if sess.Unlimited {
		return chatIdentity{
			Key:       "image:user:" + formatUserID(sess.UserID),
			IsLogin:   true,
			Limit:     0,
			Unlimited: true,
		}, sess.UserID, true
	}
	return chatIdentity{
		Key:     "image:user:" + formatUserID(sess.UserID),
		IsLogin: true,
		Limit:   aiImageDailyLimit,
	}, sess.UserID, true
}

func aiImageConfigured() bool {
	return agnesImageAPIKey() != "" || dashScopeImageAPIKey() != ""
}

func agnesImageAPIKey() string {
	return strings.TrimSpace(env("AGNES_API_KEY", ""))
}

func dashScopeImageAPIKey() string {
	if v := strings.TrimSpace(env("DASHSCOPE_API_KEY", "")); v != "" {
		return v
	}
	return strings.TrimSpace(env("ALIYUN_BAILIAN_API_KEY", ""))
}

func agnesImageBaseURL() string {
	return strings.TrimRight(env("AGNES_BASE_URL", aiImageDefaultAgnesBaseURL), "/")
}

func dashScopeImageBaseURL() string {
	return strings.TrimRight(env("DASHSCOPE_BASE_URL", aiImageDefaultDashScopeBaseURL), "/")
}

func aiImageModel() string {
	if agnesImageAPIKey() != "" || dashScopeImageAPIKey() == "" {
		return agnesImageModel()
	}
	return dashScopeImageModel()
}

func agnesImageModel() string {
	if v := strings.TrimSpace(env("AGNES_IMAGE_MODEL", "")); v != "" {
		return v
	}
	if v := strings.TrimSpace(env("AI_IMAGE_MODEL", "")); strings.HasPrefix(strings.ToLower(v), "agnes-") {
		return v
	}
	return aiImageDefaultAgnesModel
}

func dashScopeImageModel() string {
	return strings.TrimSpace(env("AI_IMAGE_MODEL", aiImageDefaultDashScopeModel))
}

func newAIImageGenerator() (aiImageGenerator, error) {
	if key := agnesImageAPIKey(); key != "" {
		return agnesImageGenerator{
			apiKey:  key,
			baseURL: agnesImageBaseURL(),
			model:   agnesImageModel(),
			http:    &http.Client{Timeout: 90 * time.Second},
		}, nil
	}
	if key := dashScopeImageAPIKey(); key != "" {
		return dashScopeImageGenerator{
			apiKey:  key,
			baseURL: dashScopeImageBaseURL(),
			model:   dashScopeImageModel(),
			http:    &http.Client{Timeout: 90 * time.Second},
		}, nil
	}
	return nil, errors.New("ai image provider api key not configured")
}

func (g agnesImageGenerator) Generate(ctx context.Context, prompt, size string) (aiImageProviderResult, error) {
	body := map[string]any{
		"model":  g.model,
		"prompt": prompt,
		"size":   agnesImageRequestSize(size),
		"extra_body": map[string]any{
			"response_format": "url",
		},
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return aiImageProviderResult{}, err
	}
	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		agnesImageEndpoint(g.baseURL),
		bytes.NewReader(raw),
	)
	if err != nil {
		return aiImageProviderResult{}, err
	}
	req.Header.Set("Authorization", "Bearer "+g.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	res, err := g.http.Do(req)
	if err != nil {
		return aiImageProviderResult{}, err
	}
	defer res.Body.Close()
	respBody, _ := io.ReadAll(res.Body)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return aiImageProviderResult{}, fmt.Errorf("agnes http %d: %s", res.StatusCode, truncate(string(respBody), 240))
	}

	result, err := parseAgnesImageResponse(respBody)
	if err != nil {
		return aiImageProviderResult{}, err
	}
	result.Model = g.model
	if result.Size == "" {
		result.Size = size
	}
	return result, nil
}

func agnesImageEndpoint(baseURL string) string {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if strings.HasSuffix(baseURL, "/v1") {
		return baseURL + "/images/generations"
	}
	return baseURL + "/v1/images/generations"
}

func agnesImageRequestSize(size string) string {
	return strings.ReplaceAll(strings.TrimSpace(size), "*", "x")
}

func (g dashScopeImageGenerator) Generate(ctx context.Context, prompt, size string) (aiImageProviderResult, error) {
	body := map[string]any{
		"model": g.model,
		"input": map[string]any{
			"messages": []map[string]any{
				{
					"role": "user",
					"content": []map[string]string{
						{"text": prompt},
					},
				},
			},
		},
		"parameters": map[string]any{
			"size":          size,
			"n":             1,
			"prompt_extend": false,
			"watermark":     false,
		},
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return aiImageProviderResult{}, err
	}
	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		g.baseURL+"/services/aigc/multimodal-generation/generation",
		bytes.NewReader(raw),
	)
	if err != nil {
		return aiImageProviderResult{}, err
	}
	req.Header.Set("Authorization", "Bearer "+g.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	res, err := g.http.Do(req)
	if err != nil {
		return aiImageProviderResult{}, err
	}
	defer res.Body.Close()
	respBody, _ := io.ReadAll(res.Body)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return aiImageProviderResult{}, fmt.Errorf("dashscope http %d: %s", res.StatusCode, truncate(string(respBody), 240))
	}

	result, err := parseDashScopeImageResponse(respBody)
	if err != nil {
		return aiImageProviderResult{}, err
	}
	result.Model = g.model
	if result.Size == "" {
		result.Size = size
	}
	return result, nil
}

func parseDashScopeImageResponse(raw []byte) (aiImageProviderResult, error) {
	var payload struct {
		RequestID string `json:"request_id"`
		Output    struct {
			Choices []struct {
				Message struct {
					Content []struct {
						Image string `json:"image"`
						Text  string `json:"text"`
					} `json:"content"`
				} `json:"message"`
			} `json:"choices"`
			Results []struct {
				URL string `json:"url"`
			} `json:"results"`
			TaskID string `json:"task_id"`
		} `json:"output"`
		Usage struct {
			Width      int `json:"width"`
			Height     int `json:"height"`
			ImageCount int `json:"image_count"`
		} `json:"usage"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return aiImageProviderResult{}, err
	}
	imageURL := ""
	for _, choice := range payload.Output.Choices {
		for _, content := range choice.Message.Content {
			if strings.TrimSpace(content.Image) != "" {
				imageURL = strings.TrimSpace(content.Image)
				break
			}
		}
		if imageURL != "" {
			break
		}
	}
	if imageURL == "" {
		for _, item := range payload.Output.Results {
			if strings.TrimSpace(item.URL) != "" {
				imageURL = strings.TrimSpace(item.URL)
				break
			}
		}
	}
	if imageURL == "" {
		return aiImageProviderResult{}, errors.New("empty dashscope image response")
	}
	return aiImageProviderResult{
		ImageURL:  imageURL,
		RequestID: payload.RequestID,
		Width:     payload.Usage.Width,
		Height:    payload.Usage.Height,
	}, nil
}

func parseAgnesImageResponse(raw []byte) (aiImageProviderResult, error) {
	var payload struct {
		Data []struct {
			URL string `json:"url"`
		} `json:"data"`
	}
	if err := json.Unmarshal(raw, &payload); err != nil {
		return aiImageProviderResult{}, err
	}
	for _, item := range payload.Data {
		if imageURL := strings.TrimSpace(item.URL); imageURL != "" {
			return aiImageProviderResult{ImageURL: imageURL}, nil
		}
	}
	return aiImageProviderResult{}, errors.New("empty agnes image response")
}

func downloadAIImageURL(ctx context.Context, rawURL string) ([]byte, string, error) {
	rawURL = strings.TrimSpace(rawURL)
	if rawURL == "" {
		return nil, "", errors.New("empty image url")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rawURL, nil)
	if err != nil {
		return nil, "", err
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return nil, "", fmt.Errorf("download image http %d", res.StatusCode)
	}
	buf, err := io.ReadAll(io.LimitReader(res.Body, aiImageMaxBytes+1))
	if err != nil {
		return nil, "", err
	}
	if len(buf) == 0 {
		return nil, "", errors.New("empty image body")
	}
	if len(buf) > aiImageMaxBytes {
		return nil, "", errors.New("image too large")
	}
	mimeType := strings.TrimSpace(res.Header.Get("Content-Type"))
	if i := strings.Index(mimeType, ";"); i >= 0 {
		mimeType = strings.TrimSpace(mimeType[:i])
	}
	if !strings.HasPrefix(mimeType, "image/") {
		mimeType = http.DetectContentType(buf)
	}
	if !strings.HasPrefix(mimeType, "image/") {
		return nil, "", errors.New("downloaded body is not image")
	}
	return buf, mimeType, nil
}

func normalizeAIImagePrompt(prompt string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(prompt)), " ")
}

func normalizeAIImageSize(size string) string {
	switch strings.TrimSpace(size) {
	case "1024*1024", "1280*720", "720*1280":
		return strings.TrimSpace(size)
	default:
		return aiImageDefaultSize
	}
}

func aiImageExtFromMIME(mimeType string) string {
	switch strings.ToLower(strings.TrimSpace(mimeType)) {
	case "image/jpeg", "image/jpg":
		return ".jpg"
	case "image/webp":
		return ".webp"
	case "image/png":
		return ".png"
	default:
		return ".png"
	}
}

func recordAIImageGeneration(db *sql.DB, userID int64, identityKey, prompt string, providerResult aiImageProviderResult, item ownerCOSUploadResult) error {
	now := time.Now().UTC().Format(time.RFC3339)
	var userValue any
	if userID > 0 {
		userValue = userID
	}
	_, err := db.Exec(
		`INSERT INTO ai_image_generations
		 (user_id, identity_key, prompt, model, size, image_url, object_key, provider_request_id, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		userValue,
		identityKey,
		prompt,
		providerResult.Model,
		providerResult.Size,
		item.URL,
		item.ObjectKey,
		providerResult.RequestID,
		now,
	)
	return err
}
