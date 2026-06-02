package main

import (
	"database/sql"
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
		`CREATE TABLE IF NOT EXISTS bangumi_items (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			watched INTEGER NOT NULL DEFAULT 0,
			total INTEGER NOT NULL DEFAULT 0,
			latest_episode INTEGER NOT NULL DEFAULT 0,
			cover_path TEXT,
			link_url TEXT,
			updated_at TEXT NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS radar_creators (
			uid TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			enabled INTEGER NOT NULL DEFAULT 1
		);`,
		`CREATE TABLE IF NOT EXISTS radar_feed (
			id TEXT PRIMARY KEY,
			up_uid TEXT NOT NULL,
			creator_name TEXT NOT NULL,
			latest_text TEXT NOT NULL,
			cover_path TEXT,
			link_url TEXT,
			is_new INTEGER NOT NULL DEFAULT 0,
			published_at TEXT NOT NULL,
			updated_at TEXT NOT NULL
		);`,
		`CREATE TABLE IF NOT EXISTS ai_chat_quota (
			identity_key TEXT NOT NULL,
			quota_date TEXT NOT NULL,
			used INTEGER NOT NULL DEFAULT 0,
			last_request_at TEXT,
			PRIMARY KEY (identity_key, quota_date)
		);`,
		`CREATE TABLE IF NOT EXISTS users (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			email TEXT NOT NULL UNIQUE,
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
	}
	for _, s := range stmts {
		if _, err := db.Exec(s); err != nil {
			return err
		}
	}
	ensureColumn(db, "users", "is_owner", "INTEGER NOT NULL DEFAULT 0")
	ensureColumn(db, "sessions", "unlimited", "INTEGER NOT NULL DEFAULT 0")
	return nil
}

func ensureColumn(db *sql.DB, table, column, colDef string) {
	rows, err := db.Query(`PRAGMA table_info(` + table + `)`)
	if err != nil {
		return
	}
	defer rows.Close()
	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull, pk int
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			return
		}
		if name == column {
			return
		}
	}
	_, _ = db.Exec(`ALTER TABLE ` + table + ` ADD COLUMN ` + column + ` ` + colDef)
}

func upsertRadarCreators(db *sql.DB, creators []RadarCreator) error {
	for _, c := range creators {
		_, err := db.Exec(
			`INSERT INTO radar_creators (uid, name, enabled) VALUES (?, ?, 1)
			 ON CONFLICT(uid) DO UPDATE SET name=excluded.name`,
			c.UID, c.Name,
		)
		if err != nil {
			return err
		}
	}
	return nil
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
		_, err := tx.Exec(
			`INSERT INTO bangumi_items (id, title, watched, total, latest_episode, cover_path, link_url, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			it.ID, it.Title, it.Watched, it.Total, it.LatestEpisode, it.CoverPath, it.LinkURL, now,
		)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

func upsertRadarFeed(db *sql.DB, item radarItem) error {
	now := time.Now().UTC().Format(time.RFC3339)
	isNew := 0
	if item.IsNew {
		isNew = 1
	}
	_, err := db.Exec(
		`INSERT INTO radar_feed (id, up_uid, creator_name, latest_text, cover_path, link_url, is_new, published_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET
		   creator_name=excluded.creator_name,
		   latest_text=excluded.latest_text,
		   cover_path=excluded.cover_path,
		   link_url=excluded.link_url,
		   is_new=excluded.is_new,
		   published_at=excluded.published_at,
		   updated_at=excluded.updated_at`,
		item.ID, item.UpUID, item.CreatorName, item.LatestText, item.CoverPath, item.LinkURL, isNew, item.PublishedAt, now,
	)
	return err
}

func listBangumiFromDB(db *sql.DB) ([]bangumiItem, error) {
	rows, err := db.Query(
		`SELECT id, title, watched, total, latest_episode, cover_path, link_url FROM bangumi_items ORDER BY title`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []bangumiItem
	for rows.Next() {
		var it bangumiItem
		var coverPath sql.NullString
		var link sql.NullString
		if err := rows.Scan(&it.ID, &it.Title, &it.Watched, &it.Total, &it.LatestEpisode, &coverPath, &link); err != nil {
			return nil, err
		}
		if coverPath.Valid && coverPath.String != "" {
			it.CoverURL = "/api/v1/acg/image/" + coverPath.String
		}
		if link.Valid {
			it.LinkURL = link.String
		}
		items = append(items, it)
	}
	return items, nil
}

func listRadarFromDB(db *sql.DB) ([]radarItem, error) {
	rows, err := db.Query(
		`SELECT id, creator_name, latest_text, is_new, link_url, cover_path FROM radar_feed ORDER BY published_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []radarItem
	for rows.Next() {
		var it radarItem
		var isNew int
		var coverPath sql.NullString
		if err := rows.Scan(&it.ID, &it.CreatorName, &it.LatestText, &isNew, &it.LinkURL, &coverPath); err != nil {
			return nil, err
		}
		it.IsNew = isNew == 1
		if coverPath.Valid && coverPath.String != "" {
			it.CoverURL = "/api/v1/acg/image/" + coverPath.String
		}
		items = append(items, it)
	}
	return items, nil
}
