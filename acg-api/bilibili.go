package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const biliUA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

type BiliClient struct {
	http *http.Client
	cfg  AppConfig
}

func NewBiliClient(cfg AppConfig) *BiliClient {
	return &BiliClient{
		http: &http.Client{Timeout: 25 * time.Second},
		cfg:  cfg,
	}
}

func (c *BiliClient) FetchBangumi(page, pageSize int) ([]bangumiItem, error) {
	q := url.Values{}
	q.Set("vmid", c.cfg.BilibiliUID)
	q.Set("type", "1")
	q.Set("follow_status", "0")
	q.Set("pn", strconv.Itoa(page))
	q.Set("ps", strconv.Itoa(pageSize))
	req, _ := http.NewRequest(http.MethodGet, "https://api.bilibili.com/x/space/bangumi/follow/list?"+q.Encode(), nil)
	req.Header.Set("User-Agent", biliUA)
	req.Header.Set("Referer", "https://space.bilibili.com/"+c.cfg.BilibiliUID)
	res, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	var payload struct {
		Code int `json:"code"`
		Data struct {
			List []struct {
				SeasonID    int    `json:"season_id"`
				Title       string `json:"title"`
				Cover       string `json:"cover"`
				TotalCount  int    `json:"total_count"`
				FormalCount int    `json:"formal_ep_count"`
				Progress    string `json:"progress"`
				NewEP       struct {
					Title      string `json:"title"`
					IndexShow  string `json:"index_show"`
					LongTitle  string `json:"long_title"`
				} `json:"new_ep"`
				URL string `json:"url"`
			} `json:"list"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}
	if payload.Code != 0 {
		return nil, fmt.Errorf("bangumi api code=%d", payload.Code)
	}
	var out []bangumiItem
	for _, row := range payload.Data.List {
		total := row.TotalCount
		if total == 0 {
			total = row.FormalCount
		}
		watched := parseProgressWatched(row.Progress)
		latest := parseEpisodeNum(row.NewEP.Title, row.NewEP.IndexShow)
		id := fmt.Sprintf("s%d", row.SeasonID)
		out = append(out, bangumiItem{
			ID:            id,
			Title:         row.Title,
			Watched:       watched,
			Total:         total,
			LatestEpisode: latest,
			CoverURL:      row.Cover,
			LinkURL:       row.URL,
		})
	}
	return out, nil
}

var digitsRe = regexp.MustCompile(`\d+`)

func parseProgressWatched(progress string) int {
	if progress == "" {
		return 0
	}
	m := digitsRe.FindAllString(progress, -1)
	if len(m) == 0 {
		return 0
	}
	n, _ := strconv.Atoi(m[0])
	return n
}

func parseEpisodeNum(parts ...string) int {
	for _, p := range parts {
		m := digitsRe.FindAllString(p, -1)
		if len(m) > 0 {
			n, _ := strconv.Atoi(m[len(m)-1])
			if n > 0 {
				return n
			}
		}
	}
	return 0
}

type latestVideo struct {
	Title     string
	Pic       string
	Created   int64
	LinkURL   string
}

func (c *BiliClient) FetchLatestVideo(mid string) (*latestVideo, error) {
	img, sub, err := getWBIKeys(c.http)
	if err != nil {
		return nil, err
	}
	params := signWBI(map[string]string{
		"mid":    mid,
		"pn":     "1",
		"ps":     "1",
		"order":  "pubdate",
	}, img, sub)
	q := url.Values{}
	for k, v := range params {
		q.Set(k, v)
	}
	apiURL := "https://api.bilibili.com/x/space/wbi/arc/search?" + q.Encode()
	req, _ := http.NewRequest(http.MethodGet, apiURL, nil)
	req.Header.Set("User-Agent", biliUA)
	req.Header.Set("Referer", "https://space.bilibili.com/"+mid)
	res, err := c.http.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	body, _ := io.ReadAll(res.Body)
	var payload struct {
		Code int `json:"code"`
		Data struct {
			List struct {
				VList []struct {
					Title   string `json:"title"`
					Pic     string `json:"pic"`
					Created int64  `json:"created"`
					Bvid    string `json:"bvid"`
				} `json:"vlist"`
			} `json:"list"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}
	if payload.Code != 0 {
		return nil, fmt.Errorf("arc search code=%d", payload.Code)
	}
	if len(payload.Data.List.VList) == 0 {
		return nil, fmt.Errorf("no videos")
	}
	v := payload.Data.List.VList[0]
	link := "https://www.bilibili.com/video/" + v.Bvid
	if v.Bvid == "" {
		link = "https://space.bilibili.com/" + mid
	}
	return &latestVideo{
		Title:   v.Title,
		Pic:     strings.Replace(v.Pic, "http://", "https://", 1),
		Created: v.Created,
		LinkURL: link,
	}, nil
}
