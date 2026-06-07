package main

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode"
)

const (
	ownerPublishDefaultAPIBase = "https://api.github.com"
	ownerPublishDefaultOwner   = "bistutzyy"
	ownerPublishDefaultRepo    = "taozhiyy"
	ownerPublishDefaultBranch  = "master"
	ownerPublishPathPrefix     = "blog/source/_posts/"
)

type ownerPublishRequest struct {
	DraftID  int64  `json:"draftId"`
	Title    string `json:"title"`
	Body     string `json:"body"`
	CoverURL string `json:"coverUrl"`
}

type ownerPublishResult struct {
	Path      string
	CommitSHA string
}

type ownerPublishError struct {
	StatusCode int
	Message    string
}

func (e *ownerPublishError) Error() string {
	if e == nil {
		return ""
	}
	return e.Message
}

type ownerGitHubPublisher struct {
	baseURL string
	owner   string
	repo    string
	branch  string
	token   string
	http    *http.Client
}

func newOwnerGitHubPublisher() *ownerGitHubPublisher {
	return &ownerGitHubPublisher{
		baseURL: strings.TrimRight(env("OWNER_PUBLISH_GITHUB_API_BASE", ownerPublishDefaultAPIBase), "/"),
		owner:   strings.TrimSpace(env("OWNER_PUBLISH_GITHUB_OWNER", ownerPublishDefaultOwner)),
		repo:    strings.TrimSpace(env("OWNER_PUBLISH_GITHUB_REPO", ownerPublishDefaultRepo)),
		branch:  strings.TrimSpace(env("OWNER_PUBLISH_GITHUB_BRANCH", ownerPublishDefaultBranch)),
		token:   strings.TrimSpace(env("OWNER_PUBLISH_GITHUB_TOKEN", "")),
		http:    &http.Client{Timeout: 20 * time.Second},
	}
}

func (p *ownerGitHubPublisher) configured() bool {
	return p != nil &&
		p.baseURL != "" &&
		p.owner != "" &&
		p.repo != "" &&
		p.branch != "" &&
		p.token != ""
}

func ownerPublishHandler(w http.ResponseWriter, r *http.Request) {
	ownerSess, ok := requireOwnerSession(w, r)
	if !ok {
		return
	}

	var body ownerPublishRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_JSON",
			"message": "Invalid publish request body.",
		})
		return
	}

	title := strings.TrimSpace(body.Title)
	if title == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_TITLE",
			"message": "Publish title is required.",
		})
		return
	}
	if len([]rune(title)) > ownerDraftTitleMax {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_TITLE",
			"message": "Publish title is too long.",
		})
		return
	}

	rawBody := strings.TrimSpace(body.Body)
	if rawBody == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_BODY",
			"message": "Publish body is required.",
		})
		return
	}
	if len(body.Body) > ownerDraftBodyMax {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_BODY",
			"message": "Publish body is too large.",
		})
		return
	}

	publisher := newOwnerGitHubPublisher()
	if !publisher.configured() {
		writeJSONStatus(w, http.StatusServiceUnavailable, map[string]any{
			"error":   "PUBLISH_NOT_CONFIGURED",
			"message": "Owner publish is not configured on the server yet.",
		})
		return
	}

	now := time.Now().UTC()
	postPath, markdown := buildOwnerPublishedPost(title, body.Body, strings.TrimSpace(body.CoverURL), now)
	result, err := publisher.publishMarkdown(postPath, title, markdown)
	if err != nil {
		var publishErr *ownerPublishError
		if ok := errorAs(err, &publishErr); ok {
			status := http.StatusBadGateway
			if publishErr.StatusCode == http.StatusConflict || publishErr.StatusCode == http.StatusUnprocessableEntity {
				status = http.StatusConflict
			}
			writeJSONStatus(w, status, map[string]any{
				"error":   "PUBLISH_FAILED",
				"message": publishErr.Message,
			})
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if body.DraftID > 0 {
		publishedAt := now.Format(time.RFC3339)
		if _, err := db.Exec(
			`UPDATE owner_drafts SET status = 'published', updated_at = ? WHERE id = ?`,
			publishedAt,
			body.DraftID,
		); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}

	writeJSON(w, map[string]any{
		"ok": true,
		"item": map[string]any{
			"path":          result.Path,
			"commitSha":     result.CommitSHA,
			"branch":        publisher.branch,
			"commitMessage": ownerPublishCommitMessage(title),
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

func (p *ownerGitHubPublisher) publishMarkdown(postPath, title, markdown string) (ownerPublishResult, error) {
	result, err := p.putMarkdown(postPath, title, markdown)
	if err == nil {
		return result, nil
	}

	var publishErr *ownerPublishError
	if !errorAs(err, &publishErr) {
		return ownerPublishResult{}, err
	}
	if publishErr.StatusCode != http.StatusConflict && publishErr.StatusCode != http.StatusUnprocessableEntity {
		return ownerPublishResult{}, publishErr
	}

	fallbackPath := ownerPublishConflictPath(postPath, time.Now().UTC())
	return p.putMarkdown(fallbackPath, title, markdown)
}

func (p *ownerGitHubPublisher) putMarkdown(postPath, title, markdown string) (ownerPublishResult, error) {
	payload := map[string]any{
		"message": ownerPublishCommitMessage(title),
		"content": base64.StdEncoding.EncodeToString([]byte(markdown)),
		"branch":  p.branch,
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
		escapeGitHubContentPath(postPath),
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

func buildOwnerPublishedPost(title, rawBody, coverURL string, now time.Time) (string, string) {
	filePath := ownerPublishPathPrefix + ownerPublishFilename(title, now)
	frontMatter, body := splitOwnerFrontMatter(rawBody)
	mergedFrontMatter := mergeOwnerFrontMatter(frontMatter, title, coverURL, now)
	content := strings.TrimLeft(strings.ReplaceAll(body, "\r\n", "\n"), "\n")
	if content == "" {
		content = "# " + title + "\n"
	}
	return filePath, mergedFrontMatter + "\n\n" + strings.TrimRight(content, "\n") + "\n"
}

func splitOwnerFrontMatter(raw string) (string, string) {
	content := strings.TrimPrefix(strings.ReplaceAll(raw, "\r\n", "\n"), "\ufeff")
	if !strings.HasPrefix(content, "---\n") {
		return "", content
	}
	end := strings.Index(content[4:], "\n---\n")
	if end < 0 {
		if strings.HasSuffix(content, "\n---") {
			return content[4 : len(content)-4], ""
		}
		return "", content
	}
	idx := 4 + end
	return content[4:idx], content[idx+5:]
}

func mergeOwnerFrontMatter(frontMatter, title, coverURL string, now time.Time) string {
	dateValue := now.Format("2006-01-02 15:04:05")
	coverValue := strings.TrimSpace(coverURL)
	otherLines := make([]string, 0, 8)
	trimmedFrontMatter := strings.Trim(frontMatter, "\n")
	if trimmedFrontMatter != "" {
		for _, line := range strings.Split(trimmedFrontMatter, "\n") {
			key, value, ok := ownerFrontMatterKV(line)
			if !ok {
				otherLines = append(otherLines, line)
				continue
			}

			switch key {
			case "title":
				continue
			case "date":
				trimmed := trimOwnerYAMLScalar(value)
				if trimmed != "" {
					dateValue = trimmed
				}
			case "cover":
				if coverValue == "" {
					coverValue = trimOwnerYAMLScalar(value)
				}
			default:
				otherLines = append(otherLines, line)
			}
		}
	}

	lines := []string{
		"title: " + ownerYAMLScalar(title),
		"date: " + dateValue,
	}
	if coverValue != "" {
		lines = append(lines, "cover: "+ownerYAMLScalar(coverValue))
	}
	lines = append(lines, otherLines...)
	return "---\n" + strings.Join(lines, "\n") + "\n---"
}

func ownerYAMLScalar(value string) string {
	if value == "" {
		return `""`
	}
	for i, r := range value {
		switch {
		case r == '#' || r == '"' || r == '\'' || r == '[' || r == ']' || r == '{' || r == '}':
			return strconv.Quote(value)
		case unicode.IsSpace(r) && (i == 0 || i == len(value)-1):
			return strconv.Quote(value)
		}
	}
	return value
}

func ownerFrontMatterKV(line string) (string, string, bool) {
	if strings.HasPrefix(line, " ") || strings.HasPrefix(line, "\t") {
		return "", "", false
	}
	idx := strings.IndexRune(line, ':')
	if idx <= 0 {
		return "", "", false
	}
	return strings.TrimSpace(line[:idx]), strings.TrimSpace(line[idx+1:]), true
}

func trimOwnerYAMLScalar(value string) string {
	value = strings.TrimSpace(value)
	if len(value) >= 2 {
		if (strings.HasPrefix(value, `"`) && strings.HasSuffix(value, `"`)) ||
			(strings.HasPrefix(value, `'`) && strings.HasSuffix(value, `'`)) {
			return value[1 : len(value)-1]
		}
	}
	return value
}

func ownerPublishFilename(title string, now time.Time) string {
	stem := ownerPublishStem(title)
	if stem == "" {
		stem = "post-" + now.Format("20060102-150405")
	}
	return stem + ".md"
}

func ownerPublishStem(title string) string {
	title = strings.TrimSpace(title)
	if title == "" {
		return ""
	}

	var b strings.Builder
	lastDash := false
	for _, r := range title {
		switch {
		case unicode.IsLetter(r) || unicode.IsNumber(r):
			if r <= unicode.MaxASCII {
				r = unicode.ToLower(r)
			}
			b.WriteRune(r)
			lastDash = false
		case unicode.IsSpace(r) || r == '-' || r == '_':
			if !lastDash && b.Len() > 0 {
				b.WriteByte('-')
				lastDash = true
			}
		default:
			if !lastDash && b.Len() > 0 {
				b.WriteByte('-')
				lastDash = true
			}
		}
	}
	return strings.Trim(b.String(), "-")
}

func ownerPublishConflictPath(path string, now time.Time) string {
	suffix := "-" + now.Format("20060102-150405")
	if !strings.HasSuffix(path, ".md") {
		return path + suffix
	}
	return strings.TrimSuffix(path, ".md") + suffix + ".md"
}

func ownerPublishCommitMessage(title string) string {
	return "feat: publish " + title
}

func ownerPublishAPIMessage(body []byte, statusCode int) string {
	var payload map[string]any
	if err := json.Unmarshal(body, &payload); err == nil {
		if message, ok := payload["message"].(string); ok && strings.TrimSpace(message) != "" {
			return message
		}
	}
	if trimmed := strings.TrimSpace(string(body)); trimmed != "" {
		return trimmed
	}
	return fmt.Sprintf("GitHub publish failed with HTTP %d", statusCode)
}

func escapeGitHubContentPath(path string) string {
	parts := strings.Split(strings.TrimLeft(path, "/"), "/")
	for i, part := range parts {
		parts[i] = url.PathEscape(part)
	}
	return strings.Join(parts, "/")
}

func errorAs(err error, target any) bool {
	switch t := target.(type) {
	case **ownerPublishError:
		publishErr, ok := err.(*ownerPublishError)
		if !ok {
			return false
		}
		*t = publishErr
		return true
	default:
		return false
	}
}
