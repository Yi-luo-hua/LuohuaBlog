package main

import (
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const obsidianPublishMaxBytes = ownerDraftBodyMax + 32*1024

type obsidianPublishRequest struct {
	Title    string `json:"title"`
	Body     string `json:"body"`
	CoverURL string `json:"coverUrl"`
	DryRun   bool   `json:"dryRun"`
}

func obsidianPublishHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		methodNotAllowed(w)
		return
	}

	expectedToken := strings.TrimSpace(env("OBSIDIAN_PUBLISH_TOKEN", ""))
	if expectedToken == "" {
		writeJSONStatus(w, http.StatusServiceUnavailable, map[string]any{
			"error": "OBSIDIAN_PUBLISH_NOT_CONFIGURED", "message": "Obsidian 发布接口尚未配置。",
		})
		return
	}
	if !validObsidianBearerToken(r.Header.Get("Authorization"), expectedToken) {
		recordSecurityAudit(r, "integration.obsidian_publish", "failure", 0, "blog_post", "", "invalid_token")
		w.Header().Set("WWW-Authenticate", `Bearer realm="blog-publish"`)
		writeJSONStatus(w, http.StatusUnauthorized, map[string]any{
			"error": "UNAUTHORIZED", "message": "发布令牌无效。",
		})
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, obsidianPublishMaxBytes)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	var body obsidianPublishRequest
	if err := decoder.Decode(&body); err != nil {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error": "INVALID_JSON", "message": "Obsidian 发布请求格式不正确。",
		})
		return
	}

	title := strings.TrimSpace(body.Title)
	if title == "" {
		title = obsidianTitleFromMarkdown(body.Body)
	}
	if title == "" || len([]rune(title)) > ownerDraftTitleMax {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error": "INVALID_TITLE", "message": "文章标题不能为空，且不能超过 120 个字符。",
		})
		return
	}
	if strings.TrimSpace(body.Body) == "" || len(body.Body) > ownerDraftBodyMax {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error": "INVALID_BODY", "message": "文章正文不能为空，且不能超过 200000 字节。",
		})
		return
	}

	now := time.Now().UTC()
	postPath, markdown := buildOwnerPublishedPost(title, body.Body, strings.TrimSpace(body.CoverURL), now)
	if body.DryRun {
		writeJSON(w, map[string]any{
			"ok": true,
			"item": map[string]any{
				"path": postPath, "title": title, "dryRun": true, "markdown": markdown,
			},
		})
		return
	}

	publisher := newOwnerGitHubPublisher()
	if !publisher.configured() {
		recordSecurityAudit(r, "integration.obsidian_publish", "failure", 0, "blog_post", postPath, "github_not_configured")
		writeJSONStatus(w, http.StatusServiceUnavailable, map[string]any{
			"error": "PUBLISH_NOT_CONFIGURED", "message": "GitHub 发布尚未在服务器配置。",
		})
		return
	}

	result, err := publisher.publishMarkdown(postPath, title, markdown)
	if err != nil {
		var publishErr *ownerPublishError
		if errorAs(err, &publishErr) {
			status := http.StatusBadGateway
			if publishErr.StatusCode == http.StatusConflict || publishErr.StatusCode == http.StatusUnprocessableEntity {
				status = http.StatusConflict
			}
			recordSecurityAudit(r, "integration.obsidian_publish", "failure", 0, "blog_post", postPath, "github_status="+strconv.Itoa(publishErr.StatusCode))
			writeJSONStatus(w, status, map[string]any{
				"error": "PUBLISH_FAILED", "message": publishErr.Message,
			})
			return
		}
		recordSecurityAudit(r, "integration.obsidian_publish", "failure", 0, "blog_post", postPath, "internal_error")
		http.Error(w, "发布失败。", http.StatusInternalServerError)
		return
	}

	recordSecurityAudit(r, "integration.obsidian_publish", "success", 0, "blog_post", result.Path, "branch="+publisher.branch)
	writeJSON(w, map[string]any{
		"ok": true,
		"item": map[string]any{
			"path": result.Path, "title": title, "commitSha": result.CommitSHA,
			"branch": publisher.branch, "commitMessage": ownerPublishCommitMessage(title),
			"repoURL": fmt.Sprintf("https://github.com/%s/%s/blob/%s/%s", publisher.owner, publisher.repo, publisher.branch, result.Path),
		},
	})
}

func validObsidianBearerToken(header, expected string) bool {
	const prefix = "Bearer "
	if !strings.HasPrefix(header, prefix) {
		return false
	}
	provided := strings.TrimSpace(strings.TrimPrefix(header, prefix))
	if len(provided) != len(expected) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(provided), []byte(expected)) == 1
}

func obsidianTitleFromMarkdown(markdown string) string {
	frontMatter, body := splitOwnerFrontMatter(markdown)
	for _, line := range strings.Split(frontMatter, "\n") {
		key, value, ok := ownerFrontMatterKV(line)
		if ok && strings.EqualFold(key, "title") {
			return strings.TrimSpace(trimOwnerYAMLScalar(value))
		}
	}
	for _, line := range strings.Split(strings.ReplaceAll(body, "\r\n", "\n"), "\n") {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "# ") {
			return strings.TrimSpace(strings.TrimPrefix(trimmed, "# "))
		}
	}
	return ""
}
