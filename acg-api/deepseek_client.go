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

const deepseekSystemPrompt = "You are the Taozhiyy site AI assistant. Be concise, friendly, and lightly anime-styled without overdoing it. Answer in the user's language. If current page context is provided, treat it as ground truth for what the user is viewing. Do not invent page content that is not present in the supplied context. Prefer answers about the site, posts, technical content, learning notes, and the current page."

type chatPageContext struct {
	PageURL     string   `json:"pageUrl"`
	PageTitle   string   `json:"pageTitle"`
	PagePath    string   `json:"pagePath"`
	Language    string   `json:"language"`
	SiteSection string   `json:"siteSection"`
	Headings    []string `json:"headings"`
	VisibleText string   `json:"visibleText"`
}

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

func buildChatUserContent(msg, pageURL, pageTitle string, pageContext chatPageContext) string {
	msg = strings.TrimSpace(msg)
	pageURL = strings.TrimSpace(pageURL)
	pageTitle = strings.TrimSpace(pageTitle)
	pageContext = normalizeChatPageContext(pageContext, pageURL, pageTitle)
	if pageURL == "" && pageTitle == "" && !pageContext.hasContent() {
		return msg
	}
	var b strings.Builder
	b.WriteString("[Current page context]\n")
	if pageContext.PageTitle != "" {
		b.WriteString("Title: ")
		b.WriteString(pageContext.PageTitle)
		b.WriteString("\n")
	}
	if pageContext.PageURL != "" {
		b.WriteString("URL: ")
		b.WriteString(pageContext.PageURL)
		b.WriteString("\n")
	}
	if pageContext.PagePath != "" {
		b.WriteString("Path: ")
		b.WriteString(pageContext.PagePath)
		b.WriteString("\n")
	}
	if pageContext.SiteSection != "" {
		b.WriteString("Section: ")
		b.WriteString(pageContext.SiteSection)
		b.WriteString("\n")
	}
	if pageContext.Language != "" {
		b.WriteString("Language: ")
		b.WriteString(pageContext.Language)
		b.WriteString("\n")
	}
	if len(pageContext.Headings) > 0 {
		b.WriteString("Headings: ")
		b.WriteString(strings.Join(pageContext.Headings, " | "))
		b.WriteString("\n")
	}
	if pageContext.VisibleText != "" {
		b.WriteString("Visible text: ")
		b.WriteString(pageContext.VisibleText)
		b.WriteString("\n")
	}
	b.WriteString("\n[User question]\n")
	b.WriteString(msg)
	return b.String()
}

func (c *deepseekClient) Chat(userMessage, pageURL, pageTitle string, pageContext chatPageContext) (string, error) {
	if c.apiKey == "" {
		return "", fmt.Errorf("DEEPSEEK_API_KEY not configured")
	}
	userContent := buildChatUserContent(userMessage, pageURL, pageTitle, pageContext)
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
	return s[:maxLen] + "..."
}

func normalizeChatPageContext(ctx chatPageContext, fallbackURL, fallbackTitle string) chatPageContext {
	ctx.PageURL = limitString(strings.TrimSpace(firstNonEmpty(ctx.PageURL, fallbackURL)), 400)
	ctx.PageTitle = limitRunes(strings.TrimSpace(firstNonEmpty(ctx.PageTitle, fallbackTitle)), 120)
	ctx.PagePath = limitRunes(strings.TrimSpace(ctx.PagePath), 160)
	ctx.Language = limitRunes(strings.TrimSpace(ctx.Language), 30)
	ctx.SiteSection = limitRunes(strings.TrimSpace(ctx.SiteSection), 60)
	ctx.VisibleText = limitRunes(normalizeSpace(ctx.VisibleText), 2200)

	headings := make([]string, 0, len(ctx.Headings))
	seen := map[string]bool{}
	for _, heading := range ctx.Headings {
		text := limitRunes(normalizeSpace(heading), 120)
		if text == "" || seen[text] {
			continue
		}
		seen[text] = true
		headings = append(headings, text)
		if len(headings) >= 10 {
			break
		}
	}
	ctx.Headings = headings
	return ctx
}

func (ctx chatPageContext) hasContent() bool {
	return ctx.PageURL != "" ||
		ctx.PageTitle != "" ||
		ctx.PagePath != "" ||
		ctx.Language != "" ||
		ctx.SiteSection != "" ||
		len(ctx.Headings) > 0 ||
		ctx.VisibleText != ""
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func normalizeSpace(value string) string {
	return strings.Join(strings.Fields(value), " ")
}

func limitRunes(value string, maxLen int) string {
	runes := []rune(value)
	if len(runes) <= maxLen {
		return value
	}
	return string(runes[:maxLen]) + "..."
}

func limitString(value string, maxLen int) string {
	if len(value) <= maxLen {
		return value
	}
	return value[:maxLen] + "..."
}
