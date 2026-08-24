package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const bangumiUA = "Yi-luo-hua-Blog/1.0 (https://github.com/Yi-luo-hua/LuohuaBlog)"

type BangumiClient struct {
	httpClient *http.Client
	baseURL    string
	token      string
	username   string
}

type bangumiUser struct {
	Username string `json:"username"`
}

type bangumiCollectionPage struct {
	Total  int                     `json:"total"`
	Limit  int                     `json:"limit"`
	Offset int                     `json:"offset"`
	Data   []bangumiUserCollection `json:"data"`
}

type bangumiUserCollection struct {
	SubjectID int                `json:"subject_id"`
	EpStatus  int                `json:"ep_status"`
	Rate      int                `json:"rate"`
	UpdatedAt string             `json:"updated_at"`
	Subject   bangumiSlimSubject `json:"subject"`
}

type bangumiSlimSubject struct {
	ID           int           `json:"id"`
	Name         string        `json:"name"`
	NameCN       string        `json:"name_cn"`
	ShortSummary string        `json:"short_summary"`
	Date         string        `json:"date"`
	Eps          int           `json:"eps"`
	Score        float64       `json:"score"`
	Rank         int           `json:"rank"`
	Tags         []bangumiTag  `json:"tags"`
	Images       bangumiImages `json:"images"`
}

type bangumiTag struct {
	Name string `json:"name"`
}

type bangumiImages struct {
	Large  string `json:"large"`
	Common string `json:"common"`
	Medium string `json:"medium"`
	Small  string `json:"small"`
	Grid   string `json:"grid"`
}

func NewBangumiClient(cfg AppConfig) *BangumiClient {
	return &BangumiClient{
		httpClient: &http.Client{Timeout: bangumiHTTPTimeout()},
		baseURL:    strings.TrimRight(cfg.BangumiAPIBaseURL, "/"),
		token:      strings.TrimSpace(cfg.BangumiAccessToken),
		username:   strings.TrimSpace(cfg.BangumiUsername),
	}
}

func bangumiHTTPTimeout() time.Duration {
	seconds, err := strconv.Atoi(env("BANGUMI_TIMEOUT_SECONDS", "15"))
	if err != nil || seconds < 1 || seconds > 120 {
		seconds = 15
	}
	return time.Duration(seconds) * time.Second
}

const (
	bangumiCollectionWish     = 1
	bangumiCollectionWatched  = 2
	bangumiCollectionWatching = 3
)

// FetchWatching returns the shelf owner's anime collections marked as
// "doing" (subject_type=2, collection type=3).
func (c *BangumiClient) FetchWatching() ([]bangumiItem, error) {
	username, err := c.resolveUsername()
	if err != nil {
		return nil, err
	}
	return c.fetchCollectionsForUser(username, bangumiCollectionWatching)
}

// FetchLibrary returns the three collections displayed by the site.
func (c *BangumiClient) FetchLibrary() ([]bangumiItem, error) {
	username, err := c.resolveUsername()
	if err != nil {
		return nil, err
	}

	items := make([]bangumiItem, 0, 100)
	for _, collectionType := range []int{
		bangumiCollectionWatching,
		bangumiCollectionWatched,
		bangumiCollectionWish,
	} {
		collectionItems, err := c.fetchCollectionsForUser(username, collectionType)
		if err != nil {
			return nil, err
		}
		items = append(items, collectionItems...)
	}
	return items, nil
}

// resolveUsername decides whose shelf to read.
//
// A collection listing is public on Bangumi, so displaying somebody's shelf
// needs no credentials at all — only their username. The access token was
// required for one reason: /v0/me was the only way the server learned which
// username to ask for. Naming the account outright in BANGUMI_USERNAME skips
// that lookup, which means the shelf works on a deployment that holds no
// secrets. A token is still honoured when present, since it is what makes
// collections marked private visible.
func (c *BangumiClient) resolveUsername() (string, error) {
	if c == nil {
		return "", errors.New("Bangumi client is not configured")
	}
	if c.baseURL == "" {
		return "", errors.New("Bangumi API base URL is empty")
	}
	if c.username != "" {
		return c.username, nil
	}
	return c.currentUsername()
}

func (c *BangumiClient) currentUsername() (string, error) {
	if c == nil || c.token == "" {
		return "", errors.New("set BANGUMI_USERNAME, or BANGUMI_ACCESS_TOKEN to look it up")
	}
	if c.baseURL == "" {
		return "", errors.New("Bangumi API base URL is empty")
	}

	var me bangumiUser
	if err := c.getJSON("/v0/me", &me); err != nil {
		return "", fmt.Errorf("fetch current Bangumi user: %w", err)
	}
	if strings.TrimSpace(me.Username) == "" {
		return "", errors.New("Bangumi API returned an empty username")
	}
	return me.Username, nil
}

func (c *BangumiClient) fetchCollectionsForUser(username string, collectionType int) ([]bangumiItem, error) {
	const pageSize = 50
	items := make([]bangumiItem, 0, pageSize)
	for offset := 0; ; offset += pageSize {
		path := fmt.Sprintf(
			"/v0/users/%s/collections?subject_type=2&type=%d&limit=%d&offset=%d",
			url.PathEscape(username),
			collectionType,
			pageSize,
			offset,
		)
		var page bangumiCollectionPage
		if err := c.getJSON(path, &page); err != nil {
			return nil, fmt.Errorf("fetch Bangumi watching collections: %w", err)
		}

		for _, collection := range page.Data {
			subject := collection.Subject
			if subject.ID == 0 {
				subject.ID = collection.SubjectID
			}
			if subject.ID == 0 {
				continue
			}
			title := strings.TrimSpace(subject.NameCN)
			if title == "" {
				title = strings.TrimSpace(subject.Name)
			}
			if title == "" {
				title = "未命名番剧"
			}
			tags := make([]string, 0, 6)
			for _, tag := range subject.Tags {
				if name := strings.TrimSpace(tag.Name); name != "" {
					tags = append(tags, name)
				}
				if len(tags) == 6 {
					break
				}
			}

			items = append(items, bangumiItem{
				ID:             strconv.Itoa(subject.ID),
				Title:          title,
				OriginalTitle:  strings.TrimSpace(subject.Name),
				Summary:        strings.TrimSpace(subject.ShortSummary),
				AirDate:        strings.TrimSpace(subject.Date),
				Tags:           tags,
				CollectionType: collectionType,
				Watched:        collection.EpStatus,
				Total:          subject.Eps,
				LatestEpisode:  subject.Eps,
				Score:          subject.Score,
				MyRating:       collection.Rate,
				Rank:           subject.Rank,
				CoverURL:       firstBangumiImage(subject.Images.Large, subject.Images.Common, subject.Images.Medium, subject.Images.Small, subject.Images.Grid),
				LinkURL:        fmt.Sprintf("https://bgm.tv/subject/%d", subject.ID),
				UpdatedAt:      collection.UpdatedAt,
			})
		}

		if len(page.Data) < pageSize || offset+len(page.Data) >= page.Total {
			break
		}
	}

	return items, nil
}

func (c *BangumiClient) getJSON(path string, dst any) error {
	req, err := http.NewRequest(http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	// Anonymous reads are the normal case now, and Bangumi rejects an
	// Authorization header carrying an empty bearer token.
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	req.Header.Set("User-Agent", bangumiUA)

	res, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode < 200 || res.StatusCode >= 300 {
		return fmt.Errorf("Bangumi API returned HTTP %d", res.StatusCode)
	}
	if err := json.NewDecoder(res.Body).Decode(dst); err != nil {
		return fmt.Errorf("decode Bangumi response: %w", err)
	}
	return nil
}

func firstBangumiImage(values ...string) string {
	for _, value := range values {
		if value = strings.TrimSpace(value); value != "" {
			return value
		}
	}
	return ""
}
