package main

import (
	"database/sql"
	"net/http"
	"strings"
	"unicode/utf8"
)

type currentUser struct {
	ID       int64
	Email    string
	Nickname string
	Avatar   string
	Role     string // "admin" or "user"
}

func nicknameFromEmail(email string) string {
	email = strings.TrimSpace(email)
	at := strings.Index(email, "@")
	local := email
	if at > 0 {
		local = email[:at]
	}
	if local == "" {
		local = "访客"
	}
	if utf8.RuneCountInString(local) > 12 {
		local = string([]rune(local)[:12])
	}
	return local
}

func getCurrentUserFromRequest(r *http.Request) *currentUser {
	sess, ok := sessionFromRequest(r)
	if !ok {
		return nil
	}
	var email, displayName string
	var isOwner int
	err := db.QueryRow(
		`SELECT email, display_name, is_owner FROM users WHERE id = ?`, sess.UserID,
	).Scan(&email, &displayName, &isOwner)
	if err == sql.ErrNoRows {
		return nil
	}
	if err != nil {
		return nil
	}
	role := "user"
	if isOwner == 1 {
		role = "admin"
	}
	return &currentUser{
		ID:       sess.UserID,
		Email:    normalizeEmail(email),
		Nickname: displayNameOrEmail(email, displayName),
		Avatar:   "",
		Role:     role,
	}
}

func isAdminUser(u *currentUser) bool {
	return u != nil && u.Role == "admin"
}
