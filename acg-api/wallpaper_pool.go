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

var fallbackWallpaperItems = []wallpaperItem{
	{
		ID:          "fallback-ai-blog-0e7e10e2acdb398941c10735a791918d",
		URL:         "https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/AI%E8%87%AA%E5%8A%A8%E5%8C%96%E5%8D%9A%E5%AE%A2%E5%9B%BE%E7%89%87/0e7e10e2acdb398941c10735a791918d.jpg",
		PreviewURL:  "https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/AI%E8%87%AA%E5%8A%A8%E5%8C%96%E5%8D%9A%E5%AE%A2%E5%9B%BE%E7%89%87/0e7e10e2acdb398941c10735a791918d.jpg",
		Source:      "local-gallery",
		Author:      "taozhiyy",
		SourceURL:   "https://taozhiyy.top/gallery",
		LicenseNote: "Local gallery fallback",
		Kind:        "fallback",
		Status:      "active",
	},
	{
		ID:          "fallback-misaka-915cdb4184d77e9d06e789755f30f792",
		URL:         "https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/%E6%97%8B%E8%BD%AC%E7%9B%B8%E5%86%8C%E5%BE%A1%E5%9D%82%E7%BE%8E%E7%90%B4/915cdb4184d77e9d06e789755f30f792.jpg",
		PreviewURL:  "https://tzyy-1330068502.cos.ap-beijing.myqcloud.com/%E6%97%8B%E8%BD%AC%E7%9B%B8%E5%86%8C%E5%BE%A1%E5%9D%82%E7%BE%8E%E7%90%B4/915cdb4184d77e9d06e789755f30f792.jpg",
		Source:      "local-gallery",
		Author:      "taozhiyy",
		SourceURL:   "https://taozhiyy.top/gallery/misaka",
		LicenseNote: "Local gallery fallback",
		Kind:        "fallback",
		Status:      "active",
	},
}

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
	return fetchWaifuWallpapers(limit)
}

type waifuSearchResponse struct {
	Items []waifuImage `json:"items"`
}

type waifuImage struct {
	ID         int           `json:"id"`
	URL        string        `json:"url"`
	Source     string        `json:"source"`
	IsNsfw     bool          `json:"isNsfw"`
	IsAnimated bool          `json:"isAnimated"`
	Width      int           `json:"width"`
	Height     int           `json:"height"`
	Artists    []waifuArtist `json:"artists"`
}

type waifuArtist struct {
	Name string `json:"name"`
}

func fetchWaifuWallpapers(limit int) ([]wallpaperItem, error) {
	endpoint := buildWaifuWallpaperEndpoint(limit)
	req, err := http.NewRequest(http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "taozhiyy-wallpaper-pool/1.0")
	req.Header.Set("Accept", "application/json")

	var body waifuSearchResponse
	if err := doWallpaperJSON(req, &body); err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	items := make([]wallpaperItem, 0, len(body.Items))
	for _, image := range body.Items {
		item, ok := waifuImageToWallpaperItem(image, now)
		if !ok {
			continue
		}
		items = append(items, item)
	}
	if len(items) == 0 {
		return nil, errors.New("waifu.im returned no eligible landscape images")
	}
	return items, nil
}

func buildWaifuWallpaperEndpoint(limit int) string {
	if limit <= 0 {
		limit = 1
	}
	query := url.Values{}
	query.Set("IncludedTags", "waifu")
	query.Set("IsNsfw", "False")
	query.Set("IsAnimated", "False")
	query.Set("Orientation", "Landscape")
	query.Set("PageSize", fmt.Sprint(limit))
	query.Set("PageNumber", fmt.Sprint(rand.Intn(5)+1))
	return "https://api.waifu.im/images?" + query.Encode()
}

func waifuImageToWallpaperItem(image waifuImage, now time.Time) (wallpaperItem, bool) {
	if strings.TrimSpace(image.URL) == "" || image.IsNsfw || image.IsAnimated {
		return wallpaperItem{}, false
	}
	if image.Width <= image.Height {
		return wallpaperItem{}, false
	}
	author := "waifu.im"
	for _, artist := range image.Artists {
		if strings.TrimSpace(artist.Name) != "" {
			author = artist.Name
			break
		}
	}
	return wallpaperItem{
		ID:          stableWallpaperID("waifuim", fmt.Sprint(image.ID), image.URL),
		URL:         image.URL,
		PreviewURL:  image.URL,
		Source:      "waifu.im",
		Author:      author,
		SourceURL:   firstWallpaperValue(image.Source, "https://www.waifu.im/"),
		LicenseNote: "Waifu.im Terms of Service",
		Kind:        "api",
		Status:      "active",
		AddedAt:     now,
	}, true
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

func drawAPIWallpaperItem(db *sql.DB) (wallpaperItem, error) {
	row := db.QueryRow(
		`SELECT id, url, preview_url, source, author, source_url, license_note, kind, status, added_at
		 FROM wallpaper_pool
		 WHERE status='active' AND kind='api'
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

func fallbackWallpaperItem() wallpaperItem {
	item := fallbackWallpaperItems[rand.Intn(len(fallbackWallpaperItems))]
	item.AddedAt = time.Now().UTC()
	return item
}

func apiFallbackWallpaperItem() wallpaperItem {
	seed := time.Now().UTC().Format("20060102150405")
	return wallpaperItem{
		ID:          "external-api-placeholder-" + seed,
		URL:         "https://picsum.photos/seed/taozhiyy-" + seed + "/1920/1080",
		PreviewURL:  "https://picsum.photos/seed/taozhiyy-" + seed + "/960/540",
		Source:      "external-api-placeholder",
		Author:      "Lorem Picsum",
		SourceURL:   "https://picsum.photos/",
		LicenseNote: "External API placeholder; configure PEXELS_API_KEY or PIXABAY_API_KEY for licensed provider images.",
		Kind:        "api",
		Status:      "active",
		AddedAt:     time.Now().UTC(),
	}
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
