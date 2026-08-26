package main

import (
	"regexp"
	"strings"
)

// Contact addresses on guestbook messages are the only mail the site still
// handles now that accounts are gone, so the address helpers live here rather
// than in an auth module.
const maxEmailLen = 254

var emailPattern = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)

func normalizeEmail(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

func validateEmail(email string) bool {
	return len(email) <= maxEmailLen && emailPattern.MatchString(email)
}
