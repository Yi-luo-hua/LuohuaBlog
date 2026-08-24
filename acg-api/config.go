package main

import "strings"

var defaultConfig = AppConfig{
	GithubLogin: "Yi-luo-hua",
}

type AppConfig struct {
	BangumiAccessToken string
	BangumiUsername    string
	BangumiAPIBaseURL  string
	GithubLogin        string
	GithubToken        string
	GithubAPIBaseURL   string
}

func loadConfig() AppConfig {
	cfg := defaultConfig
	cfg.BangumiAccessToken = env("BANGUMI_ACCESS_TOKEN", "")
	cfg.BangumiUsername = strings.TrimSpace(env("BANGUMI_USERNAME", ""))
	cfg.BangumiAPIBaseURL = env("BANGUMI_API_BASE_URL", "https://api.bgm.tv")
	cfg.GithubLogin = env("GITHUB_ACTIVITY_LOGIN", defaultConfig.GithubLogin)
	// Only public commit data is read, so a token is optional; it exists purely
	// to lift the search rate limit from 10/hour to 30/minute.
	cfg.GithubToken = env("GITHUB_ACTIVITY_TOKEN", env("OWNER_PUBLISH_GITHUB_TOKEN", ""))
	cfg.GithubAPIBaseURL = env("GITHUB_API_BASE_URL", "https://api.github.com")
	return cfg
}
