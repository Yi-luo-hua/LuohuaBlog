package main

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"net/http"
	"strings"
	"time"
)

func formatUserID(id int64) string {
	return fmt.Sprintf("%d", id)
}

const (
	guestDailyLimit = 10
	userDailyLimit  = 50
	chatMinInterval = 5 * time.Second
)

type chatIdentity struct {
	Key       string
	IsLogin   bool
	IsOwner   bool
	Limit     int
	Unlimited bool
}

func userIsOwner(db *sql.DB, userID int64) bool {
	var flag int
	err := db.QueryRow(`SELECT is_owner FROM users WHERE id = ?`, userID).Scan(&flag)
	return err == nil && flag == 1
}

func resolveChatIdentity(r *http.Request) chatIdentity {
	if sess, ok := sessionFromRequest(r); ok {
		owner := userIsOwner(db, sess.UserID)
		if sess.Unlimited {
			return chatIdentity{
				Key:       "user:" + formatUserID(sess.UserID),
				IsLogin:   true,
				IsOwner:   owner,
				Limit:     0,
				Unlimited: true,
			}
		}
		return chatIdentity{
			Key:     "user:" + formatUserID(sess.UserID),
			IsLogin: true,
			IsOwner: owner,
			Limit:   userDailyLimit,
		}
	}
	raw := clientIP(r) + "|" + r.UserAgent()
	sum := sha256.Sum256([]byte(raw))
	guest := hex.EncodeToString(sum[:8])
	return chatIdentity{Key: "guest:" + guest, IsLogin: false, Limit: guestDailyLimit}
}

func sanitizeID(s string) string {
	s = strings.TrimSpace(s)
	if len(s) > 64 {
		s = s[:64]
	}
	var b strings.Builder
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' || r == '-' {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		if len(parts) > 0 {
			return strings.TrimSpace(parts[0])
		}
	}
	if xri := strings.TrimSpace(r.Header.Get("X-Real-IP")); xri != "" {
		return xri
	}
	host := r.RemoteAddr
	if i := strings.LastIndex(host, ":"); i >= 0 {
		return host[:i]
	}
	return host
}

func todayDate() string {
	return time.Now().Format("2006-01-02")
}

type quotaSnapshot struct {
	Used      int
	Limit     int
	Remaining int
	IsLogin   bool
	Unlimited bool
	Date      string
}

func getQuotaSnapshot(db *sql.DB, id chatIdentity) (quotaSnapshot, error) {
	date := todayDate()
	used, lastAt, err := loadQuota(db, id.Key, date)
	if err != nil {
		return quotaSnapshot{}, err
	}
	_ = lastAt
	if id.Unlimited {
		return quotaSnapshot{
			Used: used, Limit: -1, Remaining: -1,
			IsLogin: id.IsLogin, Unlimited: true, Date: date,
		}, nil
	}
	remaining := id.Limit - used
	if remaining < 0 {
		remaining = 0
	}
	return quotaSnapshot{
		Used: used, Limit: id.Limit, Remaining: remaining,
		IsLogin: id.IsLogin, Date: date,
	}, nil
}

func loadQuota(db *sql.DB, identityKey, date string) (used int, lastAt time.Time, err error) {
	var lastStr sql.NullString
	err = db.QueryRow(
		`SELECT used, last_request_at FROM ai_chat_quota WHERE identity_key = ? AND quota_date = ?`,
		identityKey, date,
	).Scan(&used, &lastStr)
	if err == sql.ErrNoRows {
		return 0, time.Time{}, nil
	}
	if err != nil {
		return 0, time.Time{}, err
	}
	if lastStr.Valid && lastStr.String != "" {
		if t, e := time.Parse(time.RFC3339, lastStr.String); e == nil {
			lastAt = t
		}
	}
	return used, lastAt, nil
}

func checkRateLimit(lastAt time.Time) bool {
	if lastAt.IsZero() {
		return true
	}
	return time.Since(lastAt) >= chatMinInterval
}

// reserveQuota checks limits; if ok, increments used and updates last_request_at.
func reserveQuota(db *sql.DB, id chatIdentity) (quotaSnapshot, error) {
	date := todayDate()
	now := time.Now().UTC().Format(time.RFC3339)

	tx, err := db.Begin()
	if err != nil {
		return quotaSnapshot{}, err
	}
	defer tx.Rollback()

	var used int
	var lastStr sql.NullString
	err = tx.QueryRow(
		`SELECT used, last_request_at FROM ai_chat_quota WHERE identity_key = ? AND quota_date = ?`,
		id.Key, date,
	).Scan(&used, &lastStr)
	if err != nil && err != sql.ErrNoRows {
		return quotaSnapshot{}, err
	}
	if err == sql.ErrNoRows {
		used = 0
	}

	var lastAt time.Time
	if lastStr.Valid && lastStr.String != "" {
		if t, e := time.Parse(time.RFC3339, lastStr.String); e == nil {
			lastAt = t
		}
	}
	if !checkRateLimit(lastAt) {
		if id.Unlimited {
			return quotaSnapshot{
				Used: used, Limit: -1, Remaining: -1,
				IsLogin: id.IsLogin, Unlimited: true, Date: date,
			}, errRateLimited
		}
		rem := id.Limit - used
		if rem < 0 {
			rem = 0
		}
		return quotaSnapshot{
			Used: used, Limit: id.Limit, Remaining: rem,
			IsLogin: id.IsLogin, Date: date,
		}, errRateLimited
	}
	if !id.Unlimited && used >= id.Limit {
		remaining := 0
		return quotaSnapshot{
			Used: used, Limit: id.Limit, Remaining: remaining,
			IsLogin: id.IsLogin, Date: date,
		}, errDailyExceeded
	}

	used++
	_, err = tx.Exec(
		`INSERT INTO ai_chat_quota (identity_key, quota_date, used, last_request_at)
		 VALUES (?, ?, ?, ?)
		 ON CONFLICT(identity_key, quota_date) DO UPDATE SET
		   used = excluded.used,
		   last_request_at = excluded.last_request_at`,
		id.Key, date, used, now,
	)
	if err != nil {
		return quotaSnapshot{}, err
	}
	if err := tx.Commit(); err != nil {
		return quotaSnapshot{}, err
	}

	if id.Unlimited {
		return quotaSnapshot{
			Used: used, Limit: -1, Remaining: -1,
			IsLogin: id.IsLogin, Unlimited: true, Date: date,
		}, nil
	}
	remaining := id.Limit - used
	if remaining < 0 {
		remaining = 0
	}
	return quotaSnapshot{
		Used: used, Limit: id.Limit, Remaining: remaining,
		IsLogin: id.IsLogin, Date: date,
	}, nil
}

// rollbackQuota decrements used after failed model call (best effort).
func rollbackQuota(db *sql.DB, id chatIdentity) {
	date := todayDate()
	_, _ = db.Exec(
		`UPDATE ai_chat_quota SET used = CASE WHEN used > 0 THEN used - 1 ELSE 0 END
		 WHERE identity_key = ? AND quota_date = ?`,
		id.Key, date,
	)
}

type quotaError struct {
	Code    string
	Message string
}

func (e *quotaError) Error() string { return e.Message }

var (
	errDailyExceeded = &quotaError{Code: "DAILY_LIMIT_EXCEEDED", Message: "今日提问次数用完啦，明天再来问我吧～"}
	errRateLimited   = &quotaError{Code: "RATE_LIMIT_EXCEEDED", Message: "提问太快啦，请稍等 5 秒再试～"}
)

func quotaErrBody(id chatIdentity, snap quotaSnapshot, qe *quotaError) map[string]any {
	body := map[string]any{
		"error":     qe.Code,
		"message":   qe.Message,
		"limit":     snap.Limit,
		"used":      snap.Used,
		"remaining": snap.Remaining,
		"isLogin":   id.IsLogin,
		"unlimited": snap.Unlimited,
	}
	if id.Unlimited {
		body["limit"] = -1
		body["remaining"] = -1
		body["unlimited"] = true
	}
	return body
}

func chatQuotaJSON(snap quotaSnapshot) map[string]any {
	return map[string]any{
		"limit":       snap.Limit,
		"used":        snap.Used,
		"remaining":   snap.Remaining,
		"isLogin":     snap.IsLogin,
		"unlimited":   snap.Unlimited,
	}
}
