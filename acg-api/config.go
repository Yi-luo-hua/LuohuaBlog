package main

// Bilibili sync targets (override via env if needed).
var defaultConfig = AppConfig{
	BilibiliUID: "1061280173",
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
	BilibiliUID   string
	RadarCreators []RadarCreator
}

func loadConfig() AppConfig {
	cfg := defaultConfig
	if v := env("BILIBILI_UID", ""); v != "" {
		cfg.BilibiliUID = v
	}
	return cfg
}
