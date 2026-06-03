package main

import (
	"database/sql"
	"net/http"
	"strconv"
	"time"
)

const chatStatsHourLayout = "2006-01-02T15"

func chatStatsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	days := 14
	if q := r.URL.Query().Get("days"); q != "" {
		if n, err := strconv.Atoi(q); err == nil && n >= 1 && n <= 90 {
			days = n
		}
	}
	daily, err := listChatDailyStats(db, days)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	hourly, err := listChatHourlyToday(db)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	summary := summarizeChatStats(daily, hourly)
	writeJSON(w, map[string]any{
		"model":       env("DEEPSEEK_MODEL", "deepseek-v4-flash"),
		"configured":  chatConfigured(),
		"summary":     summary,
		"daily":       daily,
		"hourlyToday": hourly,
	})
}

func chatHourBucket(t time.Time) string {
	return t.UTC().Format(chatStatsHourLayout)
}

func recordChatStat(db *sql.DB, id chatIdentity, column string, tokens int) {
	bucket := chatHourBucket(time.Now())
	guestInc, userInc, ownerInc := 0, 0, 0
	ownerTokens := 0
	if id.IsOwner {
		ownerInc = 1
		if column == "success" && tokens > 0 {
			ownerTokens = tokens
		}
	} else if id.IsLogin {
		userInc = 1
	} else {
		guestInc = 1
	}
	_, _ = db.Exec(
		`INSERT INTO ai_chat_hourly (bucket, success, upstream_error, quota_denied, rate_denied, not_configured, guest_calls, user_calls, owner_calls, owner_tokens)
		 VALUES (?, 0, 0, 0, 0, 0, ?, ?, ?, ?)
		 ON CONFLICT(bucket) DO UPDATE SET `+column+` = `+column+` + 1,
		   guest_calls = guest_calls + excluded.guest_calls,
		   user_calls = user_calls + excluded.user_calls,
		   owner_calls = owner_calls + excluded.owner_calls,
		   owner_tokens = owner_tokens + excluded.owner_tokens`,
		bucket, guestInc, userInc, ownerInc, ownerTokens,
	)
}

type chatDailyRow struct {
	Date          string `json:"date"`
	Success       int    `json:"success"`
	UpstreamError int    `json:"upstreamError"`
	QuotaDenied   int    `json:"quotaDenied"`
	RateDenied    int    `json:"rateDenied"`
	NotConfigured int    `json:"notConfigured"`
	GuestCalls    int    `json:"guestCalls"`
	UserCalls     int    `json:"userCalls"`
	OwnerCalls    int    `json:"ownerCalls"`
	OwnerTokens   int    `json:"ownerTokens"`
	Total         int    `json:"total"`
}

type chatHourlyRow struct {
	Hour          string `json:"hour"`
	Success       int    `json:"success"`
	UpstreamError int    `json:"upstreamError"`
	QuotaDenied   int    `json:"quotaDenied"`
	RateDenied    int    `json:"rateDenied"`
	OwnerCalls    int    `json:"ownerCalls"`
	Total         int    `json:"total"`
}

func listChatDailyStats(db *sql.DB, days int) ([]chatDailyRow, error) {
	since := time.Now().UTC().AddDate(0, 0, -(days - 1)).Format("2006-01-02") + "T00"
	rows, err := db.Query(
		`SELECT substr(bucket, 1, 10) AS d,
		        SUM(success), SUM(upstream_error), SUM(quota_denied), SUM(rate_denied), SUM(not_configured),
		        SUM(guest_calls), SUM(user_calls), SUM(owner_calls), SUM(owner_tokens)
		 FROM ai_chat_hourly
		 WHERE bucket >= ?
		 GROUP BY d
		 ORDER BY d ASC`,
		since,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []chatDailyRow
	for rows.Next() {
		var row chatDailyRow
		if err := rows.Scan(
			&row.Date, &row.Success, &row.UpstreamError, &row.QuotaDenied, &row.RateDenied, &row.NotConfigured,
			&row.GuestCalls, &row.UserCalls, &row.OwnerCalls, &row.OwnerTokens,
		); err != nil {
			return nil, err
		}
		row.Total = row.Success + row.UpstreamError + row.QuotaDenied + row.RateDenied + row.NotConfigured
		out = append(out, row)
	}
	return out, rows.Err()
}

func listChatHourlyToday(db *sql.DB) ([]chatHourlyRow, error) {
	prefix := time.Now().UTC().Format("2006-01-02") + "T"
	rows, err := db.Query(
		`SELECT bucket, success, upstream_error, quota_denied, rate_denied, owner_calls
		 FROM ai_chat_hourly
		 WHERE bucket LIKE ? || '%'
		 ORDER BY bucket ASC`,
		prefix,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	byHour := map[string]chatHourlyRow{}
	for rows.Next() {
		var bucket string
		var s, up, q, r, owner int
		if err := rows.Scan(&bucket, &s, &up, &q, &r, &owner); err != nil {
			return nil, err
		}
		hour := bucket
		if len(bucket) >= 13 {
			hour = bucket[11:13]
		}
		row := byHour[hour]
		row.Hour = hour
		row.Success += s
		row.UpstreamError += up
		row.QuotaDenied += q
		row.RateDenied += r
		row.OwnerCalls += owner
		row.Total = row.Success + row.UpstreamError + row.QuotaDenied + row.RateDenied
		byHour[hour] = row
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	var out []chatHourlyRow
	for h := 0; h < 24; h++ {
		key := formatHour(h)
		if row, ok := byHour[key]; ok {
			out = append(out, row)
		} else {
			out = append(out, chatHourlyRow{Hour: key})
		}
	}
	return out, nil
}

func formatHour(h int) string {
	if h < 10 {
		return "0" + strconv.Itoa(h)
	}
	return strconv.Itoa(h)
}

func summarizeChatStats(daily []chatDailyRow, hourly []chatHourlyRow) map[string]any {
	today := time.Now().UTC().Format("2006-01-02")
	var todaySuccess, todayTotal, todayOwnerCalls, todayOwnerTokens int
	for _, d := range daily {
		if d.Date == today {
			todaySuccess = d.Success
			todayTotal = d.Total
			todayOwnerCalls = d.OwnerCalls
			todayOwnerTokens = d.OwnerTokens
			break
		}
	}
	if todayTotal == 0 {
		for _, h := range hourly {
			todaySuccess += h.Success
			todayTotal += h.Total
			todayOwnerCalls += h.OwnerCalls
		}
	}
	var periodSuccess, periodTotal, periodOwnerCalls, periodOwnerTokens int
	for _, d := range daily {
		periodSuccess += d.Success
		periodTotal += d.Total
		periodOwnerCalls += d.OwnerCalls
		periodOwnerTokens += d.OwnerTokens
	}
	rate := 0.0
	if periodTotal > 0 {
		rate = float64(periodSuccess) / float64(periodTotal)
	}
	return map[string]any{
		"todaySuccess":       todaySuccess,
		"todayTotal":         todayTotal,
		"todayOwnerCalls":    todayOwnerCalls,
		"todayOwnerTokens":   todayOwnerTokens,
		"periodSuccess":      periodSuccess,
		"periodTotal":        periodTotal,
		"periodOwnerCalls":   periodOwnerCalls,
		"periodOwnerTokens":  periodOwnerTokens,
		"successRate":        rate,
		"successRateText":    formatPercent(rate),
	}
}

func formatPercent(v float64) string {
	if v <= 0 {
		return "0%"
	}
	return strconv.Itoa(int(v*100+0.5)) + "%"
}

// prune old hourly buckets (keep ~120 days).
func pruneChatHourlyStats(db *sql.DB) {
	cutoff := time.Now().UTC().AddDate(0, 0, -120).Format(chatStatsHourLayout)
	_, _ = db.Exec(`DELETE FROM ai_chat_hourly WHERE bucket < ?`, cutoff)
}
