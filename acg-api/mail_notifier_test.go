package main

import (
	"encoding/base64"
	"errors"
	"strings"
	"testing"
)

func TestSMTPMailerFromEnvDisabledWhenRequiredConfigMissing(t *testing.T) {
	t.Setenv("SMTP_HOST", "")
	t.Setenv("SMTP_PORT", "")
	t.Setenv("SMTP_USER", "")
	t.Setenv("SMTP_PASS", "")

	if _, ok := smtpMailerFromEnv(); ok {
		t.Fatal("expected SMTP mailer to be disabled when required config is missing")
	}
}

func TestSendGuestbookMailFailsWhenSMTPConfigMissing(t *testing.T) {
	prev := guestbookMailer
	guestbookMailer = nil
	t.Cleanup(func() { guestbookMailer = prev })
	t.Setenv("SMTP_HOST", "")
	t.Setenv("SMTP_PORT", "")
	t.Setenv("SMTP_USER", "")
	t.Setenv("SMTP_PASS", "")

	err := sendGuestbookMail(outboundMail{
		To:      "receiver@example.com",
		Subject: "桃之夭夭：你的留言收到回复",
		Body:    "中文邮件配置测试",
	})

	if !errors.Is(err, errSMTPNotConfigured) {
		t.Fatalf("expected errSMTPNotConfigured, got %v", err)
	}
}

func TestBuildMailMessageEncodesUTF8BodyAsBase64(t *testing.T) {
	body := "你好，这是一封桃之夭夭留言通知。"
	raw := string(buildMailMessage(
		"sender@qq.com",
		"桃之夭夭通知",
		"receiver@example.com",
		"桃之夭夭：新的留言通知",
		body,
	))

	if !strings.Contains(raw, "Content-Type: text/plain; charset=UTF-8") {
		t.Fatalf("expected UTF-8 content type, got %q", raw)
	}
	if !strings.Contains(raw, "Content-Transfer-Encoding: base64") {
		t.Fatalf("expected base64 transfer encoding, got %q", raw)
	}
	if strings.Contains(raw, body) {
		t.Fatalf("expected body to be encoded instead of written as raw UTF-8: %q", raw)
	}
	if !strings.Contains(strings.ToLower(raw), "subject: =?utf-8?") {
		t.Fatalf("expected MIME-encoded UTF-8 subject, got %q", raw)
	}
	if !strings.Contains(strings.ToLower(raw), "from: =?utf-8?") {
		t.Fatalf("expected MIME-encoded UTF-8 from name, got %q", raw)
	}

	parts := strings.SplitN(raw, "\r\n\r\n", 2)
	if len(parts) != 2 {
		t.Fatalf("expected headers/body separator, got %q", raw)
	}
	encodedBody := strings.NewReplacer("\r", "", "\n", "").Replace(parts[1])
	decoded, err := base64.StdEncoding.DecodeString(encodedBody)
	if err != nil {
		t.Fatalf("decode base64 body: %v", err)
	}
	if string(decoded) != body {
		t.Fatalf("expected decoded body %q, got %q", body, decoded)
	}
}

func TestBuildMailMessagePreservesChineseAndEmoji(t *testing.T) {
	body := "你在桃之夭夭留下的留言收到回复。😭😂"
	raw := string(buildMailMessage(
		"sender@qq.com",
		"taozhiyy.top",
		"receiver@example.com",
		"桃之夭夭：你的留言收到回复",
		body,
	))

	if strings.Contains(raw, body) {
		t.Fatalf("expected raw body to be base64 encoded, got %q", raw)
	}
	if !strings.Contains(raw, "Content-Transfer-Encoding: base64") {
		t.Fatalf("expected base64 transfer encoding, got %q", raw)
	}
	parts := strings.SplitN(raw, "\r\n\r\n", 2)
	if len(parts) != 2 {
		t.Fatalf("expected headers/body separator, got %q", raw)
	}
	encodedBody := strings.NewReplacer("\r", "", "\n", "").Replace(parts[1])
	decoded, err := base64.StdEncoding.DecodeString(encodedBody)
	if err != nil {
		t.Fatalf("decode base64 body: %v", err)
	}
	if string(decoded) != body {
		t.Fatalf("expected decoded body %q, got %q", body, decoded)
	}
}

func TestSMTPMailerIntegrationSendCleanMessage(t *testing.T) {
	if env("RUN_SMTP_INTEGRATION", "") != "1" {
		t.Skip("set RUN_SMTP_INTEGRATION=1 with SMTP_* and TEST_SMTP_TO to send a real message")
	}
	to := normalizeEmail(env("TEST_SMTP_TO", ""))
	if to == "" {
		t.Fatal("TEST_SMTP_TO is required")
	}
	mailer, ok := smtpMailerFromEnv()
	if !ok {
		t.Fatal("SMTP mailer is disabled")
	}
	if err := mailer.Send(outboundMail{
		To:      to,
		Subject: "桃之夭夭：正式邮件测试",
		Body:    "这是一封正式模板测试邮件。\n如果你看到中文正常显示，说明邮件编码已经修复。",
	}); err != nil {
		t.Fatalf("send integration mail: %v", err)
	}
}
