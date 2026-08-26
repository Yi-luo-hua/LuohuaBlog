package main

import (
	"bytes"
	"crypto/sha1"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const ownerGalleryDataPath = "main/src/data/galleryPhotos.js"

// 相册不再分册：一张照片就是列表里的一条，新发布的插在最前面。
type ownerGalleryPublishRequest struct {
	ImageURL string `json:"imageUrl"`
	ThumbURL string `json:"thumbUrl"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
	Title    string `json:"title"`
}

type ownerGalleryPublishResult struct {
	PhotoID       string
	ImageURL      string
	Path          string
	CommitSHA     string
	Changed       bool
	CommitMessage string
}

func ownerGalleryPublishHandler(w http.ResponseWriter, r *http.Request) {
	ownerSess, ok := requireOwnerSession(w, r)
	if !ok {
		return
	}

	var body ownerGalleryPublishRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_JSON",
			"message": "相册发布请求格式不正确。",
		})
		return
	}

	publisher := newOwnerGitHubPublisher()
	if !publisher.configured() {
		recordSecurityAudit(r, "owner.gallery_publish", "failure", ownerSess.UserID, "owner_publish", ownerGalleryDataPath, "not_configured")
		writeJSONStatus(w, http.StatusServiceUnavailable, map[string]any{
			"error":   "PUBLISH_NOT_CONFIGURED",
			"message": "站长发布尚未在服务器配置。",
		})
		return
	}

	result, err := publisher.publishGalleryPhoto(body)
	if err != nil {
		var publishErr *ownerPublishError
		if ok := errorAs(err, &publishErr); ok {
			writeJSONStatus(w, http.StatusBadGateway, map[string]any{
				"error":   "GALLERY_PUBLISH_FAILED",
				"message": publishErr.Message,
			})
			recordSecurityAudit(r, "owner.gallery_publish", "failure", ownerSess.UserID, "owner_publish", ownerGalleryDataPath, fmt.Sprintf("github_status=%d", publishErr.StatusCode))
			return
		}
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_GALLERY_PUBLISH",
			"message": err.Error(),
		})
		recordSecurityAudit(r, "owner.gallery_publish", "failure", ownerSess.UserID, "owner_publish", ownerGalleryDataPath, "invalid_request")
		return
	}

	recordSecurityAudit(r, "owner.gallery_publish", "success", ownerSess.UserID, "owner_publish", result.Path, fmt.Sprintf("branch=%s changed=%t", publisher.branch, result.Changed))
	writeJSON(w, map[string]any{
		"ok": true,
		"item": map[string]any{
			"photoId":       result.PhotoID,
			"imageUrl":      result.ImageURL,
			"path":          result.Path,
			"commitSha":     result.CommitSHA,
			"changed":       result.Changed,
			"branch":        publisher.branch,
			"commitMessage": result.CommitMessage,
			"repoURL": fmt.Sprintf(
				"https://github.com/%s/%s/blob/%s/%s",
				publisher.owner,
				publisher.repo,
				publisher.branch,
				result.Path,
			),
		},
		"owner": map[string]any{
			"email":       ownerSess.Email,
			"displayName": ownerSess.DisplayName,
		},
	})
}

func (p *ownerGitHubPublisher) publishGalleryPhoto(req ownerGalleryPublishRequest) (ownerGalleryPublishResult, error) {
	file, err := p.getGitHubFile(ownerGalleryDataPath)
	if err != nil {
		return ownerGalleryPublishResult{}, err
	}
	updated, result, err := buildOwnerGalleryDataUpdate(file.Content, req)
	if err != nil {
		return ownerGalleryPublishResult{}, err
	}
	result.Path = ownerGalleryDataPath
	result.CommitMessage = ownerGalleryPublishCommitMessage(result.PhotoID)
	if !result.Changed {
		return result, nil
	}
	putResult, err := p.putGitHubFile(ownerGalleryDataPath, result.CommitMessage, updated, file.SHA)
	if err != nil {
		return ownerGalleryPublishResult{}, err
	}
	result.Path = putResult.Path
	result.CommitSHA = putResult.CommitSHA
	return result, nil
}

type ownerGitHubFile struct {
	Path    string
	SHA     string
	Content string
}

type ownerGitHubPullRequestResult struct {
	Number  int
	HTMLURL string
}

func (p *ownerGitHubPublisher) getGitHubFile(path string) (ownerGitHubFile, error) {
	endpoint := fmt.Sprintf(
		"%s/repos/%s/%s/contents/%s?ref=%s",
		p.baseURL,
		url.PathEscape(p.owner),
		url.PathEscape(p.repo),
		escapeGitHubContentPath(path),
		url.QueryEscape(p.branch),
	)
	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return ownerGitHubFile{}, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.token)

	res, err := p.http.Do(req)
	if err != nil {
		return ownerGitHubFile{}, err
	}
	defer res.Body.Close()
	respBody, err := io.ReadAll(res.Body)
	if err != nil {
		return ownerGitHubFile{}, err
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return ownerGitHubFile{}, &ownerPublishError{
			StatusCode: res.StatusCode,
			Message:    ownerPublishAPIMessage(respBody, res.StatusCode),
		}
	}

	var payload struct {
		Path     string `json:"path"`
		SHA      string `json:"sha"`
		Content  string `json:"content"`
		Encoding string `json:"encoding"`
	}
	if err := json.Unmarshal(respBody, &payload); err != nil {
		return ownerGitHubFile{}, err
	}
	if payload.SHA == "" {
		return ownerGitHubFile{}, errors.New("GitHub 文件响应缺少 sha")
	}
	rawContent := strings.ReplaceAll(payload.Content, "\n", "")
	decoded, err := base64.StdEncoding.DecodeString(rawContent)
	if err != nil {
		return ownerGitHubFile{}, err
	}
	return ownerGitHubFile{
		Path:    payload.Path,
		SHA:     payload.SHA,
		Content: string(decoded),
	}, nil
}

func (p *ownerGitHubPublisher) putGitHubFile(path, message, content, sha string) (ownerPublishResult, error) {
	return p.putGitHubFileToBranch(path, message, content, sha, p.branch)
}

func (p *ownerGitHubPublisher) putGitHubFileToBranch(path, message, content, sha, branch string) (ownerPublishResult, error) {
	payload := map[string]any{
		"message": message,
		"content": base64.StdEncoding.EncodeToString([]byte(content)),
		"branch":  branch,
		"sha":     sha,
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return ownerPublishResult{}, err
	}

	endpoint := fmt.Sprintf(
		"%s/repos/%s/%s/contents/%s",
		p.baseURL,
		url.PathEscape(p.owner),
		url.PathEscape(p.repo),
		escapeGitHubContentPath(path),
	)
	req, err := http.NewRequest(http.MethodPut, endpoint, bytes.NewReader(raw))
	if err != nil {
		return ownerPublishResult{}, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.token)
	req.Header.Set("Content-Type", "application/json")

	res, err := p.http.Do(req)
	if err != nil {
		return ownerPublishResult{}, err
	}
	defer res.Body.Close()
	respBody, err := io.ReadAll(res.Body)
	if err != nil {
		return ownerPublishResult{}, err
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return ownerPublishResult{}, &ownerPublishError{
			StatusCode: res.StatusCode,
			Message:    ownerPublishAPIMessage(respBody, res.StatusCode),
		}
	}

	var payloadResp struct {
		Content struct {
			Path string `json:"path"`
		} `json:"content"`
		Commit struct {
			SHA string `json:"sha"`
		} `json:"commit"`
	}
	if err := json.Unmarshal(respBody, &payloadResp); err != nil {
		return ownerPublishResult{}, err
	}
	return ownerPublishResult{
		Path:      payloadResp.Content.Path,
		CommitSHA: payloadResp.Commit.SHA,
	}, nil
}

func (p *ownerGitHubPublisher) getGitHubBranchHeadSHA(branch string) (string, error) {
	endpoint := fmt.Sprintf(
		"%s/repos/%s/%s/git/ref/heads/%s",
		p.baseURL,
		url.PathEscape(p.owner),
		url.PathEscape(p.repo),
		escapeGitHubContentPath(branch),
	)
	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.token)

	res, err := p.http.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	respBody, err := io.ReadAll(res.Body)
	if err != nil {
		return "", err
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return "", &ownerPublishError{
			StatusCode: res.StatusCode,
			Message:    ownerPublishAPIMessage(respBody, res.StatusCode),
		}
	}

	var payload struct {
		Object struct {
			SHA string `json:"sha"`
		} `json:"object"`
	}
	if err := json.Unmarshal(respBody, &payload); err != nil {
		return "", err
	}
	if payload.Object.SHA == "" {
		return "", errors.New("GitHub 分支响应缺少 sha")
	}
	return payload.Object.SHA, nil
}

func (p *ownerGitHubPublisher) createGitHubBranch(branch, sha string) error {
	payload := map[string]any{
		"ref": "refs/heads/" + branch,
		"sha": sha,
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	endpoint := fmt.Sprintf(
		"%s/repos/%s/%s/git/refs",
		p.baseURL,
		url.PathEscape(p.owner),
		url.PathEscape(p.repo),
	)
	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.token)
	req.Header.Set("Content-Type", "application/json")

	res, err := p.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	respBody, err := io.ReadAll(res.Body)
	if err != nil {
		return err
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return &ownerPublishError{
			StatusCode: res.StatusCode,
			Message:    ownerPublishAPIMessage(respBody, res.StatusCode),
		}
	}
	return nil
}

func (p *ownerGitHubPublisher) createGitHubPullRequest(title, body, head, base string) (ownerGitHubPullRequestResult, error) {
	payload := map[string]any{
		"title": title,
		"body":  body,
		"head":  head,
		"base":  base,
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return ownerGitHubPullRequestResult{}, err
	}

	endpoint := fmt.Sprintf(
		"%s/repos/%s/%s/pulls",
		p.baseURL,
		url.PathEscape(p.owner),
		url.PathEscape(p.repo),
	)
	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(raw))
	if err != nil {
		return ownerGitHubPullRequestResult{}, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.token)
	req.Header.Set("Content-Type", "application/json")

	res, err := p.http.Do(req)
	if err != nil {
		return ownerGitHubPullRequestResult{}, err
	}
	defer res.Body.Close()
	respBody, err := io.ReadAll(res.Body)
	if err != nil {
		return ownerGitHubPullRequestResult{}, err
	}
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return ownerGitHubPullRequestResult{}, &ownerPublishError{
			StatusCode: res.StatusCode,
			Message:    ownerPublishAPIMessage(respBody, res.StatusCode),
		}
	}

	var payloadResp struct {
		Number  int    `json:"number"`
		HTMLURL string `json:"html_url"`
	}
	if err := json.Unmarshal(respBody, &payloadResp); err != nil {
		return ownerGitHubPullRequestResult{}, err
	}
	return ownerGitHubPullRequestResult{
		Number:  payloadResp.Number,
		HTMLURL: payloadResp.HTMLURL,
	}, nil
}

func buildOwnerGalleryDataUpdate(source string, req ownerGalleryPublishRequest) (string, ownerGalleryPublishResult, error) {
	imageURL := strings.TrimSpace(req.ImageURL)
	if !ownerIsGalleryImageSource(imageURL) {
		return "", ownerGalleryPublishResult{}, errors.New("相册图片地址必须是站内 /cos/ 路径，或公开的 http/https 地址")
	}
	if !ownerAreUsableDimensions(req.Width, req.Height) {
		return "", ownerGalleryPublishResult{}, errors.New("相册图片必须带上原始像素宽高")
	}

	arrayOpen := strings.Index(source, ownerGalleryArrayDecl)
	if arrayOpen < 0 {
		return "", ownerGalleryPublishResult{}, errors.New("未找到 galleryPhotos 导出")
	}
	arrayOpen += strings.Index(source[arrayOpen:], "[")
	if _, ok := findMatchingJS(source, arrayOpen, '[', ']'); !ok {
		return "", ownerGalleryPublishResult{}, errors.New("galleryPhotos 数组无效")
	}

	// 同一个地址只收一次，重复发布不会在相册里堆出两张一样的照片。
	if strings.Contains(source, jsStringLiteral(imageURL)) {
		return source, ownerGalleryPublishResult{
			PhotoID:  ownerGalleryPhotoIDFor(imageURL, time.Now().UTC()),
			ImageURL: imageURL,
			Changed:  false,
		}, nil
	}

	// 缩略图是可选的：webp 解不开、图本来就小，都会没有，那就让列表页退回原图。
	thumbURL := strings.TrimSpace(req.ThumbURL)
	if thumbURL != "" && !ownerIsGalleryImageSource(thumbURL) {
		return "", ownerGalleryPublishResult{}, errors.New("缩略图地址必须是站内 /cos/ 路径，或公开的 http/https 地址")
	}

	now := time.Now().UTC()
	photoID := ownerGalleryPhotoIDFor(imageURL, now)
	entry := newGalleryPhotoLiteral(photoID, imageURL, thumbURL, strings.TrimSpace(req.Title), req.Width, req.Height, now)

	// 插在数组开头——相册按发布时间倒序展示，最新的一张要排在最前面。
	updated := source[:arrayOpen+1] + "\n" + entry + source[arrayOpen+1:]

	return updated, ownerGalleryPublishResult{
		PhotoID:  photoID,
		ImageURL: imageURL,
		Changed:  true,
	}, nil
}

const ownerGalleryArrayDecl = "export const galleryPhotos = ["

// 前端 isGalleryImageSource 是同一套规则，改这里记得两边一起改。
func ownerIsGalleryImageSource(value string) bool {
	source := strings.TrimSpace(value)
	if source == "" {
		return false
	}
	// `//host/x` 看着像站内路径，其实会被浏览器解析到别的站点上去。
	if strings.HasPrefix(source, "//") {
		return false
	}
	if strings.HasPrefix(source, "/") {
		return strings.HasPrefix(source, ownerGalleryCOSPrefix) && len(source) > len(ownerGalleryCOSPrefix)
	}
	return ownerIsPublicImageURL(source)
}

const ownerGalleryCOSPrefix = "/cos/"

const ownerGalleryMaxDimension = 100000

func ownerAreUsableDimensions(width, height int) bool {
	return width > 0 && height > 0 &&
		width <= ownerGalleryMaxDimension && height <= ownerGalleryMaxDimension
}

// 时间戳加地址摘要：既能按 id 排出先后，也不会两张照片撞在一起。
func ownerGalleryPhotoIDFor(imageURL string, now time.Time) string {
	sum := sha1.Sum([]byte(imageURL))
	return now.Format("20060102-150405") + "-" + hex.EncodeToString(sum[:3])
}

func newGalleryPhotoLiteral(photoID, imageURL, thumbURL, title string, width, height int, publishedAt time.Time) string {
	lines := []string{
		"  {",
		"    id: " + jsStringLiteral(photoID) + ",",
		"    src: " + jsStringLiteral(imageURL) + ",",
		"    width: " + strconv.Itoa(width) + ",",
		"    height: " + strconv.Itoa(height) + ",",
	}
	if thumbURL != "" {
		lines = append(lines, "    thumb: "+jsStringLiteral(thumbURL)+",")
	}
	if title != "" {
		lines = append(lines, "    title: "+jsStringLiteral(title)+",")
	}
	lines = append(lines,
		"    publishedAt: "+jsStringLiteral(publishedAt.Format(time.RFC3339))+",",
		"  },",
	)
	return strings.Join(lines, "\n") + "\n"
}

func findMatchingJS(source string, openIndex int, open, close byte) (int, bool) {
	if openIndex < 0 || openIndex >= len(source) || source[openIndex] != open {
		return 0, false
	}
	depth := 0
	inString := byte(0)
	escaped := false
	for i := openIndex; i < len(source); i++ {
		ch := source[i]
		if inString != 0 {
			if escaped {
				escaped = false
				continue
			}
			if ch == '\\' {
				escaped = true
				continue
			}
			if ch == inString {
				inString = 0
			}
			continue
		}
		if ch == '"' || ch == '\'' || ch == '`' {
			inString = ch
			continue
		}
		if ch == open {
			depth++
			continue
		}
		if ch == close {
			depth--
			if depth == 0 {
				return i, true
			}
		}
	}
	return 0, false
}

func ownerIsPublicImageURL(value string) bool {
	parsed, err := url.Parse(value)
	if err != nil {
		return false
	}
	return (parsed.Scheme == "http" || parsed.Scheme == "https") && parsed.Host != ""
}

func jsStringLiteral(value string) string {
	return strconv.Quote(value)
}

func ownerGalleryPublishCommitMessage(photoID string) string {
	return "feat: publish gallery photo " + photoID
}
