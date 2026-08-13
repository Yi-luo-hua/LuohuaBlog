package main

import (
	"bytes"
	"encoding/base64"
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

const ownerGalleryDataPath = "main/src/data/galleryAlbums.js"

type ownerGalleryPublishRequest struct {
	AlbumID    string `json:"albumId"`
	AlbumTitle string `json:"albumTitle"`
	ImageURL   string `json:"imageUrl"`
}

type ownerGalleryPublishResult struct {
	AlbumID       string
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

	result, err := publisher.publishGalleryImage(body)
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
			"albumId":       result.AlbumID,
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

func (p *ownerGitHubPublisher) publishGalleryImage(req ownerGalleryPublishRequest) (ownerGalleryPublishResult, error) {
	file, err := p.getGitHubFile(ownerGalleryDataPath)
	if err != nil {
		return ownerGalleryPublishResult{}, err
	}
	updated, result, err := buildOwnerGalleryDataUpdate(file.Content, req)
	if err != nil {
		return ownerGalleryPublishResult{}, err
	}
	result.Path = ownerGalleryDataPath
	result.CommitMessage = ownerGalleryPublishCommitMessage(result.AlbumID)
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
	if !ownerIsPublicImageURL(imageURL) {
		return "", ownerGalleryPublishResult{}, errors.New("相册图片 URL 必须是公开的 http 或 https 地址")
	}

	albumID := strings.TrimSpace(req.AlbumID)
	albumTitle := strings.TrimSpace(req.AlbumTitle)
	if albumID == "" {
		albumID = ownerAlbumSlug(albumTitle)
	}
	if albumTitle == "" {
		albumTitle = albumID
	}
	if albumID == "" || albumID == "default" {
		return "", ownerGalleryPublishResult{}, errors.New("请选择相册或填写自定义相册名")
	}

	updated, found, changed, err := appendImageToGalleryAlbum(source, albumID, imageURL)
	if err != nil {
		return "", ownerGalleryPublishResult{}, err
	}
	if !found {
		updated, err = appendNewGalleryAlbum(source, albumID, albumTitle, imageURL)
		if err != nil {
			return "", ownerGalleryPublishResult{}, err
		}
		changed = true
	}

	return updated, ownerGalleryPublishResult{
		AlbumID:  albumID,
		ImageURL: imageURL,
		Changed:  changed,
	}, nil
}

func appendImageToGalleryAlbum(source, albumID, imageURL string) (string, bool, bool, error) {
	albumStart, albumEnd, ok := findGalleryAlbumObject(source, albumID)
	if !ok {
		return source, false, false, nil
	}

	object := source[albumStart:albumEnd]
	if strings.Contains(object, jsStringLiteral(imageURL)) {
		return source, true, false, nil
	}

	imagesRel := strings.Index(object, "images: [")
	if imagesRel < 0 {
		return "", true, false, fmt.Errorf("相册 %q 缺少 images 数组", albumID)
	}
	arrayOpen := albumStart + imagesRel + strings.Index(object[imagesRel:], "[")
	arrayClose, ok := findMatchingJS(source, arrayOpen, '[', ']')
	if !ok || arrayClose > albumEnd {
		return "", true, false, fmt.Errorf("相册 %q 的 images 数组无效", albumID)
	}

	return insertGalleryImageBeforeArrayClose(source, arrayOpen, arrayClose, imageURL), true, true, nil
}

func appendNewGalleryAlbum(source, albumID, albumTitle, imageURL string) (string, error) {
	arrayOpen := strings.Index(source, "export const galleryAlbums = [")
	if arrayOpen < 0 {
		return "", errors.New("未找到 galleryAlbums 导出")
	}
	arrayOpen += strings.Index(source[arrayOpen:], "[")
	arrayClose, ok := findMatchingJS(source, arrayOpen, '[', ']')
	if !ok {
		return "", errors.New("galleryAlbums 数组无效")
	}

	closeLineStart := strings.LastIndex(source[:arrayClose], "\n") + 1
	album := newGalleryAlbumLiteral(albumID, albumTitle, imageURL)
	return source[:closeLineStart] + album + source[closeLineStart:], nil
}

func findGalleryAlbumObject(source, albumID string) (int, int, bool) {
	idPattern := "id: " + jsStringLiteral(albumID)
	idIndex := strings.Index(source, idPattern)
	if idIndex < 0 {
		return 0, 0, false
	}
	start := strings.LastIndex(source[:idIndex], "{")
	if start < 0 {
		return 0, 0, false
	}
	end, ok := findMatchingJS(source, start, '{', '}')
	if !ok {
		return 0, 0, false
	}
	return start, end + 1, true
}

func insertGalleryImageBeforeArrayClose(source string, arrayOpen, arrayClose int, imageURL string) string {
	closeLineStart := strings.LastIndex(source[:arrayClose], "\n") + 1
	closeIndent := leadingWhitespace(source[closeLineStart:arrayClose])
	entryIndent := galleryArrayEntryIndent(source[arrayOpen+1:arrayClose], closeIndent)
	entry := entryIndent + jsStringLiteral(imageURL) + ",\n"
	return source[:closeLineStart] + entry + source[closeLineStart:]
}

func galleryArrayEntryIndent(arrayBody, closeIndent string) string {
	lines := strings.Split(arrayBody, "\n")
	for i := len(lines) - 1; i >= 0; i-- {
		trimmed := strings.TrimSpace(lines[i])
		if strings.HasPrefix(trimmed, `"`) || strings.HasPrefix(trimmed, "`") {
			return leadingWhitespace(lines[i])
		}
	}
	return closeIndent + "  "
}

func newGalleryAlbumLiteral(albumID, albumTitle, imageURL string) string {
	return strings.Join([]string{
		"  {",
		"    id: " + jsStringLiteral(albumID) + ",",
		"    title: " + jsStringLiteral(albumTitle) + ",",
		"    eyebrow: \"站长上传\",",
		"    description: \"由站长控制器上传。\",",
		"    tone: \"from-[#F6FBFF] via-[#FFF8F1] to-[#FFEAF4]\",",
		"    accent: \"#FF8FAB\",",
		"    cover: " + jsStringLiteral(imageURL) + ",",
		"    images: [",
		"      " + jsStringLiteral(imageURL) + ",",
		"    ],",
		"  },",
	}, "\n") + "\n"
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

func leadingWhitespace(value string) string {
	return value[:len(value)-len(strings.TrimLeft(value, " \t"))]
}

func ownerGalleryPublishCommitMessage(albumID string) string {
	return "feat: publish gallery image to " + albumID + " " + time.Now().UTC().Format("20060102-150405")
}
