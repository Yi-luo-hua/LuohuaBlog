package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const deepseekSystemPrompt = "你是一个博客 AI 小助手，名字叫博客小精灵。说话简洁、友好、轻微二次元风格，但不要过度卖萌。用户消息里可能附带当前页面的标题和链接，可据此理解用户所在位置；不要编造页面正文里不存在的内容。优先回答和博客文章、技术内容、学习内容相关的问题。回答尽量简短。"

type deepseekClient struct {
	apiKey  string
	baseURL string
	model   string
	http    *http.Client
}

func newDeepSeekClient() *deepseekClient {
	base := env("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
	return &deepseekClient{
		apiKey:  env("DEEPSEEK_API_KEY", ""),
		baseURL: strings.TrimRight(base, "/"),
		model:   env("DEEPSEEK_MODEL", "deepseek-v4-flash"),
		http:    &http.Client{Timeout: 45 * time.Second},
	}
}

func chatConfigured() bool {
	return env("DEEPSEEK_API_KEY", "") != ""
}

func buildChatUserContent(msg, pageURL, pageTitle string) string {
	msg = strings.TrimSpace(msg)
	pageURL = strings.TrimSpace(pageURL)
	pageTitle = strings.TrimSpace(pageTitle)
	if pageURL == "" && pageTitle == "" {
		return msg
	}
	if len([]rune(pageTitle)) > 120 {
		pageTitle = string([]rune(pageTitle)[:120]) + "…"
	}
	if len(pageURL) > 400 {
		pageURL = pageURL[:400] + "…"
	}
	var b strings.Builder
	b.WriteString("【用户当前浏览的页面】\n")
	if pageTitle != "" {
		b.WriteString("标题：")
		b.WriteString(pageTitle)
		b.WriteString("\n")
	}
	if pageURL != "" {
		b.WriteString("链接：")
		b.WriteString(pageURL)
		b.WriteString("\n")
	}
	b.WriteString("\n【用户问题】\n")
	b.WriteString(msg)
	return b.String()
}

func (c *deepseekClient) Chat(userMessage, pageURL, pageTitle string) (string, error) {
	if c.apiKey == "" {
		return "", fmt.Errorf("DEEPSEEK_API_KEY not configured")
	}
	userContent := buildChatUserContent(userMessage, pageURL, pageTitle)
	body := map[string]any{
		"model": c.model,
		"messages": []map[string]string{
			{"role": "system", "content": deepseekSystemPrompt},
			{"role": "user", "content": userContent},
		},
		"temperature": 0.7,
		"max_tokens":  400,
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return "", err
	}
	endpoint := c.baseURL + "/v1/chat/completions"
	req, err := http.NewRequest(http.MethodPost, endpoint, bytes.NewReader(raw))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	res, err := c.http.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	respBody, _ := io.ReadAll(res.Body)
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return "", fmt.Errorf("deepseek http %d: %s", res.StatusCode, truncate(string(respBody), 200))
	}

	var payload struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(respBody, &payload); err != nil {
		return "", err
	}
	if len(payload.Choices) == 0 || strings.TrimSpace(payload.Choices[0].Message.Content) == "" {
		return "", fmt.Errorf("empty deepseek response")
	}
	return payload.Choices[0].Message.Content, nil
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "…"
}
