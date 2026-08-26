package main

import (
	"crypto/subtle"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// The site has exactly one privileged human: the owner. There are no accounts,
// no registration and no email — entering the console means typing the gate
// password once, after which an owner session cookie carries the privilege.
// A short password is only defensible because the gate is the sole way in and
// every attempt is rate limited per IP; keep the limiter if you shorten this
// further.
const (
	sessionCookieName  = "acg_session"
	ownerGateMinPWLen  = 6
	ownerGateMaxPWLen  = 200
	ownerGateMaxBodyKB = 4
)

var ownerGateLimiter = newIPRateLimiter(10, time.Minute)

// ownerGatePassword is the single secret that opens the console. It is read
// from the environment so it never lives in the repository or the database.
func ownerGatePassword() string {
	if pw := strings.TrimSpace(os.Getenv("OWNER_GATE_PASSWORD")); pw != "" {
		return pw
	}
	// Kept so an existing deployment's .env keeps working after the account
	// system was removed.
	return strings.TrimSpace(os.Getenv("AUTH_OWNER_PASSWORD"))
}

func ownerGateConfigured() bool {
	pw := ownerGatePassword()
	return len(pw) >= ownerGateMinPWLen && len(pw) <= ownerGateMaxPWLen
}

func ownerGatePasswordMatches(candidate string) bool {
	want := ownerGatePassword()
	if !ownerGateConfigured() {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(candidate), []byte(want)) == 1
}

// ownerGateHandler serves /api/owner/gate: GET reports whether this browser is
// already unlocked, POST exchanges the password for a session, DELETE locks up.
func ownerGateHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		writeJSON(w, map[string]any{
			"unlocked":   isOwnerRequest(r),
			"configured": ownerGateConfigured(),
		})
	case http.MethodPost:
		handleOwnerGateUnlock(w, r)
	case http.MethodDelete:
		handleOwnerGateLock(w, r)
	default:
		methodNotAllowed(w)
	}
}

func handleOwnerGateUnlock(w http.ResponseWriter, r *http.Request) {
	if !ownerGateLimiter.Allow(clientIP(r)) {
		writeJSONStatus(w, http.StatusTooManyRequests, map[string]any{
			"error":   "RATE_LIMITED",
			"message": "尝试太频繁了，请稍后再试。",
		})
		return
	}

	var body struct {
		Password string `json:"password"`
	}
	if err := decodeJSONBody(r, &body); err != nil {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "BAD_REQUEST",
			"message": "请求格式不正确。",
		})
		return
	}

	if pw := ownerGatePassword(); pw == "" {
		writeJSONStatus(w, http.StatusServiceUnavailable, map[string]any{
			"error":   "GATE_NOT_CONFIGURED",
			"message": "服务端还没有设置 OWNER_GATE_PASSWORD。",
		})
		return
	} else if !ownerGateConfigured() {
		writeJSONStatus(w, http.StatusServiceUnavailable, map[string]any{
			"error":   "GATE_PASSWORD_TOO_SHORT",
			"message": "OWNER_GATE_PASSWORD 长度需在 6 到 200 之间，当前设置太短了。",
		})
		return
	}

	if !ownerGatePasswordMatches(body.Password) {
		recordSecurityAudit(r, "owner.gate_unlock", "failure", 0, "owner_gate", "", "wrong_password")
		writeJSONStatus(w, http.StatusUnauthorized, map[string]any{
			"error":   "WRONG_PASSWORD",
			"message": "密码不对。",
		})
		return
	}

	if err := createOwnerSession(w, r); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	recordSecurityAudit(r, "owner.gate_unlock", "success", 0, "owner_gate", "", "")
	writeJSON(w, map[string]any{"unlocked": true})
}

func handleOwnerGateLock(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(sessionCookieName); err == nil && c.Value != "" {
		if token := sanitizeID(c.Value); token != "" {
			_, _ = db.Exec(`DELETE FROM sessions WHERE id = ?`, token)
		}
	}
	clearSessionCookie(w, r)
	writeJSON(w, map[string]any{"unlocked": false})
}

func decodeJSONBody(r *http.Request, target any) error {
	raw, err := io.ReadAll(io.LimitReader(r.Body, ownerGateMaxBodyKB*1024))
	if err != nil {
		return err
	}
	if len(raw) == 0 {
		return errors.New("empty body")
	}
	return json.Unmarshal(raw, target)
}

func methodNotAllowed(w http.ResponseWriter) {
	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

// isOwnerRequest reports whether the request carries a live owner session. With
// the account system gone, holding a session *is* being the owner.
func isOwnerRequest(r *http.Request) bool {
	c, err := r.Cookie(sessionCookieName)
	if err != nil || c.Value == "" {
		return false
	}
	token := sanitizeID(c.Value)
	if token == "" {
		return false
	}
	var expires string
	if err := db.QueryRow(`SELECT expires_at FROM sessions WHERE id = ?`, token).Scan(&expires); err != nil {
		return false
	}
	if t, e := time.Parse(time.RFC3339, expires); e == nil && time.Now().After(t) {
		_, _ = db.Exec(`DELETE FROM sessions WHERE id = ?`, token)
		return false
	}
	return true
}

func sessionTTL() time.Duration {
	days := 30
	if v := env("AUTH_SESSION_DAYS", ""); v != "" {
		if n, err := parsePositiveInt(v); err == nil && n > 0 && n <= 365 {
			days = n
		}
	}
	return time.Duration(days) * 24 * time.Hour
}

func parsePositiveInt(s string) (int, error) {
	n := 0
	for _, r := range s {
		if r < '0' || r > '9' {
			return 0, errors.New("invalid")
		}
		n = n*10 + int(r-'0')
	}
	if n == 0 {
		return 0, errors.New("invalid")
	}
	return n, nil
}

func createOwnerSession(w http.ResponseWriter, r *http.Request) error {
	token := uuid.NewString()
	expires := time.Now().UTC().Add(sessionTTL()).Format(time.RFC3339)
	if _, err := db.Exec(
		`INSERT INTO sessions (id, expires_at) VALUES (?, ?)`, token, expires,
	); err != nil {
		return err
	}
	setSessionCookie(w, r, token)
	return nil
}

func setSessionCookie(w http.ResponseWriter, r *http.Request, token string) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   cookieSecure(r),
		MaxAge:   int(sessionTTL().Seconds()),
	})
}

func clearSessionCookie(w http.ResponseWriter, r *http.Request) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
		Secure:   cookieSecure(r),
		MaxAge:   -1,
	})
}

func cookieSecure(r *http.Request) bool {
	if env("AUTH_COOKIE_SECURE", "true") == "false" {
		return false
	}
	if r.TLS != nil {
		return true
	}
	return strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
}

type ipRateLimiter struct {
	mu      sync.Mutex
	limit   int
	window  time.Duration
	entries map[string][]time.Time
}

func newIPRateLimiter(limit int, window time.Duration) *ipRateLimiter {
	return &ipRateLimiter{limit: limit, window: window, entries: make(map[string][]time.Time)}
}

func (l *ipRateLimiter) Allow(ip string) bool {
	now := time.Now()
	l.mu.Lock()
	defer l.mu.Unlock()
	cutoff := now.Add(-l.window)
	var kept []time.Time
	for _, t := range l.entries[ip] {
		if t.After(cutoff) {
			kept = append(kept, t)
		}
	}
	if len(kept) >= l.limit {
		l.entries[ip] = kept
		return false
	}
	kept = append(kept, now)
	l.entries[ip] = kept
	return true
}
