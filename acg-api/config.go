package main

// Bilibili sync targets (override via env if needed).
var defaultConfig = AppConfig{
	BilibiliUID: "1061280173",
	GithubLogin: "Yi-luo-hua",
	RadarCreators: []RadarCreator{
		{UID: "517327498", Name: "罗翔说刑法"},
		{UID: "431073645", Name: "你的影月月"},
		{UID: "37974444", Name: "黑马程序员"},
		{UID: "398915225", Name: "挪威的月亮"},
	},
}

type RadarCreator struct {
	UID  string
	Name string
}

type AppConfig struct {
	BilibiliUID        string
	RadarCreators      []RadarCreator
	BangumiAccessToken string
	BangumiAPIBaseURL  string
	GithubLogin        string
	GithubToken        string
	GithubAPIBaseURL   string
}

func loadConfig() AppConfig {
	cfg := defaultConfig
	if v := env("BILIBILI_UID", ""); v != "" {
		cfg.BilibiliUID = v
	}
	cfg.BangumiAccessToken = env("BANGUMI_ACCESS_TOKEN", "")
	cfg.BangumiAPIBaseURL = env("BANGUMI_API_BASE_URL", "https://api.bgm.tv")
	cfg.GithubLogin = env("GITHUB_ACTIVITY_LOGIN", defaultConfig.GithubLogin)
	// Only public commit data is read, so a token is optional; it exists purely
	// to lift the search rate limit from 10/hour to 30/minute.
	cfg.GithubToken = env("GITHUB_ACTIVITY_TOKEN", env("OWNER_PUBLISH_GITHUB_TOKEN", ""))
	cfg.GithubAPIBaseURL = env("GITHUB_API_BASE_URL", "https://api.github.com")
	return cfg
}
