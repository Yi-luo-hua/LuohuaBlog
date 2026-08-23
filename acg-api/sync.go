package main

import (
	"database/sql"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

var downloadSem = make(chan struct{}, 2)

type bangumiItem struct {
	ID             string   `json:"id"`
	Title          string   `json:"title"`
	OriginalTitle  string   `json:"originalTitle,omitempty"`
	Summary        string   `json:"summary,omitempty"`
	AirDate        string   `json:"airDate,omitempty"`
	Tags           []string `json:"tags,omitempty"`
	CollectionType int      `json:"collectionType"`
	Watched        int      `json:"watched"`
	Total          int      `json:"total"`
	LatestEpisode  int      `json:"latestEpisode"`
	Score          float64  `json:"score,omitempty"`
	MyRating       int      `json:"myRating,omitempty"`
	Rank           int      `json:"rank,omitempty"`
	CoverURL       string   `json:"coverUrl,omitempty"`
	CoverPath      string   `json:"-"`
	LinkURL        string   `json:"linkUrl,omitempty"`
	UpdatedAt      string   `json:"updatedAt,omitempty"`
}

type radarItem struct {
	ID          string `json:"id"`
	UpUID       string `json:"-"`
	CreatorName string `json:"creatorName"`
	LatestText  string `json:"latestText"`
	IsNew       bool   `json:"isNew"`
	LinkURL     string `json:"linkUrl,omitempty"`
	CoverURL    string `json:"coverUrl,omitempty"`
	CoverPath   string `json:"-"`
	PublishedAt string `json:"-"`
}

func startSyncLoops(db *sql.DB, cfg AppConfig, cacheDir string) {
	bangumi := NewBangumiClient(cfg)

	go func() {
		runSyncJob("bangumi", func() {
			runBangumiSync(db, bangumi, cacheDir)
		})
		t := time.NewTicker(1 * time.Hour)
		for range t.C {
			runSyncJob("bangumi", func() {
				runBangumiSync(db, bangumi, cacheDir)
			})
		}
	}()
}

func runSyncJob(name string, run func()) {
	if !tryRunSyncJob(run) {
		log.Printf("sync: %s skipped; another sync is running", name)
	}
}

func runBangumiSync(db *sql.DB, bangumi *BangumiClient, cacheDir string) {
	log.Println("sync: bangumi start")
	items, err := bangumi.FetchLibrary()
	if err != nil {
		log.Println("sync: bangumi fetch error:", err)
		return
	}
	var covers sync.WaitGroup
	for i := range items {
		if items[i].CoverURL == "" {
			continue
		}
		fname := "bangumi_" + items[i].ID + ".jpg"
		dest := filepath.Join(cacheDir, fname)
		if info, statErr := os.Stat(dest); statErr == nil && info.Size() > 0 {
			items[i].CoverPath = fname
			continue
		}
		covers.Add(1)
		go func(index int, fileName, destination string) {
			defer covers.Done()
			if err := downloadToCacheWithHeaders(items[index].CoverURL, destination, bangumiUA, "https://bgm.tv/"); err != nil {
				log.Println("sync: cover", items[index].ID, err)
				return
			}
			items[index].CoverPath = fileName
		}(i, fname, dest)
	}
	covers.Wait()
	if err := replaceBangumiItems(db, items); err != nil {
		log.Println("sync: bangumi db error:", err)
		return
	}
	log.Printf("sync: bangumi done (%d items)\n", len(items))
}

func runRadarSync(db *sql.DB, bili *BiliClient, cfg AppConfig, cacheDir string) {
	log.Println("sync: radar start")
	now := time.Now()
	synced := 0
	for _, creator := range cfg.RadarCreators {
		vid, err := bili.FetchLatestVideo(creator.UID)
		if err != nil {
			log.Println("sync: radar", creator.Name, err)
			continue
		}
		published := time.Unix(vid.Created, 0)
		isNew := now.Sub(published) <= 24*time.Hour
		coverFile := ""
		if vid.Pic != "" {
			coverFile = "radar_" + creator.UID + ".jpg"
			_ = downloadToCache(vid.Pic, filepath.Join(cacheDir, coverFile))
		}
		item := radarItem{
			ID:          "r_" + creator.UID,
			UpUID:       creator.UID,
			CreatorName: "UP · " + creator.Name,
			LatestText:  vid.Title,
			IsNew:       isNew,
			LinkURL:     vid.LinkURL,
			CoverPath:   coverFile,
			PublishedAt: published.UTC().Format(time.RFC3339),
		}
		if err := upsertRadarFeed(db, item); err != nil {
			log.Println("sync: radar db", creator.Name, err)
			continue
		}
		synced++
	}
	if synced > 0 {
		_, _ = db.Exec(`DELETE FROM radar_feed WHERE id LIKE 'seed_%'`)
	}
	log.Println("sync: radar done")
}

func downloadToCache(remoteURL, dest string) error {
	return downloadToCacheWithHeaders(remoteURL, dest, biliUA, "https://www.bilibili.com")
}

func downloadToCacheWithHeaders(remoteURL, dest, userAgent, referer string) error {
	if remoteURL == "" {
		return fmt.Errorf("empty url")
	}
	downloadSem <- struct{}{}
	defer func() { <-downloadSem }()

	req, err := http.NewRequest(http.MethodGet, remoteURL, nil)
	if err != nil {
		return err
	}
	req.Header.Set("User-Agent", userAgent)
	if referer != "" {
		req.Header.Set("Referer", referer)
	}
	client := &http.Client{Timeout: biliHTTPTimeout()}
	res, err := client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("http %d", res.StatusCode)
	}
	tmp := dest + ".part"
	f, err := os.Create(tmp)
	if err != nil {
		return err
	}
	_, err = io.Copy(f, res.Body)
	closeErr := f.Close()
	if err != nil {
		_ = os.Remove(tmp)
		return err
	}
	if closeErr != nil {
		_ = os.Remove(tmp)
		return closeErr
	}
	return os.Rename(tmp, dest)
}

func cleanupCache(cacheDir string, maxAge time.Duration) {
	entries, err := os.ReadDir(cacheDir)
	if err != nil {
		return
	}
	cutoff := time.Now().Add(-maxAge)
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		info, err := e.Info()
		if err != nil {
			continue
		}
		if info.ModTime().Before(cutoff) {
			_ = os.Remove(filepath.Join(cacheDir, e.Name()))
		}
	}
}

func safeImageName(name string) bool {
	if name == "" || strings.Contains(name, "..") {
		return false
	}
	for _, r := range name {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '_' || r == '-' || r == '.' {
			continue
		}
		return false
	}
	return true
}
