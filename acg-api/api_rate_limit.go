package main

import (
	"net/http"
	"time"
)

var (
	chatPostLimiter    = newIPRateLimiter(20, time.Minute)
	aiImagePostLimiter = newIPRateLimiter(6, time.Minute)
)

func allowAPIPost(limiter *ipRateLimiter, r *http.Request) bool {
	if limiter == nil {
		return true
	}
	return limiter.Allow(clientIP(r))
}

func writeAPIRateLimited(w http.ResponseWriter) {
	writeJSONStatus(w, http.StatusTooManyRequests, map[string]any{
		"error":   "RATE_LIMITED",
		"message": "Too many requests, please try again later.",
	})
}
