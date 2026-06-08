package main

import (
	"crypto/tls"
	"encoding/base64"
	"errors"
	"fmt"
	"log"
	"mime"
	"net"
	"net/smtp"
	"strings"
)

type outboundMail struct {
	To      string
	Subject string
	Body    string
}

type siteMailer interface {
	Send(outboundMail) error
}

var guestbookMailer siteMailer

var errSMTPNotConfigured = errors.New("smtp mailer is not configured")

type smtpMailer struct {
	host     string
	port     string
	user     string
	pass     string
	fromName string
}

func smtpMailerFromEnv() (siteMailer, bool) {
	host := strings.TrimSpace(env("SMTP_HOST", ""))
	port := strings.TrimSpace(env("SMTP_PORT", ""))
	user := normalizeEmail(env("SMTP_USER", ""))
	pass := strings.TrimSpace(env("SMTP_PASS", ""))
	if host == "" || port == "" || user == "" || pass == "" {
		return nil, false
	}
	fromName := strings.TrimSpace(env("SMTP_FROM_NAME", "Taozhiyy Notifications"))
	return smtpMailer{host: host, port: port, user: user, pass: pass, fromName: fromName}, true
}

func smtpMissingConfigKeys() []string {
	required := []struct {
		key   string
		value string
	}{
		{"SMTP_HOST", strings.TrimSpace(env("SMTP_HOST", ""))},
		{"SMTP_PORT", strings.TrimSpace(env("SMTP_PORT", ""))},
		{"SMTP_USER", normalizeEmail(env("SMTP_USER", ""))},
		{"SMTP_PASS", strings.TrimSpace(env("SMTP_PASS", ""))},
	}
	missing := make([]string, 0)
	for _, item := range required {
		if item.value == "" {
			missing = append(missing, item.key)
		}
	}
	return missing
}

func logSMTPMailerConfig() {
	missing := smtpMissingConfigKeys()
	if len(missing) == 0 {
		log.Printf("mail: SMTP configured for %s", normalizeEmail(env("SMTP_USER", "")))
		return
	}
	log.Printf("WARN: mail: SMTP disabled; missing %s", strings.Join(missing, ","))
}

func (m smtpMailer) Send(message outboundMail) error {
	to := normalizeEmail(message.To)
	if !validateEmail(to) {
		return fmt.Errorf("invalid recipient email")
	}
	addr := net.JoinHostPort(m.host, m.port)
	auth := smtp.PlainAuth("", m.user, m.pass, m.host)
	raw := buildMailMessage(m.user, m.fromName, to, message.Subject, message.Body)
	if m.port == "465" {
		return m.sendImplicitTLS(addr, auth, to, raw)
	}
	return smtp.SendMail(addr, auth, m.user, []string{to}, raw)
}

func (m smtpMailer) sendImplicitTLS(addr string, auth smtp.Auth, to string, raw []byte) error {
	conn, err := tls.Dial("tcp", addr, &tls.Config{ServerName: m.host, MinVersion: tls.VersionTLS12})
	if err != nil {
		return err
	}
	client, err := smtp.NewClient(conn, m.host)
	if err != nil {
		_ = conn.Close()
		return err
	}
	defer client.Close()
	if err := client.Auth(auth); err != nil {
		return err
	}
	if err := client.Mail(m.user); err != nil {
		return err
	}
	if err := client.Rcpt(to); err != nil {
		return err
	}
	writer, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := writer.Write(raw); err != nil {
		_ = writer.Close()
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}
	return client.Quit()
}

func buildMailMessage(fromEmail, fromName, to, subject, body string) []byte {
	fromName = sanitizeMailHeader(fromName)
	subject = sanitizeMailHeader(subject)
	to = sanitizeMailHeader(to)
	from := sanitizeMailHeader(fromEmail)
	if fromName != "" {
		from = mime.QEncoding.Encode("utf-8", fromName) + " <" + from + ">"
	}
	headers := []string{
		"From: " + from,
		"To: " + to,
		"Subject: " + mime.QEncoding.Encode("utf-8", subject),
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"Content-Transfer-Encoding: base64",
	}
	encodedBody := wrapBase64Lines(base64.StdEncoding.EncodeToString([]byte(body)))
	return []byte(strings.Join(headers, "\r\n") + "\r\n\r\n" + encodedBody)
}

func sanitizeMailHeader(value string) string {
	value = strings.ReplaceAll(value, "\r", " ")
	value = strings.ReplaceAll(value, "\n", " ")
	return strings.TrimSpace(value)
}

func wrapBase64Lines(value string) string {
	const lineLength = 76
	if len(value) <= lineLength {
		return value
	}
	var builder strings.Builder
	for len(value) > lineLength {
		builder.WriteString(value[:lineLength])
		builder.WriteString("\r\n")
		value = value[lineLength:]
	}
	builder.WriteString(value)
	return builder.String()
}

func sendGuestbookMail(message outboundMail) error {
	mailer := guestbookMailer
	if mailer == nil {
		var ok bool
		mailer, ok = smtpMailerFromEnv()
		if !ok {
			return errSMTPNotConfigured
		}
	}
	if err := mailer.Send(message); err != nil {
		return err
	}
	return nil
}

func logGuestbookMailError(context string, err error) {
	if err != nil {
		log.Printf("guestbook mail %s: %v", context, err)
	}
}
