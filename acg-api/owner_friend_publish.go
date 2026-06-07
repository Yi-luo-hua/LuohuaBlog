package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const ownerFriendCardsDataPath = "main/src/data/friendCards.js"

type ownerFriendPublishRequest struct {
	Name   string `json:"name"`
	Desc   string `json:"desc"`
	URL    string `json:"url"`
	Avatar string `json:"avatar"`
}

type ownerFriendPublishResult struct {
	Name          string
	URL           string
	Path          string
	CommitSHA     string
	Changed       bool
	CommitMessage string
}

func ownerFriendPublishHandler(w http.ResponseWriter, r *http.Request) {
	ownerSess, ok := requireOwnerSession(w, r)
	if !ok {
		return
	}

	var body ownerFriendPublishRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_JSON",
			"message": "友链发布请求格式不正确。",
		})
		return
	}

	publisher := newOwnerGitHubPublisher()
	if !publisher.configured() {
		writeJSONStatus(w, http.StatusServiceUnavailable, map[string]any{
			"error":   "PUBLISH_NOT_CONFIGURED",
			"message": "站长发布尚未在服务器配置。",
		})
		return
	}

	result, err := publisher.publishFriendCard(body)
	if err != nil {
		var publishErr *ownerPublishError
		if ok := errorAs(err, &publishErr); ok {
			writeJSONStatus(w, http.StatusBadGateway, map[string]any{
				"error":   "FRIEND_PUBLISH_FAILED",
				"message": publishErr.Message,
			})
			return
		}
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_FRIEND_PUBLISH",
			"message": err.Error(),
		})
		return
	}

	writeJSON(w, map[string]any{
		"ok": true,
		"item": map[string]any{
			"name":          result.Name,
			"url":           result.URL,
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

func (p *ownerGitHubPublisher) publishFriendCard(req ownerFriendPublishRequest) (ownerFriendPublishResult, error) {
	file, err := p.getGitHubFile(ownerFriendCardsDataPath)
	if err != nil {
		return ownerFriendPublishResult{}, err
	}
	updated, result, err := buildOwnerFriendCardsUpdate(file.Content, req)
	if err != nil {
		return ownerFriendPublishResult{}, err
	}
	result.Path = ownerFriendCardsDataPath
	result.CommitMessage = ownerFriendPublishCommitMessage(result.Name)
	if !result.Changed {
		return result, nil
	}
	putResult, err := p.putGitHubFile(ownerFriendCardsDataPath, result.CommitMessage, updated, file.SHA)
	if err != nil {
		return ownerFriendPublishResult{}, err
	}
	result.Path = putResult.Path
	result.CommitSHA = putResult.CommitSHA
	return result, nil
}

func buildOwnerFriendCardsUpdate(source string, req ownerFriendPublishRequest) (string, ownerFriendPublishResult, error) {
	name := strings.TrimSpace(req.Name)
	desc := strings.TrimSpace(req.Desc)
	friendURL := strings.TrimSpace(req.URL)
	avatar := strings.TrimSpace(req.Avatar)

	if name == "" {
		return "", ownerFriendPublishResult{}, errors.New("友链站点名称不能为空")
	}
	if desc == "" {
		return "", ownerFriendPublishResult{}, errors.New("友链站点描述不能为空")
	}
	if !ownerIsPublicImageURL(friendURL) {
		return "", ownerFriendPublishResult{}, errors.New("友链 URL 必须是公开的 http 或 https 地址")
	}
	if avatar == "" {
		avatar = ownerFriendDefaultAvatar(friendURL)
	} else if !ownerIsPublicImageURL(avatar) {
		return "", ownerFriendPublishResult{}, errors.New("友链头像 URL 必须是公开的 http 或 https 地址")
	}

	if strings.Contains(source, jsStringLiteral(friendURL)) {
		return source, ownerFriendPublishResult{
			Name:    name,
			URL:     friendURL,
			Changed: false,
		}, nil
	}

	arrayOpen := strings.Index(source, "export const friendCards = [")
	if arrayOpen < 0 {
		return "", ownerFriendPublishResult{}, errors.New("未找到 friendCards 导出")
	}
	arrayOpen += strings.Index(source[arrayOpen:], "[")
	arrayClose, ok := findMatchingJS(source, arrayOpen, '[', ']')
	if !ok {
		return "", ownerFriendPublishResult{}, errors.New("friendCards 数组无效")
	}

	closeLineStart := strings.LastIndex(source[:arrayClose], "\n") + 1
	card := newFriendCardLiteral(name, desc, friendURL, avatar)
	return source[:closeLineStart] + card + source[closeLineStart:], ownerFriendPublishResult{
		Name:    name,
		URL:     friendURL,
		Changed: true,
	}, nil
}

func newFriendCardLiteral(name, desc, friendURL, avatar string) string {
	return strings.Join([]string{
		"  {",
		"    name: " + jsStringLiteral(name) + ",",
		"    desc: " + jsStringLiteral(desc) + ",",
		"    url: " + jsStringLiteral(friendURL) + ",",
		"    avatar: " + jsStringLiteral(avatar) + ",",
		"    note: \"FRIEND\",",
		"  },",
	}, "\n") + "\n"
}

func ownerFriendDefaultAvatar(friendURL string) string {
	parsed, err := url.Parse(friendURL)
	if err != nil || parsed.Host == "" {
		return ""
	}
	return "https://www.google.com/s2/favicons?sz=128&domain=" + url.QueryEscape(parsed.Host)
}

func ownerFriendPublishCommitMessage(name string) string {
	return "feat: publish friend link " + name + " " + time.Now().UTC().Format("20060102-150405")
}
