package main

import (
	"html"
	"strings"
	"unicode"
	"unicode/utf8"
)

var guestbookUnsafeEventAttrs = []string{
	"onabort=",
	"onanimationstart=",
	"onblur=",
	"onchange=",
	"onclick=",
	"onerror=",
	"onfocus=",
	"oninput=",
	"onload=",
	"onmouseenter=",
	"onmouseover=",
	"onpointerenter=",
	"onsubmit=",
}

func guestbookLooksUnsafe(raw string) bool {
	decoded := strings.ToLower(html.UnescapeString(raw))
	compact := guestbookCompactForUnsafeCheck(decoded)
	if strings.Contains(compact, "javascript:") ||
		strings.Contains(compact, "vbscript:") ||
		strings.Contains(compact, "data:text/html") {
		return true
	}
	for _, attr := range guestbookUnsafeEventAttrs {
		if strings.Contains(compact, attr) {
			return true
		}
	}
	return guestbookHasHTMLLikeTag(decoded)
}

func guestbookCompactForUnsafeCheck(value string) string {
	var b strings.Builder
	b.Grow(len(value))
	for _, r := range value {
		if unicode.IsSpace(r) || unicode.IsControl(r) {
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

func guestbookHasHTMLLikeTag(value string) bool {
	for start := strings.IndexRune(value, '<'); start >= 0; {
		rest := value[start+1:]
		end := strings.IndexRune(rest, '>')
		if end < 0 {
			return false
		}
		inside := strings.TrimSpace(rest[:end])
		inside = strings.TrimLeft(inside, "/")
		if inside != "" {
			first, _ := utf8.DecodeRuneInString(inside)
			if unicode.IsLetter(first) || first == '!' || first == '?' {
				return true
			}
		}
		next := start + end + 2
		if next >= len(value) {
			return false
		}
		remaining := value[next:]
		offset := strings.IndexRune(remaining, '<')
		if offset < 0 {
			return false
		}
		start = next + offset
	}
	return false
}
