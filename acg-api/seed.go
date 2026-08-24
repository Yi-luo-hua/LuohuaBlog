package main

import (
	"database/sql"
	"log"
)

func seedDefaultACGData(db *sql.DB) {
	if _, err := db.Exec(`DELETE FROM bangumi_items WHERE id IN ('b1', 'b2', 'b3', 'b4')`); err != nil {
		log.Println("seed: remove legacy bangumi placeholders:", err)
	}
}
