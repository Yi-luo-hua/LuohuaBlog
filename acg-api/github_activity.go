package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
)

// Why not the obvious endpoints:
//
//   - /users/{login}/events/public strips the commit list out of PushEvent
//     payloads, so it carries no commit messages at all.
//   - /search/commits has the messages but its index is missing whole
//     repositories (this site's own repo returned 0 results for commits that
//     plainly existed), it returns sporadic 504s, and it allows only 10
//     requests/hour unauthenticated.
//
// So events are used purely to discover which repositories were pushed to
// recently, and the commits themselves are read straight from each repository.
// That path is never stale, and it bills against the core rate limit
// (60/hour unauthenticated, 5000/hour with a token) instead of the search one.
const (
	githubEventsPath      = "/users/%s/events/public"
	githubRepoCommitsPath = "/repos/%s/commits"
	githubUserReposPath   = "/users/%s/repos"
	githubRepoScanLimit   = 6
	githubPerRepoCommits  = 5
	githubCommitKeep      = 12
	githubUserAgent       = "taozhiyy-site/1.0"
)

type githubCommit struct {
	SHA         string `json:"sha"`
	Repo        string `json:"repo"`
	Message     string `json:"message"`
	URL         string `json:"url"`
	CommittedAt string `json:"committedAt"`
}

type githubEvent struct {
	Type string `json:"type"`
	Repo struct {
		Name string `json:"name"`
	} `json:"repo"`
}

type githubRepoSummary struct {
	FullName string `json:"full_name"`
	Fork     bool   `json:"fork"`
}

type githubRepoCommit struct {
	SHA     string `json:"sha"`
	HTMLURL string `json:"html_url"`
	Commit  struct {
		Message string `json:"message"`
		Author  struct {
			Date string `json:"date"`
		} `json:"author"`
	} `json:"commit"`
}

type GithubClient struct {
	login   string
	token   string
	baseURL string
	client  *http.Client
}

func NewGithubClient(cfg AppConfig) *GithubClient {
	return &GithubClient{
		login:   strings.TrimSpace(cfg.GithubLogin),
		token:   strings.TrimSpace(cfg.GithubToken),
		baseURL: strings.TrimRight(cfg.GithubAPIBaseURL, "/"),
		client:  &http.Client{Timeout: 20 * time.Second},
	}
}

func (c *GithubClient) enabled() bool { return c.login != "" }

func (c *GithubClient) getJSON(path string, dst any) error {
	req, err := http.NewRequest(http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("User-Agent", githubUserAgent)
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	res, err := c.client.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return fmt.Errorf("github %s returned %d (rate limit remaining %s)",
			path, res.StatusCode, res.Header.Get("X-RateLimit-Remaining"))
	}
	return json.NewDecoder(res.Body).Decode(dst)
}

// recentRepos lists the repositories this account touched most recently, newest
// first. Pull-request events matter as much as pushes: work contributed to an
// upstream repository lands there, while the local fork's default branch stays
// empty and would otherwise look like no activity at all.
func (c *GithubClient) recentRepos() ([]string, error) {
	var events []githubEvent
	if err := c.getJSON(fmt.Sprintf(githubEventsPath, url.PathEscape(c.login))+"?per_page=100", &events); err != nil {
		return nil, err
	}

	seen := map[string]bool{}
	repos := []string{}
	for _, event := range events {
		if event.Type != "PushEvent" && event.Type != "PullRequestEvent" {
			continue
		}
		if event.Repo.Name == "" || seen[event.Repo.Name] {
			continue
		}
		seen[event.Repo.Name] = true
		repos = append(repos, event.Repo.Name)
		if len(repos) >= githubRepoScanLimit {
			break
		}
	}
	if len(repos) > 0 {
		return repos, nil
	}

	// The events feed only reaches back about 90 days. Fall back to the most
	// recently pushed owned repositories so a quiet stretch does not empty the card.
	var owned []githubRepoSummary
	if err := c.getJSON(fmt.Sprintf(githubUserReposPath, url.PathEscape(c.login))+"?sort=pushed&per_page=10", &owned); err != nil {
		return nil, err
	}
	for _, repo := range owned {
		if repo.Fork || repo.FullName == "" {
			continue
		}
		repos = append(repos, repo.FullName)
		if len(repos) >= githubRepoScanLimit {
			break
		}
	}
	return repos, nil
}

func (c *GithubClient) commitsInRepo(repo string) ([]githubCommit, error) {
	query := url.Values{}
	query.Set("author", c.login)
	query.Set("per_page", fmt.Sprint(githubPerRepoCommits))
	path := fmt.Sprintf(githubRepoCommitsPath, repo) + "?" + query.Encode()

	var raw []githubRepoCommit
	if err := c.getJSON(path, &raw); err != nil {
		return nil, err
	}

	commits := make([]githubCommit, 0, len(raw))
	for _, item := range raw {
		if strings.TrimSpace(item.SHA) == "" {
			continue
		}
		commits = append(commits, githubCommit{
			SHA:         item.SHA,
			Repo:        repo,
			Message:     firstCommitLine(item.Commit.Message),
			URL:         item.HTMLURL,
			CommittedAt: item.Commit.Author.Date,
		})
	}
	return commits, nil
}

// FetchRecentCommits returns the newest commits this account authored, together
// with how many repositories they span.
func (c *GithubClient) FetchRecentCommits() ([]githubCommit, int, error) {
	if !c.enabled() {
		return nil, 0, errors.New("github login not configured")
	}

	repos, err := c.recentRepos()
	if err != nil {
		return nil, 0, err
	}
	if len(repos) == 0 {
		return nil, 0, errors.New("github: no recent repositories found")
	}

	collected := []githubCommit{}
	for _, repo := range repos {
		commits, err := c.commitsInRepo(repo)
		if err != nil {
			// One unreadable repository must not cost us the whole card.
			log.Println("sync: github repo", repo, err)
			continue
		}
		collected = append(collected, commits...)
	}
	if len(collected) == 0 {
		return nil, 0, errors.New("github: no commits found in recent repositories")
	}

	sort.SliceStable(collected, func(i, j int) bool {
		return collected[i].CommittedAt > collected[j].CommittedAt
	})

	seen := map[string]bool{}
	unique := make([]githubCommit, 0, githubCommitKeep)
	repoNames := map[string]bool{}
	for _, commit := range collected {
		if seen[commit.SHA] {
			continue
		}
		seen[commit.SHA] = true
		unique = append(unique, commit)
		repoNames[commit.Repo] = true
		if len(unique) >= githubCommitKeep {
			break
		}
	}
	return unique, len(repoNames), nil
}

// firstCommitLine keeps the subject line only; commit bodies are far too long
// for a card this narrow.
func firstCommitLine(message string) string {
	line := message
	if idx := strings.IndexAny(message, "\r\n"); idx >= 0 {
		line = message[:idx]
	}
	line = strings.TrimSpace(line)
	if len([]rune(line)) > 120 {
		line = string([]rune(line)[:120])
	}
	return line
}

func runGithubCommitSync(githubClient *GithubClient) {
	if !githubClient.enabled() {
		return
	}
	log.Println("sync: github commits start")
	commits, repoCount, err := githubClient.FetchRecentCommits()
	if err != nil {
		// The previous cache stays in place so the card keeps rendering.
		log.Println("sync: github commits fetch error:", err)
		return
	}
	if err := replaceGithubCommits(db, commits, repoCount); err != nil {
		log.Println("sync: github commits db error:", err)
		return
	}
	log.Printf("sync: github commits done (%d items across %d repos)\n", len(commits), repoCount)
}

func githubCommitsHandler(cfg AppConfig) http.HandlerFunc {
	profile := ""
	if login := strings.TrimSpace(cfg.GithubLogin); login != "" {
		profile = "https://github.com/" + login
	}
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			methodNotAllowed(w)
			return
		}
		commits, repoCount, syncedAt, err := listGithubCommits(db)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		writeJSON(w, map[string]any{
			"items":     commits,
			"repoCount": repoCount,
			"syncedAt":  syncedAt,
			"profile":   profile,
		})
	}
}
