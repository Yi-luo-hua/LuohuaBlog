package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestFirstCommitLineKeepsOnlyTheSubject(t *testing.T) {
	got := firstCommitLine("feat: add card\n\nlong body that should never reach the card")
	if got != "feat: add card" {
		t.Fatalf("want subject only, got %q", got)
	}
	if firstCommitLine("  spaced  \r\nbody") != "spaced" {
		t.Fatal("want trimmed subject")
	}
	long := strings.Repeat("字", 200)
	if len([]rune(firstCommitLine(long))) != 120 {
		t.Fatal("want the subject capped at 120 runes")
	}
}

// stubGithub serves the two endpoints the sync walks: the public event feed
// (used only to discover repositories) and each repository's commit list.
func stubGithub(t *testing.T, commitsByRepo map[string]string, fail map[string]bool) (*httptest.Server, *[]string) {
	t.Helper()
	seen := []string{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = append(seen, r.URL.Path)
		if fail[r.URL.Path] {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.URL.Path == "/users/Yi-luo-hua/events/public":
			_, _ = w.Write([]byte(`[
				{"type":"PushEvent","repo":{"name":"me/alpha"}},
				{"type":"WatchEvent","repo":{"name":"me/ignored"}},
				{"type":"PushEvent","repo":{"name":"me/alpha"}},
				{"type":"PullRequestEvent","repo":{"name":"org/beta"}}
			]`))
		case strings.HasSuffix(r.URL.Path, "/commits"):
			repo := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/repos/"), "/commits")
			if body, ok := commitsByRepo[repo]; ok {
				_, _ = w.Write([]byte(body))
				return
			}
			_, _ = w.Write([]byte(`[]`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	t.Cleanup(server.Close)
	return server, &seen
}

func TestFetchRecentCommitsReadsRepositoriesNotTheSearchIndex(t *testing.T) {
	// GitHub's commit search index is missing whole repositories, so the sync
	// must never depend on it.
	server, seen := stubGithub(t, map[string]string{
		"me/alpha": `[{"sha":"a1","html_url":"u1","commit":{"message":"feat: newest\nbody","author":{"date":"2026-08-24T05:02:41Z"}}},
		              {"sha":"","commit":{"message":"blank"}}]`,
		"org/beta": `[{"sha":"b1","html_url":"u2","commit":{"message":"fix: older","author":{"date":"2026-08-01T00:00:00Z"}}}]`,
	}, nil)

	client := NewGithubClient(AppConfig{
		GithubLogin: "Yi-luo-hua", GithubToken: "t0ken", GithubAPIBaseURL: server.URL,
	})
	commits, repoCount, err := client.FetchRecentCommits()
	if err != nil {
		t.Fatal(err)
	}
	for _, path := range *seen {
		if strings.Contains(path, "search") {
			t.Fatalf("the search index must not be used, hit %q", path)
		}
	}
	if repoCount != 2 {
		t.Fatalf("want 2 repos, got %d", repoCount)
	}
	// Newest first across repositories, and the sha-less entry is dropped.
	if len(commits) != 2 || commits[0].SHA != "a1" || commits[1].SHA != "b1" {
		t.Fatalf("unexpected commits %+v", commits)
	}
	if commits[0].Message != "feat: newest" || commits[0].Repo != "me/alpha" {
		t.Fatalf("unexpected first commit %+v", commits[0])
	}
}

func TestFetchRecentCommitsSurvivesOneBadRepository(t *testing.T) {
	server, _ := stubGithub(t, map[string]string{
		"org/beta": `[{"sha":"b1","html_url":"u","commit":{"message":"fix: still here","author":{"date":"2026-08-01T00:00:00Z"}}}]`,
	}, map[string]bool{"/repos/me/alpha/commits": true})

	client := NewGithubClient(AppConfig{GithubLogin: "Yi-luo-hua", GithubAPIBaseURL: server.URL})
	commits, repoCount, err := client.FetchRecentCommits()
	if err != nil {
		t.Fatal("one unreadable repo must not fail the whole card:", err)
	}
	if len(commits) != 1 || repoCount != 1 {
		t.Fatalf("want the surviving repo only, got %d commits / %d repos", len(commits), repoCount)
	}
}

func TestFetchRecentCommitsFallsBackToOwnedRepos(t *testing.T) {
	// A quiet stretch empties the 90-day event feed; owned repos keep the card alive.
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/users/Yi-luo-hua/events/public":
			_, _ = w.Write([]byte(`[]`))
		case "/users/Yi-luo-hua/repos":
			_, _ = w.Write([]byte(`[{"full_name":"me/forked","fork":true},{"full_name":"me/own","fork":false}]`))
		case "/repos/me/own/commits":
			_, _ = w.Write([]byte(`[{"sha":"c1","html_url":"u","commit":{"message":"chore: quiet","author":{"date":"2026-05-01T00:00:00Z"}}}]`))
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer server.Close()

	client := NewGithubClient(AppConfig{GithubLogin: "Yi-luo-hua", GithubAPIBaseURL: server.URL})
	commits, _, err := client.FetchRecentCommits()
	if err != nil {
		t.Fatal(err)
	}
	// Forks are skipped: they carry somebody else's history.
	if len(commits) != 1 || commits[0].Repo != "me/own" {
		t.Fatalf("unexpected commits %+v", commits)
	}
}

func TestCommitsInRepoRequestsOnlyThisAuthor(t *testing.T) {
	var gotAuthor, gotAuth string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuthor = r.URL.Query().Get("author")
		gotAuth = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode([]any{})
	}))
	defer server.Close()

	client := NewGithubClient(AppConfig{GithubLogin: "Yi-luo-hua", GithubToken: "tk", GithubAPIBaseURL: server.URL})
	if _, err := client.commitsInRepo("me/alpha"); err != nil {
		t.Fatal(err)
	}
	// Without this filter the card would show the template author's commits too.
	if gotAuthor != "Yi-luo-hua" {
		t.Fatalf("commits must be filtered to the owner, got author=%q", gotAuthor)
	}
	if gotAuth != "Bearer tk" {
		t.Fatalf("token must be sent to lift the rate limit, got %q", gotAuth)
	}
}

func TestGithubClientStaysOffWithoutALogin(t *testing.T) {
	client := NewGithubClient(AppConfig{GithubAPIBaseURL: "https://api.github.com"})
	if client.enabled() {
		t.Fatal("no login means the sync must stay off")
	}
	if _, _, err := client.FetchRecentCommits(); err == nil {
		t.Fatal("want an error instead of an unconfigured request")
	}
}
