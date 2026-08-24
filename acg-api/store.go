package main

import (
	"database/sql"
	"encoding/json"
	"time"
)

func migrateAll(db *sql.DB) error {
	stmts := []string{
		`CREATE TABLE IF NOT EXISTS guestbook (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			content TEXT NOT NULL,
			created_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_guestbook_created ON guestbook(created_at DESC);`,
		`CREATE TABLE IF NOT EXISTS guestbook_messages (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER,
			nickname TEXT NOT NULL,
			avatar TEXT NOT NULL DEFAULT '',
			channel TEXT NOT NULL DEFAULT 'guestbook',
			content TEXT NOT NULL,
			contact_email TEXT NOT NULL DEFAULT '',
			content_hash TEXT NOT NULL DEFAULT '',
			ip_hash TEXT NOT NULL,
			ip_region TEXT NOT NULL DEFAULT '',
			ip_masked TEXT NOT NULL DEFAULT '',
			user_agent_hash TEXT NOT NULL DEFAULT '',
			parent_id INTEGER NOT NULL DEFAULT 0,
			status TEXT NOT NULL DEFAULT 'visible',
			owner_read_at TEXT NOT NULL DEFAULT '',
			is_login_user INTEGER NOT NULL DEFAULT 0,
			is_admin_user INTEGER NOT NULL DEFAULT 0,
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_guestbook_messages_status_created ON guestbook_messages(status, created_at DESC);`,
		`CREATE INDEX IF NOT EXISTS idx_guestbook_messages_user_created ON guestbook_messages(user_id, created_at DESC);`,
		`CREATE TABLE IF NOT EXISTS guestbook_ip_cache (
			ip_hash TEXT PRIMARY KEY,
			ip_region TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS bangumi_items (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			original_title TEXT NOT NULL DEFAULT '',
			summary TEXT NOT NULL DEFAULT '',
			air_date TEXT NOT NULL DEFAULT '',
			tags_json TEXT NOT NULL DEFAULT '[]',
			collection_type INTEGER NOT NULL DEFAULT 3,
			watched INTEGER NOT NULL DEFAULT 0,
			total INTEGER NOT NULL DEFAULT 0,
			latest_episode INTEGER NOT NULL DEFAULT 0,
			score REAL NOT NULL DEFAULT 0,
			my_rating INTEGER NOT NULL DEFAULT 0,
			rank INTEGER NOT NULL DEFAULT 0,
			cover_url TEXT NOT NULL DEFAULT '',
			cover_path TEXT,
			link_url TEXT,
			collection_updated_at TEXT NOT NULL DEFAULT '',
			updated_at TEXT NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS github_commits (
			sha TEXT PRIMARY KEY,
			repo TEXT NOT NULL DEFAULT '',
			message TEXT NOT NULL DEFAULT '',
			url TEXT NOT NULL DEFAULT '',
			committed_at TEXT NOT NULL DEFAULT '',
			position INTEGER NOT NULL DEFAULT 0,
			repo_count INTEGER NOT NULL DEFAULT 0,
			updated_at TEXT NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS ai_chat_quota (
			identity_key TEXT NOT NULL,
			quota_date TEXT NOT NULL,
			used INTEGER NOT NULL DEFAULT 0,
			last_request_at TEXT,
			PRIMARY KEY (identity_key, quota_date)
		);`,
		`CREATE TABLE IF NOT EXISTS ai_chat_hourly (
			bucket TEXT PRIMARY KEY,
			success INTEGER NOT NULL DEFAULT 0,
			upstream_error INTEGER NOT NULL DEFAULT 0,
			quota_denied INTEGER NOT NULL DEFAULT 0,
			rate_denied INTEGER NOT NULL DEFAULT 0,
			not_configured INTEGER NOT NULL DEFAULT 0,
			guest_calls INTEGER NOT NULL DEFAULT 0,
			user_calls INTEGER NOT NULL DEFAULT 0,
			owner_calls INTEGER NOT NULL DEFAULT 0,
			owner_tokens INTEGER NOT NULL DEFAULT 0
		);`,
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			email TEXT NOT NULL UNIQUE,
			display_name TEXT NOT NULL DEFAULT '',
			password_hash TEXT NOT NULL,
			created_at TEXT NOT NULL,
			is_owner INTEGER NOT NULL DEFAULT 0
		);`,
		`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
		`CREATE TABLE IF NOT EXISTS sessions (
			id TEXT PRIMARY KEY,
			user_id INTEGER NOT NULL,
			expires_at TEXT NOT NULL,
			unlimited INTEGER NOT NULL DEFAULT 0,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		);`,
		`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);`,
		`CREATE TABLE IF NOT EXISTS login_challenges (
			id TEXT PRIMARY KEY,
			user_id INTEGER NOT NULL,
			expires_at TEXT NOT NULL,
			FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
		);`,
		`CREATE TABLE IF NOT EXISTS owner_drafts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			kind TEXT NOT NULL DEFAULT 'article',
			title TEXT NOT NULL,
			body TEXT NOT NULL DEFAULT '',
			cover_url TEXT NOT NULL DEFAULT '',
			status TEXT NOT NULL DEFAULT 'draft',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_owner_drafts_updated ON owner_drafts(updated_at DESC, id DESC);`,
		`CREATE TABLE IF NOT EXISTS security_audit_logs (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			event TEXT NOT NULL,
			outcome TEXT NOT NULL,
			actor_user_id INTEGER NOT NULL DEFAULT 0,
			ip_hash TEXT NOT NULL DEFAULT '',
			user_agent_hash TEXT NOT NULL DEFAULT '',
			target_type TEXT NOT NULL DEFAULT '',
			target_id TEXT NOT NULL DEFAULT '',
			detail TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_security_audit_logs_created ON security_audit_logs(created_at DESC);`,
		`CREATE TABLE IF NOT EXISTS ai_fixed_answers (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			question TEXT NOT NULL,
			normalized_question TEXT NOT NULL UNIQUE,
			answer TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'active',
			created_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_ai_fixed_answers_status_updated ON ai_fixed_answers(status, updated_at DESC, id DESC);`,
		`CREATE TABLE IF NOT EXISTS ai_image_generations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			user_id INTEGER,
			identity_key TEXT NOT NULL,
			prompt TEXT NOT NULL,
			model TEXT NOT NULL,
			size TEXT NOT NULL,
			image_url TEXT NOT NULL,
			object_key TEXT NOT NULL,
			provider_request_id TEXT NOT NULL DEFAULT '',
			created_at TEXT NOT NULL
		);`,
		`CREATE INDEX IF NOT EXISTS idx_ai_image_generations_user_created ON ai_image_generations(user_id, created_at DESC);`,
		`CREATE TABLE IF NOT EXISTS wallpaper_pool (
			id TEXT PRIMARY KEY,
			url TEXT NOT NULL,
			preview_url TEXT NOT NULL DEFAULT '',
			source TEXT NOT NULL,
			author TEXT NOT NULL DEFAULT '',
			source_url TEXT NOT NULL DEFAULT '',
			license_note TEXT NOT NULL DEFAULT '',
			kind TEXT NOT NULL DEFAULT 'api',
			status TEXT NOT NULL DEFAULT 'active',
			added_at TEXT NOT NULL,
			last_drawn_at TEXT NOT NULL DEFAULT ''
		);`,
		`CREATE INDEX IF NOT EXISTS idx_wallpaper_pool_kind_added ON wallpaper_pool(kind, added_at);`,
		`CREATE INDEX IF NOT EXISTS idx_wallpaper_pool_status ON wallpaper_pool(status);`,
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			return err
		}
	}
	// The cache table shipped once with a total_count column before the data
	// source changed; add the replacement so an existing database keeps working.
	if err := ensureColumn(db, "github_commits", "repo_count", "INTEGER NOT NULL DEFAULT 0"); err != nil {
		return err
	}
	if err := ensureColumn(db, "guestbook_messages", "parent_id", "INTEGER NOT NULL DEFAULT 0"); err != nil {
		return err
	}
	if err := ensureColumn(db, "guestbook_messages", "channel", "TEXT NOT NULL DEFAULT 'guestbook'"); err != nil {
		return err
	}
	if err := ensureColumn(db, "guestbook_messages", "owner_read_at", "TEXT NOT NULL DEFAULT ''"); err != nil {
		return err
	}
	if err := ensureColumn(db, "guestbook_messages", "contact_email", "TEXT NOT NULL DEFAULT ''"); err != nil {
		return err
	}
	if _, err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_guestbook_messages_parent_created ON guestbook_messages(parent_id, created_at ASC);`); err != nil {
		return err
	}
	if _, err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_guestbook_messages_channel_status_parent_created ON guestbook_messages(channel, status, parent_id, created_at DESC);`); err != nil {
		return err
	}
	if err := ensureColumn(db, "users", "is_owner", "INTEGER NOT NULL DEFAULT 0"); err != nil {
		return err
	}
	if err := ensureColumn(db, "users", "display_name", "TEXT NOT NULL DEFAULT ''"); err != nil {
		return err
	}
	if err := ensureColumn(db, "users", "avatar", "TEXT NOT NULL DEFAULT ''"); err != nil {
		return err
	}
	if err := ensureColumn(db, "sessions", "unlimited", "INTEGER NOT NULL DEFAULT 0"); err != nil {
		return err
	}
	if err := ensureColumn(db, "ai_chat_hourly", "owner_calls", "INTEGER NOT NULL DEFAULT 0"); err != nil {
		return err
	}
	if err := ensureColumn(db, "ai_chat_hourly", "owner_tokens", "INTEGER NOT NULL DEFAULT 0"); err != nil {
		return err
	}
	if err := ensureColumn(db, "ai_fixed_answers", "normalized_question", "TEXT NOT NULL DEFAULT ''"); err != nil {
		return err
	}
	for _, column := range []struct {
		name string
		def  string
	}{
		{"original_title", "TEXT NOT NULL DEFAULT ''"},
		{"summary", "TEXT NOT NULL DEFAULT ''"},
		{"air_date", "TEXT NOT NULL DEFAULT ''"},
		{"tags_json", "TEXT NOT NULL DEFAULT '[]'"},
		{"collection_type", "INTEGER NOT NULL DEFAULT 3"},
		{"score", "REAL NOT NULL DEFAULT 0"},
		{"my_rating", "INTEGER NOT NULL DEFAULT 0"},
		{"rank", "INTEGER NOT NULL DEFAULT 0"},
		{"cover_url", "TEXT NOT NULL DEFAULT ''"},
		{"collection_updated_at", "TEXT NOT NULL DEFAULT ''"},
	} {
		if err := ensureColumn(db, "bangumi_items", column.name, column.def); err != nil {
			return err
		}
	}
	if _, err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_bangumi_items_collection_updated ON bangumi_items(collection_type, collection_updated_at DESC)`); err != nil {
		return err
	}
	return nil
}

func ensureColumn(db *sql.DB, table, column, colDef string) error {
	rows, err := db.Query(`PRAGMA table_info(` + table + `)`)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			return err
		}
		if name == column {
			return nil
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	_, err = db.Exec(`ALTER TABLE ` + table + ` ADD COLUMN ` + column + ` ` + colDef)
	return err
}

// replaceGithubCommits swaps the cached commit list in one transaction so a
// reader never sees a half-written list.
func replaceGithubCommits(db *sql.DB, commits []githubCommit, repoCount int) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`DELETE FROM github_commits`); err != nil {
		return err
	}
	now := time.Now().UTC().Format(time.RFC3339)
	for i, c := range commits {
		if _, err := tx.Exec(
			`INSERT INTO github_commits (sha, repo, message, url, committed_at, position, repo_count, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			c.SHA, c.Repo, c.Message, c.URL, c.CommittedAt, i, repoCount, now,
		); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func listGithubCommits(db *sql.DB) ([]githubCommit, int, string, error) {
	rows, err := db.Query(
		`SELECT sha, repo, message, url, committed_at, repo_count, updated_at
		 FROM github_commits ORDER BY position ASC`)
	if err != nil {
		return nil, 0, "", err
	}
	defer rows.Close()

	commits := []githubCommit{}
	repoCount := 0
	syncedAt := ""
	for rows.Next() {
		var c githubCommit
		var rowRepoCount int
		var rowUpdated string
		if err := rows.Scan(&c.SHA, &c.Repo, &c.Message, &c.URL, &c.CommittedAt, &rowRepoCount, &rowUpdated); err != nil {
			return nil, 0, "", err
		}
		repoCount = rowRepoCount
		syncedAt = rowUpdated
		commits = append(commits, c)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, "", err
	}
	return commits, repoCount, syncedAt, nil
}

func replaceBangumiItems(db *sql.DB, items []bangumiItem) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.Exec(`DELETE FROM bangumi_items`); err != nil {
		return err
	}
	now := time.Now().UTC().Format(time.RFC3339)
	for _, it := range items {
		tagsJSON, err := json.Marshal(it.Tags)
		if err != nil {
			return err
		}
		_, err = tx.Exec(
			`INSERT INTO bangumi_items (
				id, title, original_title, summary, air_date, tags_json, collection_type, watched, total, latest_episode,
				score, my_rating, rank, cover_url, cover_path, link_url, collection_updated_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			it.ID, it.Title, it.OriginalTitle, it.Summary, it.AirDate, string(tagsJSON), it.CollectionType, it.Watched, it.Total, it.LatestEpisode,
			it.Score, it.MyRating, it.Rank, it.CoverURL, it.CoverPath, it.LinkURL, it.UpdatedAt, now,
		)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

func listBangumiFromDB(db *sql.DB, collectionType int) ([]bangumiItem, error) {
	rows, err := db.Query(
		`SELECT id, title, original_title, summary, air_date, tags_json, collection_type, watched, total, latest_episode,
		        score, my_rating, rank, cover_url, cover_path, link_url, collection_updated_at
		 FROM bangumi_items
		 WHERE collection_type = ?
		 ORDER BY collection_updated_at DESC, title`,
		collectionType,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []bangumiItem
	for rows.Next() {
		var it bangumiItem
		var coverURL sql.NullString
		var coverPath sql.NullString
		var link sql.NullString
		var tagsJSON string
		if err := rows.Scan(
			&it.ID, &it.Title, &it.OriginalTitle, &it.Summary, &it.AirDate, &tagsJSON, &it.CollectionType, &it.Watched, &it.Total,
			&it.LatestEpisode, &it.Score, &it.MyRating, &it.Rank, &coverURL, &coverPath, &link, &it.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if tagsJSON != "" {
			_ = json.Unmarshal([]byte(tagsJSON), &it.Tags)
		}
		if coverPath.Valid && coverPath.String != "" {
			it.CoverURL = "/api/v1/acg/image/" + coverPath.String
		} else if coverURL.Valid {
			it.CoverURL = coverURL.String
		}
		if link.Valid {
			it.LinkURL = link.String
		}
		items = append(items, it)
	}
	return items, nil
}

func bangumiCollectionCounts(db *sql.DB) (map[string]int, error) {
	counts := map[string]int{"watching": 0, "watched": 0, "wish": 0}
	rows, err := db.Query(`SELECT collection_type, COUNT(*) FROM bangumi_items GROUP BY collection_type`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var collectionType, count int
		if err := rows.Scan(&collectionType, &count); err != nil {
			return nil, err
		}
		if status, ok := bangumiStatusFromCollectionType(collectionType); ok {
			counts[status] = count
		}
	}
	return counts, rows.Err()
}

func bangumiStatusFromCollectionType(collectionType int) (string, bool) {
	switch collectionType {
	case bangumiCollectionWatching:
		return "watching", true
	case bangumiCollectionWatched:
		return "watched", true
	case bangumiCollectionWish:
		return "wish", true
	default:
		return "", false
	}
}
