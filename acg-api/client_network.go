package main

import (
	"net/http"
	"strings"
	"time"
)

func clientNetworkHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		methodNotAllowed(w)
		return
	}

	ip := clientIP(r)
	region := clientNetworkRegion(ip)
	writeJSON(w, map[string]any{
		"regionLabel": compactClientRegionLabel(region),
		"ipRegion":    region,
		"ipMasked":    maskIP(ip),
		"serverTime":  time.Now().UTC().Format(time.RFC3339),
	})
}

func clientNetworkRegion(ip string) string {
	if isPrivateIP(ip) {
		return "本地"
	}
	if db == nil {
		return ""
	}
	ipHash := hashKey("ip", ip)
	if env("CLIENT_NETWORK_REGION_LOOKUP", "") == "1" {
		return lookupIPRegion(db, ip, ipHash)
	}
	var region string
	if err := db.QueryRow(`SELECT ip_region FROM guestbook_ip_cache WHERE ip_hash = ?`, ipHash).Scan(&region); err == nil {
		return region
	}
	return ""
}

func compactClientRegionLabel(region string) string {
	region = strings.TrimSpace(region)
	if region == "" || region == "未知地区" {
		return "访客"
	}
	fields := strings.Fields(region)
	if len(fields) > 0 {
		region = fields[len(fields)-1]
	}
	runes := []rune(region)
	if len(runes) > 6 {
		return string(runes[:6])
	}
	return region
}
