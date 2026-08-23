package main

import (
	"database/sql"
	"log"
	"time"
)

func seedDefaultACGData(db *sql.DB) {
	if _, err := db.Exec(`DELETE FROM bangumi_items WHERE id IN ('b1', 'b2', 'b3', 'b4')`); err != nil {
		log.Println("seed: remove legacy bangumi placeholders:", err)
	}
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
