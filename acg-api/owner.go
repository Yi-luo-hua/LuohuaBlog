package main

import (
	"database/sql"
	"log"
	"os"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
)

const (
	ownerEmail            = "akesakiko@gmail.com"
	ownerSecurityQuestion = "你现在的学号"
)

func isOwnerEmail(email string) bool {
	return normalizeEmail(email) == ownerEmail
}

func ownerSecurityAnswer() string {
	return strings.TrimSpace(os.Getenv("AUTH_OWNER_SECURITY_ANSWER"))
}

func ownerAnswerMatches(answer string) bool {
	return strings.TrimSpace(answer) == strings.TrimSpace(ownerSecurityAnswer())
}

// ensureOwnerAccount reserves the owner mailbox (no public registration).
func ensureOwnerAccount(db *sql.DB) {
	var id int64
	err := db.QueryRow(`SELECT id FROM users WHERE email = ?`, ownerEmail).Scan(&id)
	if err == nil {
		_, _ = db.Exec(`UPDATE users SET is_owner = 1 WHERE id = ?`, id)
		return
	}
	if err != sql.ErrNoRows {
		log.Printf("owner account check: %v", err)
		return
	}

	pw := strings.TrimSpace(os.Getenv("AUTH_OWNER_PASSWORD"))
	if pw == "" {
		log.Printf("WARN: AUTH_OWNER_PASSWORD not set; owner %s cannot log in until set in /opt/acg-api/.env", ownerEmail)
		return
	}
	if len(pw) < 8 {
		log.Printf("WARN: AUTH_OWNER_PASSWORD too short (min 8)")
		return
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(pw), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("owner password hash: %v", err)
		return
	}
	created := time.Now().UTC().Format(time.RFC3339)
	_, err = db.Exec(
		`INSERT INTO users (email, password_hash, created_at, is_owner) VALUES (?, ?, ?, 1)`,
		ownerEmail, string(hash), created,
	)
	if err != nil {
		log.Printf("create owner account: %v", err)
		return
	}
	log.Printf("owner account ready for %s (set AUTH_OWNER_PASSWORD in .env to log in)", ownerEmail)
}
