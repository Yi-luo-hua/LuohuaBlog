package main

import (
	"crypto/sha1"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	wallpaperAPIMaxItems       = 1000
	wallpaperAPIRefreshCount   = 10
	wallpaperHTTPClientTimeout = 10 * time.Second
)

type wallpaperItem struct {
	ID          string    `json:"id"`
	URL         string    `json:"url"`
	PreviewURL  string    `json:"previewUrl,omitempty"`
	Source      string    `json:"source"`
	Author      string    `json:"author,omitempty"`
	SourceURL   string    `json:"sourceUrl,omitempty"`
	LicenseNote string    `json:"licenseNote,omitempty"`
	Kind        string    `json:"kind"`
	Status      string    `json:"status,omitempty"`
	AddedAt     time.Time `json:"addedAt"`
}

func startWallpaperPoolLoop(db *sql.DB) {
	go func() {
		runWallpaperPoolSync(db)
		t := time.NewTicker(1 * time.Hour)
		for range t.C {
			runWallpaperPoolSync(db)
		}
	}()
}

func runWallpaperPoolSync(db *sql.DB) {
	items, err := fetchLegalWallpaperItems(wallpaperAPIRefreshCount)
	if err != nil {
		log.Println("sync: wallpaper fetch skipped:", err)
		return
	}
	if len(items) == 0 {
		log.Println("sync: wallpaper fetch returned empty list; keeping cached pool")
		return
	}
	if err := insertWallpaperItems(db, items, time.Now().UTC()); err != nil {
		log.Println("sync: wallpaper db error:", err)
		return
	}
	log.Printf("sync: wallpaper done (%d new candidates)\n", len(items))
}

func fetchLegalWallpaperItems(limit int) ([]wallpaperItem, error) {
	var combined []wallpaperItem
	if pexelsKey := env("PEXELS_API_KEY", ""); pexelsKey != "" {
		items, err := fetchPexelsWallpapers(pexelsKey, limit)
		if err != nil {
			log.Println("sync: pexels wallpaper error:", err)
		}
		combined = append(combined, items...)
	}
	if len(combined) < limit {
		if pixabayKey := env("PIXABAY_API_KEY", ""); pixabayKey != "" {
			items, err := fetchPixabayWallpapers(pixabayKey, limit-len(combined))
			if err != nil {
				log.Println("sync: pixabay wallpaper error:", err)
			}
			combined = append(combined, items...)
		}
	}
	if len(combined) == 0 {
		return nil, errors.New("PEXELS_API_KEY or PIXABAY_API_KEY is not configured")
	}
	if len(combined) > limit {
		combined = combined[:limit]
	}
	return combined, nil
}

func fetchPexelsWallpapers(apiKey string, limit int) ([]wallpaperItem, error) {
	page := rand.Intn(50) + 1
	endpoint := fmt.Sprintf("https://api.pexels.com/v1/search?query=%s&orientation=landscape&per_page=%d&page=%d", url.QueryEscape("wallpaper nature city sky"), limit, page)
	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", apiKey)
	req.Header.Set("User-Agent", "taozhiyy-wallpaper-pool/1.0")

	var body struct {
		Photos []struct {
			ID           int    `json:"id"`
			URL          string `json:"url"`
			Photographer string `json:"photographer"`
			Src          struct {
				Large2x   string `json:"large2x"`
				Large     string `json:"large"`
				Medium    string `json:"medium"`
				Landscape string `json:"landscape"`
			} `json:"src"`
		} `json:"photos"`
	}
	if err := doWallpaperJSON(req, &body); err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	items := make([]wallpaperItem, 0, len(body.Photos))
	for _, photo := range body.Photos {
		imageURL := firstWallpaperValue(photo.Src.Large2x, photo.Src.Large, photo.Src.Landscape)
		previewURL := firstWallpaperValue(photo.Src.Medium, photo.Src.Landscape, imageURL)
		if imageURL == "" {
			continue
		}
		items = append(items, wallpaperItem{
			ID:          stableWallpaperID("pexels", fmt.Sprint(photo.ID), imageURL),
			URL:         imageURL,
			PreviewURL:  previewURL,
			Source:      "pexels",
			Author:      photo.Photographer,
			SourceURL:   photo.URL,
			LicenseNote: "Pexels License",
			Kind:        "api",
			Status:      "active",
			AddedAt:     now,
		})
	}
	return items, nil
}

func fetchPixabayWallpapers(apiKey string, limit int) ([]wallpaperItem, error) {
	page := rand.Intn(50) + 1
	endpoint := fmt.Sprintf("https://pixabay.com/api/?key=%s&q=%s&image_type=photo&orientation=horizontal&safesearch=true&per_page=%d&page=%d", url.QueryEscape(apiKey), url.QueryEscape("wallpaper landscape"), limit, page)
	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "taozhiyy-wallpaper-pool/1.0")

	var body struct {
		Hits []struct {
			ID           int    `json:"id"`
			PageURL      string `json:"pageURL"`
			User         string `json:"user"`
			LargeURL     string `json:"largeImageURL"`
			WebformatURL string `json:"webformatURL"`
		} `json:"hits"`
	}
	if err := doWallpaperJSON(req, &body); err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	items := make([]wallpaperItem, 0, len(body.Hits))
	for _, hit := range body.Hits {
		imageURL := firstWallpaperValue(hit.LargeURL, hit.WebformatURL)
		if imageURL == "" {
			continue
		}
		items = append(items, wallpaperItem{
			ID:          stableWallpaperID("pixabay", fmt.Sprint(hit.ID), imageURL),
			URL:         imageURL,
			PreviewURL:  firstWallpaperValue(hit.WebformatURL, imageURL),
			Source:      "pixabay",
			Author:      hit.User,
			SourceURL:   hit.PageURL,
			LicenseNote: "Pixabay Content License",
			Kind:        "api",
			Status:      "active",
			AddedAt:     now,
		})
	}
	return items, nil
}

func doWallpaperJSON(req *http.Request, out any) error {
	client := &http.Client{Timeout: wallpaperHTTPClientTimeout}
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("http %d", res.StatusCode)
	}
	return json.NewDecoder(res.Body).Decode(out)
}

func insertWallpaperItems(db *sql.DB, items []wallpaperItem, now time.Time) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, item := range items {
		if item.URL == "" || item.ID == "" {
			continue
		}
		if item.Kind == "" {
			item.Kind = "api"
		}
		if item.Status == "" {
			item.Status = "active"
		}
		if item.AddedAt.IsZero() {
			item.AddedAt = now
		}
		_, err := tx.Exec(
			`INSERT INTO wallpaper_pool
			 (id, url, preview_url, source, author, source_url, license_note, kind, status, added_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(id) DO NOTHING`,
			item.ID, item.URL, item.PreviewURL, item.Source, item.Author, item.SourceURL,
			item.LicenseNote, item.Kind, item.Status, item.AddedAt.Format(time.RFC3339),
		)
		if err != nil {
			return err
		}
	}
	if err := pruneAPIWallpaperItems(tx, wallpaperAPIMaxItems); err != nil {
		return err
	}
	return tx.Commit()
}

func pruneAPIWallpaperItems(tx *sql.Tx, maxItems int) error {
	var count int
	if err := tx.QueryRow(`SELECT COUNT(*) FROM wallpaper_pool WHERE kind='api'`).Scan(&count); err != nil {
		return err
	}
	over := count - maxItems
	if over <= 0 {
		return nil
	}
	_, err := tx.Exec(
		`DELETE FROM wallpaper_pool
		 WHERE id IN (
		   SELECT id FROM wallpaper_pool
		   WHERE kind='api'
		   ORDER BY added_at ASC, id ASC
		   LIMIT ?
		 )`,
		over,
	)
	return err
}

func drawWallpaperItem(db *sql.DB) (wallpaperItem, error) {
	row := db.QueryRow(
		`SELECT id, url, preview_url, source, author, source_url, license_note, kind, status, added_at
		 FROM wallpaper_pool
		 WHERE status='active'
		 ORDER BY RANDOM()
		 LIMIT 1`,
	)
	var item wallpaperItem
	var addedAt string
	if err := row.Scan(&item.ID, &item.URL, &item.PreviewURL, &item.Source, &item.Author, &item.SourceURL, &item.LicenseNote, &item.Kind, &item.Status, &addedAt); err != nil {
		return item, err
	}
	if parsed, err := time.Parse(time.RFC3339, addedAt); err == nil {
		item.AddedAt = parsed
	}
	_, _ = db.Exec(`UPDATE wallpaper_pool SET last_drawn_at=? WHERE id=?`, time.Now().UTC().Format(time.RFC3339), item.ID)
	return item, nil
}

func stableWallpaperID(source, upstreamID, imageURL string) string {
	sum := sha1.Sum([]byte(strings.Join([]string{source, upstreamID, imageURL}, "|")))
	return source + "-" + hex.EncodeToString(sum[:])[:16]
}

func firstWallpaperValue(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}
