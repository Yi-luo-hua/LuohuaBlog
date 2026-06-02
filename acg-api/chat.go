package main

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"unicode/utf8"
)

func chatHandler(w http.ResponseWriter, r *http.Request) {
	id := resolveChatIdentity(r)
	enabled := chatConfigured()

	switch r.Method {
	case http.MethodGet:
		snap, err := getQuotaSnapshot(db, id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, map[string]any{
			"limit":       snap.Limit,
			"used":        snap.Used,
			"remaining":   snap.Remaining,
			"isLogin":     snap.IsLogin,
			"chatEnabled": enabled,
		})
		return
	case http.MethodPost:
		handleChatPost(w, r, id, enabled)
		return
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func handleChatPost(w http.ResponseWriter, r *http.Request, id chatIdentity, enabled bool) {
	var body struct {
		Message   string `json:"message"`
		PageURL   string `json:"pageUrl"`
		PageTitle string `json:"pageTitle"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "INVALID_JSON",
			"message": "请求格式不正确",
		})
		return
	}
	msg := strings.TrimSpace(body.Message)
	if msg == "" {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "EMPTY_MESSAGE",
			"message": "请输入问题后再发送",
		})
		return
	}
	if utf8.RuneCountInString(msg) > 500 {
		writeJSONStatus(w, http.StatusBadRequest, map[string]any{
			"error":   "MESSAGE_TOO_LONG",
			"message": "单次最多 500 字哦",
		})
		return
	}

	if !enabled {
		snap, _ := getQuotaSnapshot(db, id)
		writeJSONStatus(w, http.StatusServiceUnavailable, map[string]any{
			"error":       "CHAT_NOT_CONFIGURED",
			"message":     "小精灵还在沉睡中～站长配置 DeepSeek API Key 后就能聊天啦",
			"chatEnabled": false,
			"limit":       id.Limit,
			"used":        snap.Used,
			"remaining":   snap.Remaining,
			"isLogin":     id.IsLogin,
		})
		return
	}

	preSnap, _ := getQuotaSnapshot(db, id)
	if preSnap.Used >= id.Limit {
		writeJSONStatus(w, http.StatusTooManyRequests, quotaErrBody(id, preSnap, errDailyExceeded))
		return
	}

	snap, err := reserveQuota(db, id)
	if err != nil {
		var qe *quotaError
		if errors.As(err, &qe) {
			if snap.Used == 0 {
				snap, _ = getQuotaSnapshot(db, id)
			}
			writeJSONStatus(w, http.StatusTooManyRequests, quotaErrBody(id, snap, qe))
			return
		}
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	ds := newDeepSeekClient()
	reply, err := ds.Chat(msg, strings.TrimSpace(body.PageURL), strings.TrimSpace(body.PageTitle))
	if err != nil {
		rollbackQuota(db, id)
		snap, _ = getQuotaSnapshot(db, id)
		writeJSONStatus(w, http.StatusServiceUnavailable, map[string]any{
			"error":     "UPSTREAM_ERROR",
			"message":   "小精灵暂时走神了，请稍后再试～",
			"limit":     id.Limit,
			"used":      snap.Used,
			"remaining": snap.Remaining,
			"isLogin":   id.IsLogin,
		})
		return
	}

	writeJSON(w, map[string]any{
		"reply":     reply,
		"limit":     id.Limit,
		"used":      snap.Used,
		"remaining": snap.Remaining,
		"isLogin":   id.IsLogin,
	})
}

func writeJSONStatus(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(v)
}
