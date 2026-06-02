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

const deepseekSystemPrompt = "你是一个博客 AI 小助手，名字叫博客小精灵。说话简洁、友好、轻微二次元风格，但不要过度卖萌。优先回答和博客文章、技术内容、学习内容相关的问题。回答尽量简短。"

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

func (c *deepseekClient) Chat(userMessage string) (string, error) {
	if c.apiKey == "" {
		return "", fmt.Errorf("DEEPSEEK_API_KEY not configured")
	}
	body := map[string]any{
		"model": c.model,
		"messages": []map[string]string{
			{"role": "system", "content": deepseekSystemPrompt},
			{"role": "user", "content": userMessage},
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
