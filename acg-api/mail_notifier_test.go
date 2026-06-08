package main

import "testing"

func TestSMTPMailerFromEnvDisabledWhenRequiredConfigMissing(t *testing.T) {
	t.Setenv("SMTP_HOST", "")
	t.Setenv("SMTP_PORT", "")
	t.Setenv("SMTP_USER", "")
	t.Setenv("SMTP_PASS", "")

	if _, ok := smtpMailerFromEnv(); ok {
		t.Fatal("expected SMTP mailer to be disabled when required config is missing")
	}
}
