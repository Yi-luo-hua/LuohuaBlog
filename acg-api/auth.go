package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

const (
	sessionCookieName   = "acg_session"
	loginChallengeTTL   = 10 * time.Minute
	minPasswordLen      = 8
	maxPasswordBytes    = 72
	maxEmailLen         = 254
	maxDisplayNameRunes = 12
)

var (
	emailPattern = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
	authLimiter  = newIPRateLimiter(15, time.Minute)
)

type authUser struct {
	ID          int64  `json:"id"`
	Email       string `json:"email"`
	DisplayName string `json:"displayName,omitempty"`
	IsOwner     bool   `json:"isOwner,omitempty"`
	CreatedAt   string `json:"createdAt,omitempty"`
}

type sessionInfo struct {
	UserID    int64
	Unlimited bool
}

func authHandler(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/auth/")
	switch path {
	case "register":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		handleRegister(w, r)
	case "login":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		handleLogin(w, r)
	case "verify-security":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		handleVerifySecurity(w, r)
	case "logout":
		if r.Method != http.MethodPost {
			methodNotAllowed(w)
			return
		}
		handleLogout(w, r)
	case "profile":
		if r.Method != http.MethodPatch {
			methodNotAllowed(w)
			return
		}
		handleAuthProfile(w, r)
	case "me":
		if r.Method != http.MethodGet {
			methodNotAllowed(w)
			return
		}
		handleAuthMe(w, r)
	default:
		http.NotFound(w, r)
	}
}

func methodNotAllowed(w http.ResponseWriter) {
	http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
}

func normalizeEmail(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}

func validateEmail(email string) bool {
	if email == "" || utf8.RuneCountInString(email) > maxEmailLen {
		return false
	}
	return emailPattern.MatchString(email)
}

func validatePassword(pw string) error {
	if utf8.RuneCountInString(pw) < minPasswordLen {
		return errors.New("密码至少 8 位")
	}
	if len(pw) > maxPasswordBytes {
		return errors.New("密码过长")
	}
	return nil
}

func normalizeDisplayName(s string) (string, error) {
	name := strings.TrimSpace(s)
	if name == "" {
		return "", errors.New("昵称不能为空")
	}
	if utf8.RuneCountInString(name) > maxDisplayNameRunes {
		return "", errors.New("昵称最多 12 个字")
	}
	return name, nil
}

func displayNameOrEmail(email, displayName string) string {
	name := strings.TrimSpace(displayName)
	if name == "" {
		return nicknameFromEmail(email)
	}
	if utf8.RuneCountInString(name) > maxDisplayNameRunes {
		return string([]rune(name)[:maxDisplayNameRunes])
	}
	return name
}

func handleRegister(w http.ResponseWriter, r *http.Request) {
	if !authLimiter.Allow(clientIP(r)) {
		writeJSONStatus(w, http.StatusTooManyRequests, map[string]any{
			"error": "RATE_LIMITED", "message": "操作太频繁，请稍后再试",
		})
		return
	}

	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error": "INVALID_JSON", "message": "请求格式不正确",
		})
		return
	}

	email := normalizeEmail(body.Email)
	if isOwnerEmail(email) {
		writeJSONStatus(w, http.StatusForbidden, map[string]any{
			"error":   "OWNER_EMAIL_RESERVED",
			"message": "该邮箱为站长专用，请直接登录并完成学号验证",
		})
		return
	}
	if !validateEmail(email) {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error": "INVALID_EMAIL", "message": "请输入有效的邮箱地址",
		})
		return
	}
	if err := validatePassword(body.Password); err != nil {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error": "INVALID_PASSWORD", "message": err.Error(),
		})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(body.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	created := time.Now().UTC().Format(time.RFC3339)
	displayName := nicknameFromEmail(email)
	res, err := db.Exec(
		`INSERT INTO users (email, display_name, password_hash, created_at, is_owner) VALUES (?, ?, ?, ?, 0)`,
		email, displayName, string(hash), created,
	)
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE") {
			writeJSONStatus(w, http.StatusConflict, map[string]any{
				"error": "EMAIL_EXISTS", "message": "该邮箱已注册，请直接登录",
			})
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	userID, _ := res.LastInsertId()
	if err := createSession(w, r, userID, false); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]any{
		"ok": true, "user": authUser{ID: userID, Email: email, DisplayName: displayName, CreatedAt: created},
	})
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
	if !authLimiter.Allow(clientIP(r)) {
		writeJSONStatus(w, http.StatusTooManyRequests, map[string]any{
			"error": "RATE_LIMITED", "message": "操作太频繁，请稍后再试",
		})
		return
	}

	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error": "INVALID_JSON", "message": "请求格式不正确",
		})
		return
	}

	email := normalizeEmail(body.Email)
	userID, displayName, isOwner, err := lookupUserCredentials(email, body.Password)
	if err != nil {
		if errors.Is(err, errInvalidCredentials) {
			writeJSONStatus(w, http.StatusUnauthorized, map[string]any{
				"error": "INVALID_CREDENTIALS", "message": "邮箱或密码错误",
			})
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if isOwner {
		token, err := createLoginChallenge(userID)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, map[string]any{
			"ok":                     true,
			"needsSecurityQuestion":  true,
			"securityQuestion":       ownerSecurityQuestion,
			"challengeToken":         token,
			"user":                   authUser{ID: userID, Email: email, DisplayName: displayName, IsOwner: true},
		})
		return
	}

	if err := createSession(w, r, userID, false); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]any{
		"ok": true, "user": authUser{ID: userID, Email: email, DisplayName: displayName},
	})
}

func handleVerifySecurity(w http.ResponseWriter, r *http.Request) {
	if !authLimiter.Allow(clientIP(r)) {
		writeJSONStatus(w, http.StatusTooManyRequests, map[string]any{
			"error": "RATE_LIMITED", "message": "操作太频繁，请稍后再试",
		})
		return
	}

	var body struct {
		ChallengeToken string `json:"challengeToken"`
		Answer         string `json:"answer"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error": "INVALID_JSON", "message": "请求格式不正确",
		})
		return
	}
	token := sanitizeID(body.ChallengeToken)
	if token == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error": "INVALID_CHALLENGE", "message": "验证已失效，请重新登录",
		})
		return
	}

	userID, err := consumeLoginChallenge(token)
	if err != nil {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error": "INVALID_CHALLENGE", "message": "验证已失效，请重新登录",
		})
		return
	}

	var email, displayName string
	var isOwner int
	if err := db.QueryRow(
		`SELECT email, display_name, is_owner FROM users WHERE id = ?`, userID,
	).Scan(&email, &displayName, &isOwner); err != nil || isOwner != 1 {
		writeJSONStatus(w, http.StatusForbidden, map[string]any{
			"error": "FORBIDDEN", "message": "无权进行此验证",
		})
		return
	}

	if !ownerAnswerMatches(body.Answer) {
		writeJSONStatus(w, http.StatusUnauthorized, map[string]any{
			"error": "WRONG_ANSWER", "message": "学号回答不正确",
		})
		return
	}

	if err := createSession(w, r, userID, true); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	writeJSON(w, map[string]any{
		"ok":        true,
		"unlimited": true,
		"user":      authUser{ID: userID, Email: email, DisplayName: displayNameOrEmail(email, displayName), IsOwner: true},
	})
}

func handleLogout(w http.ResponseWriter, r *http.Request) {
	if token, err := r.Cookie(sessionCookieName); err == nil {
		_, _ = db.Exec(`DELETE FROM sessions WHERE id = ?`, token.Value)
	}
	clearSessionCookie(w, r)
	writeJSON(w, map[string]any{"ok": true})
}

func handleAuthProfile(w http.ResponseWriter, r *http.Request) {
	sess, ok := sessionFromRequest(r)
	if !ok {
		writeJSONStatus(w, http.StatusUnauthorized, map[string]any{
			"error": "UNAUTHORIZED", "message": "请先登录",
		})
		return
	}
	var body struct {
		DisplayName string `json:"displayName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error": "INVALID_JSON", "message": "请求格式不正确",
		})
		return
	}
	displayName, err := normalizeDisplayName(body.DisplayName)
	if err != nil {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error": "INVALID_DISPLAY_NAME", "message": err.Error(),
		})
		return
	}
	if _, err := db.Exec(`UPDATE users SET display_name = ? WHERE id = ?`, displayName, sess.UserID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	var email string
	var isOwner int
	if err := db.QueryRow(
		`SELECT email, is_owner FROM users WHERE id = ?`, sess.UserID,
	).Scan(&email, &isOwner); err != nil {
		writeJSONStatus(w, http.StatusUnauthorized, map[string]any{
			"error": "UNAUTHORIZED", "message": "请先登录",
		})
		return
	}
	writeJSON(w, map[string]any{
		"ok": true,
		"user": authUser{
			ID:          sess.UserID,
			Email:       email,
			DisplayName: displayName,
			IsOwner:     isOwner == 1,
		},
	})
}

func handleAuthMe(w http.ResponseWriter, r *http.Request) {
	sess, ok := sessionFromRequest(r)
	if !ok {
		writeJSON(w, map[string]any{"loggedIn": false})
		return
	}
	var email, displayName string
	var isOwner int
	if err := db.QueryRow(
		`SELECT email, display_name, is_owner FROM users WHERE id = ?`, sess.UserID,
	).Scan(&email, &displayName, &isOwner); err != nil {
		writeJSON(w, map[string]any{"loggedIn": false})
		return
	}
	writeJSON(w, map[string]any{
		"loggedIn":  true,
		"unlimited": sess.Unlimited,
		"user": authUser{
			ID:          sess.UserID,
			Email:       email,
			DisplayName: displayNameOrEmail(email, displayName),
			IsOwner:     isOwner == 1,
		},
	})
}

var errInvalidCredentials = errors.New("invalid credentials")

func lookupUserCredentials(email, password string) (int64, string, bool, error) {
	var userID int64
	var hash string
	var displayName string
	var isOwner int
	err := db.QueryRow(
		`SELECT id, password_hash, display_name, is_owner FROM users WHERE email = ?`, email,
	).Scan(&userID, &hash, &displayName, &isOwner)
	if err == sql.ErrNoRows {
		return 0, "", false, errInvalidCredentials
	}
	if err != nil {
		return 0, "", false, err
	}
	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) != nil {
		return 0, "", false, errInvalidCredentials
	}
	return userID, displayNameOrEmail(email, displayName), isOwner == 1, nil
}

func createLoginChallenge(userID int64) (string, error) {
	token := uuid.NewString()
	expires := time.Now().UTC().Add(loginChallengeTTL).Format(time.RFC3339)
	_, err := db.Exec(
		`INSERT INTO login_challenges (id, user_id, expires_at) VALUES (?, ?, ?)`,
		token, userID, expires,
	)
	return token, err
}

func consumeLoginChallenge(token string) (int64, error) {
	var userID int64
	var expires string
	err := db.QueryRow(
		`SELECT user_id, expires_at FROM login_challenges WHERE id = ?`, token,
	).Scan(&userID, &expires)
	if err != nil {
		return 0, err
	}
	_, _ = db.Exec(`DELETE FROM login_challenges WHERE id = ?`, token)
	if t, e := time.Parse(time.RFC3339, expires); e == nil && time.Now().After(t) {
		return 0, sql.ErrNoRows
	}
	return userID, nil
}

func sessionFromRequest(r *http.Request) (sessionInfo, bool) {
	c, err := r.Cookie(sessionCookieName)
	if err != nil || c.Value == "" {
		return sessionInfo{}, false
	}
	token := sanitizeID(c.Value)
	if token == "" {
		return sessionInfo{}, false
	}
	var userID int64
	var expires string
	var unlimited int
	err = db.QueryRow(
		`SELECT user_id, expires_at, unlimited FROM sessions WHERE id = ?`, token,
	).Scan(&userID, &expires, &unlimited)
	if err != nil {
		return sessionInfo{}, false
	}
	if t, e := time.Parse(time.RFC3339, expires); e == nil && time.Now().After(t) {
		_, _ = db.Exec(`DELETE FROM sessions WHERE id = ?`, token)
		return sessionInfo{}, false
	}
	return sessionInfo{UserID: userID, Unlimited: unlimited == 1}, true
}

func userIDFromSession(r *http.Request) (int64, bool) {
	s, ok := sessionFromRequest(r)
	if !ok {
		return 0, false
	}
	return s.UserID, true
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

func createSession(w http.ResponseWriter, r *http.Request, userID int64, unlimited bool) error {
	token := uuid.NewString()
	expires := time.Now().UTC().Add(sessionTTL()).Format(time.RFC3339)
	ul := 0
	if unlimited {
		ul = 1
	}
	_, err := db.Exec(
		`INSERT INTO sessions (id, user_id, expires_at, unlimited) VALUES (?, ?, ?, ?)`,
		token, userID, expires, ul,
	)
	if err != nil {
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
