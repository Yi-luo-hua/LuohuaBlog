package main

import (
	"database/sql"
	"log"
	"time"
)

func seedDefaultACGData(db *sql.DB) {
	if err := seedBangumiDefaults(db); err != nil {
		log.Println("seed: bangumi defaults:", err)
	}
	if err := seedRadarDefaults(db); err != nil {
		log.Println("seed: radar defaults:", err)
	}
}

func seedBangumiDefaults(db *sql.DB) error {
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM bangumi_items`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	return replaceBangumiItems(db, []bangumiItem{
		{ID: "b1", Title: "A Certain Scientific Railgun", Watched: 12, Total: 24, LatestEpisode: 24},
		{ID: "b2", Title: "Healing Sketchbook", Watched: 8, Total: 12, LatestEpisode: 10},
		{ID: "b3", Title: "Chronicles of Creation", Watched: 3, Total: 13, LatestEpisode: 7},
		{ID: "b4", Title: "Reimu Garden", Watched: 6, Total: 12, LatestEpisode: 9},
	})
}

func seedRadarDefaults(db *sql.DB) error {
	var count int
	if err := db.QueryRow(`SELECT COUNT(*) FROM radar_feed`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	now := time.Now().UTC()
	items := []radarItem{
		{
			ID:          "seed_r1",
			UpUID:       "seed_tech_lullaby",
			CreatorName: "UP · TechLullaby",
			LatestText:  "Posted a calm devlog with a fresh cover — worth a peek tonight.",
			IsNew:       true,
			LinkURL:     "https://space.bilibili.com/",
			PublishedAt: now.Add(-2 * time.Hour).Format(time.RFC3339),
		},
		{
			ID:          "seed_r2",
			UpUID:       "seed_systems_garden",
			CreatorName: "UP · SystemsGarden",
			LatestText:  "New video: stream caches, latency tuning, no ads.",
			IsNew:       false,
			LinkURL:     "https://space.bilibili.com/",
			PublishedAt: now.Add(-26 * time.Hour).Format(time.RFC3339),
		},
		{
			ID:          "seed_r3",
			UpUID:       "seed_mythic_coder",
			CreatorName: "UP · MythicCoder",
			LatestText:  "Radar sync: 3 creators added to the watch list.",
			IsNew:       true,
			LinkURL:     "https://space.bilibili.com/",
			PublishedAt: now.Add(-5 * time.Hour).Format(time.RFC3339),
		},
		{
			ID:          "seed_r4",
			UpUID:       "seed_calm_canvas",
			CreatorName: "UP · CalmCanvas",
			LatestText:  "Mobile grid polish for ACG navigation cards.",
			IsNew:       false,
			LinkURL:     "https://space.bilibili.com/",
			PublishedAt: now.Add(-48 * time.Hour).Format(time.RFC3339),
		},
	}
	for _, item := range items {
		if err := upsertRadarFeed(db, item); err != nil {
			return err
		}
	}
	return nil
}
