package main

import (
	"database/sql"
	"testing"

	_ "modernc.org/sqlite"
)

func TestMigrateAllAddsParentIDBeforeParentIndexForLegacyGuestbookMessages(t *testing.T) {
	testDB, err := sql.Open("sqlite", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer testDB.Close()

	_, err = testDB.Exec(`CREATE TABLE guestbook_messages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER,
		nickname TEXT NOT NULL,
		avatar TEXT NOT NULL DEFAULT '',
		content TEXT NOT NULL,
		content_hash TEXT NOT NULL DEFAULT '',
		ip_hash TEXT NOT NULL,
		ip_region TEXT NOT NULL DEFAULT '',
		ip_masked TEXT NOT NULL DEFAULT '',
		user_agent_hash TEXT NOT NULL DEFAULT '',
		status TEXT NOT NULL DEFAULT 'visible',
		is_login_user INTEGER NOT NULL DEFAULT 0,
		is_admin_user INTEGER NOT NULL DEFAULT 0,
		created_at TEXT NOT NULL,
		updated_at TEXT NOT NULL
	);`)
	if err != nil {
		t.Fatal(err)
	}

	if err := migrateAll(testDB); err != nil {
		t.Fatalf("migrateAll failed for legacy guestbook_messages: %v", err)
	}

	var parentColumnCount int
	if err := testDB.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('guestbook_messages') WHERE name = 'parent_id'`).Scan(&parentColumnCount); err != nil {
		t.Fatal(err)
	}
	if parentColumnCount != 1 {
		t.Fatalf("expected parent_id column to be added, got count %d", parentColumnCount)
	}

	var parentIndexCount int
	if err := testDB.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'idx_guestbook_messages_parent_created'`).Scan(&parentIndexCount); err != nil {
		t.Fatal(err)
	}
	if parentIndexCount != 1 {
		t.Fatalf("expected parent index to be created, got count %d", parentIndexCount)
	}

	var channelColumnCount int
	if err := testDB.QueryRow(`SELECT COUNT(*) FROM pragma_table_info('guestbook_messages') WHERE name = 'channel'`).Scan(&channelColumnCount); err != nil {
		t.Fatal(err)
	}
	if channelColumnCount != 1 {
		t.Fatalf("expected channel column to be added, got count %d", channelColumnCount)
	}

	var channelIndexCount int
	if err := testDB.QueryRow(`SELECT COUNT(*) FROM sqlite_master WHERE type = 'index' AND name = 'idx_guestbook_messages_channel_status_parent_created'`).Scan(&channelIndexCount); err != nil {
		t.Fatal(err)
	}
	if channelIndexCount != 1 {
		t.Fatalf("expected channel index to be created, got count %d", channelIndexCount)
	}
}
