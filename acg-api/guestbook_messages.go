package main

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	guestbookNickMax    = 12
	guestbookContentMax = 300
	guestbookDupWindow  = 60 * time.Second
)

type guestbookMessageRow struct {
	ID            int64   `json:"id"`
	Nickname      string  `json:"nickname"`
	Avatar        string  `json:"avatar"`
	Content       string  `json:"content"`
	IPRegion      string  `json:"ipRegion"`
	CreatedAt     string  `json:"createdAt"`
	IsLoginUser   bool    `json:"isLoginUser"`
	IsAdminUser   bool    `json:"isAdminUser,omitempty"`
	Status        string  `json:"status,omitempty"`
	IPMasked      string  `json:"ipMasked,omitempty"`
	UserAgentHash string  `json:"userAgentHash,omitempty"`
}

func guestbookRouter(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/guestbook/")
	if path == "messages" || path == "messages/" {
		switch r.Method {
		case http.MethodGet:
			guestbookListHandler(w, r)
		case http.MethodPost:
			guestbookCreateHandler(w, r)
		default:
			methodNotAllowed(w)
		}
		return
	}
	if strings.HasPrefix(path, "messages/") {
		rest := strings.TrimPrefix(path, "messages/")
		rest = strings.TrimSuffix(rest, "/")
		idStr := rest
		if strings.HasSuffix(idStr, "/status") {
			idStr = strings.TrimSuffix(idStr, "/status")
			id, err := strconv.ParseInt(idStr, 10, 64)
			if err != nil || id <= 0 {
				writeGuestbookErr(w, http.StatusNotFound, "NOT_FOUND", "留言不存在")
				return
			}
			if r.Method == http.MethodPatch {
				guestbookPatchStatusHandler(w, r, id)
			} else {
				methodNotAllowed(w)
			}
			return
		}
		id, err := strconv.ParseInt(idStr, 10, 64)
		if err != nil || id <= 0 {
			writeGuestbookErr(w, http.StatusNotFound, "NOT_FOUND", "留言不存在")
			return
		}
		switch r.Method {
		case http.MethodDelete:
			guestbookDeleteHandler(w, r, id)
		case http.MethodPatch:
			guestbookPatchStatusHandler(w, r, id)
		default:
			methodNotAllowed(w)
		}
		return
	}
	http.NotFound(w, r)
}

func writeGuestbookErr(w http.ResponseWriter, status int, code, msg string) {
	writeJSONStatus(w, status, map[string]any{"error": code, "message": msg})
}

func guestbookListHandler(w http.ResponseWriter, r *http.Request) {
	page := 1
	pageSize := 20
	if v := r.URL.Query().Get("page"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			page = n
		}
	}
	if v := r.URL.Query().Get("pageSize"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 50 {
			pageSize = n
		}
	}
	offset := (page - 1) * pageSize
	cu := getCurrentUserFromRequest(r)
	admin := isAdminUser(cu)

	var total int
	countQ := `SELECT COUNT(*) FROM guestbook_messages WHERE status = 'visible'`
	listQ := `SELECT id, user_id, nickname, avatar, content, ip_region, is_login_user, is_admin_user, status, ip_masked, user_agent_hash, created_at
	          FROM guestbook_messages WHERE status = 'visible'`
	if admin {
		countQ = `SELECT COUNT(*) FROM guestbook_messages WHERE status IN ('visible','hidden')`
		listQ = `SELECT id, user_id, nickname, avatar, content, ip_region, is_login_user, is_admin_user, status, ip_masked, user_agent_hash, created_at
		         FROM guestbook_messages WHERE status IN ('visible','hidden')`
	}
	if err := db.QueryRow(countQ).Scan(&total); err != nil {
		writeGuestbookErr(w, http.StatusInternalServerError, "SERVER_ERROR", "加载留言失败")
		return
	}
	rows, err := db.Query(listQ+` ORDER BY id DESC LIMIT ? OFFSET ?`, pageSize, offset)
	if err != nil {
		writeGuestbookErr(w, http.StatusInternalServerError, "SERVER_ERROR", "加载留言失败")
		return
	}
	defer rows.Close()

	items := make([]guestbookMessageRow, 0)
	for rows.Next() {
		item, err := scanGuestbookRow(rows, admin)
		if err != nil {
			writeGuestbookErr(w, http.StatusInternalServerError, "SERVER_ERROR", "加载留言失败")
			return
		}
		items = append(items, item)
	}
	writeJSON(w, map[string]any{
		"items":    items,
		"page":     page,
		"pageSize": pageSize,
		"total":    total,
		"isAdmin":  admin,
	})
}

func scanGuestbookRow(rows *sql.Rows, admin bool) (guestbookMessageRow, error) {
	var item guestbookMessageRow
	var userID sql.NullInt64
	var avatar, ipMasked, uaHash sql.NullString
	var isLogin, isAdmin int
	var status string
	var created string
	err := rows.Scan(
		&item.ID, &userID, &item.Nickname, &avatar, &item.Content, &item.IPRegion,
		&isLogin, &isAdmin, &status, &ipMasked, &uaHash, &created,
	)
	if err != nil {
		return item, err
	}
	item.Avatar = avatar.String
	item.IsLoginUser = isLogin == 1
	item.IsAdminUser = isAdmin == 1
	item.CreatedAt = formatGuestbookTime(created)
	if admin {
		item.Status = status
		item.IPMasked = ipMasked.String
		item.UserAgentHash = uaHash.String
	}
	return item, nil
}

func guestbookCreateHandler(w http.ResponseWriter, r *http.Request) {
	cu := getCurrentUserFromRequest(r)
	var body struct {
		Nickname string `json:"nickname"`
		Content  string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeGuestbookErr(w, http.StatusBadRequest, "INVALID_JSON", "请求格式不正确")
		return
	}
	content := strings.TrimSpace(body.Content)
	if content == "" {
		writeGuestbookErr(w, http.StatusBadRequest, "INVALID_CONTENT", "留言内容不能为空")
		return
	}
	if utf8.RuneCountInString(content) > guestbookContentMax {
		writeGuestbookErr(w, http.StatusBadRequest, "INVALID_CONTENT", "留言最多 300 字哦")
		return
	}

	var (
		nickname    string
		avatar      string
		userID      sql.NullInt64
		isLogin     int
		isAdminUser int
	)
	if cu == nil {
		nickname = strings.TrimSpace(body.Nickname)
		if nickname == "" {
			writeGuestbookErr(w, http.StatusBadRequest, "INVALID_NICKNAME", "请给自己取个名字吧")
			return
		}
		if utf8.RuneCountInString(nickname) > guestbookNickMax {
			writeGuestbookErr(w, http.StatusBadRequest, "INVALID_NICKNAME", "昵称最多 12 个字哦")
			return
		}
	} else {
		nickname = cu.Nickname
		avatar = cu.Avatar
		userID = sql.NullInt64{Int64: cu.ID, Valid: true}
		isLogin = 1
		if cu.Role == "admin" {
			isAdminUser = 1
		}
	}

	ip := clientIP(r)
	ipHash := hashKey("ip", ip)
	ua := r.UserAgent()
	uaHash := hashKey("ua", ua)
	contentHash := hashKey("content", content)

	if err := guestbookCheckRateLimit(cu, ipHash, uaHash); err != nil {
		writeGuestbookErr(w, http.StatusTooManyRequests, "RATE_LIMITED", err.Error())
		return
	}
	if guestbookIsDuplicate(cu, ipHash, contentHash, time.Now().UTC().Add(-guestbookDupWindow).Format(time.RFC3339)) {
		writeGuestbookErr(w, http.StatusTooManyRequests, "RATE_LIMITED", "相同内容提交太快啦，稍后再试～")
		return
	}

	ipRegion := lookupIPRegion(db, ip, ipHash)
	ipMasked := maskIP(ip)
	now := time.Now().UTC().Format(time.RFC3339)

	res, err := db.Exec(
		`INSERT INTO guestbook_messages
		 (user_id, nickname, avatar, content, content_hash, ip_hash, ip_region, ip_masked, user_agent_hash, status, is_login_user, is_admin_user, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'visible', ?, ?, ?, ?)`,
		userID, nickname, avatar, content, contentHash, ipHash, ipRegion, ipMasked, uaHash,
		isLogin, isAdminUser, now, now,
	)
	if err != nil {
		writeGuestbookErr(w, http.StatusInternalServerError, "SERVER_ERROR", "小纸条没有贴上，请稍后再试～")
		return
	}
	id, _ := res.LastInsertId()
	item := guestbookMessageRow{
		ID:          id,
		Nickname:    nickname,
		Avatar:      avatar,
		Content:     content,
		IPRegion:    ipRegion,
		CreatedAt:   formatGuestbookTime(now),
		IsLoginUser: isLogin == 1,
		IsAdminUser: isAdminUser == 1,
		Status:      "visible",
	}
	writeJSON(w, map[string]any{
		"message": "留言成功",
		"item":    item,
	})
}

func guestbookCheckRateLimit(cu *currentUser, ipHash, uaHash string) error {
	now := time.Now().UTC()
	hourAgo := now.Add(-time.Hour).Format(time.RFC3339)
	dayStart := now.Format("2006-01-02") + "T00:00:00Z"

	var hourLimit, dayLimit int
	var hourCount, dayCount int
	var err error

	if cu != nil {
		hourLimit, dayLimit = 10, 30
		err = db.QueryRow(
			`SELECT
			  (SELECT COUNT(*) FROM guestbook_messages WHERE user_id = ? AND created_at >= ?),
			  (SELECT COUNT(*) FROM guestbook_messages WHERE user_id = ? AND created_at >= ?)`,
			cu.ID, hourAgo, cu.ID, dayStart,
		).Scan(&hourCount, &dayCount)
	} else {
		hourLimit, dayLimit = 3, 10
		err = db.QueryRow(
			`SELECT
			  (SELECT COUNT(*) FROM guestbook_messages WHERE ip_hash = ? AND user_agent_hash = ? AND is_login_user = 0 AND created_at >= ?),
			  (SELECT COUNT(*) FROM guestbook_messages WHERE ip_hash = ? AND user_agent_hash = ? AND is_login_user = 0 AND created_at >= ?)`,
			ipHash, uaHash, hourAgo, ipHash, uaHash, dayStart,
		).Scan(&hourCount, &dayCount)
	}
	if err != nil {
		return nil
	}
	if hourCount >= hourLimit || dayCount >= dayLimit {
		return errGuestbookRateLimited
	}
	return nil
}

var errGuestbookRateLimited = &guestbookErr{msg: "留言太频繁啦，稍后再来贴小纸条吧～"}

type guestbookErr struct{ msg string }

func (e *guestbookErr) Error() string { return e.msg }

func guestbookIsDuplicate(cu *currentUser, ipHash, contentHash, since string) bool {
	if cu != nil {
		var n int
		_ = db.QueryRow(
			`SELECT COUNT(*) FROM guestbook_messages WHERE user_id = ? AND content_hash = ? AND created_at >= ?`,
			cu.ID, contentHash, since,
		).Scan(&n)
		return n > 0
	}
	var n int
	_ = db.QueryRow(
		`SELECT COUNT(*) FROM guestbook_messages WHERE ip_hash = ? AND content_hash = ? AND is_login_user = 0 AND created_at >= ?`,
		ipHash, contentHash, since,
	).Scan(&n)
	return n > 0
}

func guestbookDeleteHandler(w http.ResponseWriter, r *http.Request, id int64) {
	cu := getCurrentUserFromRequest(r)
	if !isAdminUser(cu) {
		writeGuestbookErr(w, http.StatusForbidden, "FORBIDDEN", "无权操作")
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	res, err := db.Exec(
		`UPDATE guestbook_messages SET status = 'deleted', updated_at = ? WHERE id = ? AND status != 'deleted'`,
		now, id,
	)
	if err != nil {
		writeGuestbookErr(w, http.StatusInternalServerError, "SERVER_ERROR", "删除失败")
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		writeGuestbookErr(w, http.StatusNotFound, "NOT_FOUND", "留言不存在")
		return
	}
	writeJSON(w, map[string]any{"ok": true, "message": "已删除"})
}

func guestbookPatchStatusHandler(w http.ResponseWriter, r *http.Request, id int64) {
	cu := getCurrentUserFromRequest(r)
	if !isAdminUser(cu) {
		writeGuestbookErr(w, http.StatusForbidden, "FORBIDDEN", "无权操作")
		return
	}
	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeGuestbookErr(w, http.StatusBadRequest, "INVALID_JSON", "请求格式不正确")
		return
	}
	status := strings.TrimSpace(body.Status)
	switch status {
	case "visible", "hidden", "deleted":
	default:
		writeGuestbookErr(w, http.StatusBadRequest, "INVALID_CONTENT", "无效的状态")
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	res, err := db.Exec(
		`UPDATE guestbook_messages SET status = ?, updated_at = ? WHERE id = ?`,
		status, now, id,
	)
	if err != nil {
		writeGuestbookErr(w, http.StatusInternalServerError, "SERVER_ERROR", "更新失败")
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		writeGuestbookErr(w, http.StatusNotFound, "NOT_FOUND", "留言不存在")
		return
	}
	writeJSON(w, map[string]any{"ok": true, "status": status})
}

func formatGuestbookTime(iso string) string {
	t, err := time.Parse(time.RFC3339, iso)
	if err != nil {
		if t2, e2 := time.Parse("2006-01-02T15:04:05Z", iso); e2 == nil {
			t = t2
		} else {
			return iso
		}
	}
	loc := time.FixedZone("CST", 8*3600)
	t = t.In(loc)
	now := time.Now().In(loc)
	if t.Year() == now.Year() && t.YearDay() == now.YearDay() {
		return "今天 " + t.Format("15:04")
	}
	if t.Year() == now.Year() {
		return t.Format("01-02 15:04")
	}
	return t.Format("2006-01-02 15:04")
}
