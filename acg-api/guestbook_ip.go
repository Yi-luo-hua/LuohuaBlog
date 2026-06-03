package main

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"io"
	"net"
	"net/http"
	"strings"
	"time"
)

func hashKey(parts ...string) string {
	h := sha256.New()
	for _, p := range parts {
		h.Write([]byte(p))
		h.Write([]byte{0})
	}
	return hex.EncodeToString(h.Sum(nil)[:16])
}

func maskIP(ip string) string {
	ip = strings.TrimSpace(ip)
	if ip == "" {
		return "*"
	}
	if host, _, err := net.SplitHostPort(ip); err == nil {
		ip = host
	}
	if strings.Contains(ip, ":") {
		return "ipv6:*"
	}
	parts := strings.Split(ip, ".")
	if len(parts) == 4 {
		return parts[0] + "." + parts[1] + ".*.*"
	}
	return "*"
}

func isPrivateIP(ip string) bool {
	parsed := net.ParseIP(strings.TrimSpace(ip))
	if parsed == nil {
		return false
	}
	return parsed.IsLoopback() || parsed.IsPrivate() || parsed.IsLinkLocalUnicast()
}

func lookupIPRegion(db *sql.DB, ip, ipHash string) string {
	if isPrivateIP(ip) {
		return "本地"
	}
	var region string
	err := db.QueryRow(
		`SELECT ip_region FROM guestbook_ip_cache WHERE ip_hash = ?`, ipHash,
	).Scan(&region)
	if err == nil && region != "" {
		return region
	}
	region = fetchIPRegionHTTP(ip)
	if region == "" {
		region = "未知地区"
	}
	_, _ = db.Exec(
		`INSERT INTO guestbook_ip_cache (ip_hash, ip_region, updated_at) VALUES (?, ?, ?)
		 ON CONFLICT(ip_hash) DO UPDATE SET ip_region=excluded.ip_region, updated_at=excluded.updated_at`,
		ipHash, region, time.Now().UTC().Format(time.RFC3339),
	)
	return region
}

func fetchIPRegionHTTP(ip string) string {
	client := &http.Client{Timeout: 2 * time.Second}
	url := "http://ip-api.com/json/" + ip + "?lang=zh-CN&fields=regionName,city,status"
	res, err := client.Get(url)
	if err != nil {
		return ""
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	var data struct {
		Status     string `json:"status"`
		RegionName string `json:"regionName"`
		City       string `json:"city"`
	}
	if json.Unmarshal(body, &data) != nil || data.Status != "success" {
		return ""
	}
	if data.RegionName != "" && data.City != "" && data.RegionName != data.City {
		return data.RegionName + " " + data.City
	}
	if data.City != "" {
		return data.City
	}
	return data.RegionName
}
