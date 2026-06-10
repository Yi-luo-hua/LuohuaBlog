package main

import (
	"log"
	"net/http"
	"strings"
	"time"
)

const (
	securityAuditFieldMaxRunes  = 80
	securityAuditDetailMaxRunes = 160
)

func recordSecurityAudit(r *http.Request, event, outcome string, actorUserID int64, targetType, targetID, detail string) {
	if db == nil {
		return
	}
	if actorUserID < 0 {
		actorUserID = 0
	}

	ipHash := ""
	uaHash := ""
	if r != nil {
		if ip := strings.TrimSpace(clientIP(r)); ip != "" {
			ipHash = hashKey("ip", ip)
		}
		if ua := strings.TrimSpace(r.UserAgent()); ua != "" {
			uaHash = hashKey("ua", ua)
		}
	}

	_, err := db.Exec(
		`INSERT INTO security_audit_logs
		 (event, outcome, actor_user_id, ip_hash, user_agent_hash, target_type, target_id, detail, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		normalizeSecurityAuditText(event, securityAuditFieldMaxRunes),
		normalizeSecurityAuditText(outcome, securityAuditFieldMaxRunes),
		actorUserID,
		ipHash,
		uaHash,
		normalizeSecurityAuditText(targetType, securityAuditFieldMaxRunes),
		normalizeSecurityAuditText(targetID, securityAuditFieldMaxRunes),
		normalizeSecurityAuditText(detail, securityAuditDetailMaxRunes),
		time.Now().UTC().Format(time.RFC3339),
	)
	if err != nil {
		log.Printf("security audit log write failed: %v", err)
	}
}

func normalizeSecurityAuditText(value string, maxRunes int) string {
	value = strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
	if maxRunes <= 0 {
		return value
	}
	runes := []rune(value)
	if len(runes) <= maxRunes {
		return value
	}
	return string(runes[:maxRunes])
}
