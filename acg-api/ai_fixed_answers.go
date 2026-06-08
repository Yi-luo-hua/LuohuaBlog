package main

import (
	"database/sql"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"
)

const (
	aiFixedAnswerQuestionMax = 240
	aiFixedAnswerBodyMax     = 4000
	ownerFixedAnswerLimit    = 50
)

type aiFixedAnswerRow struct {
	ID        int64  `json:"id"`
	Question  string `json:"question"`
	Answer    string `json:"answer"`
	Status    string `json:"status"`
	CreatedAt string `json:"createdAt"`
	UpdatedAt string `json:"updatedAt"`
}

func normalizeAIFixedQuestion(value string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return ""
	}
	var b strings.Builder
	spacePending := false
	for _, r := range strings.ToLower(value) {
		if unicode.IsSpace(r) {
			spacePending = true
			continue
		}
		if spacePending && b.Len() > 0 {
			b.WriteByte(' ')
		}
		spacePending = false
		b.WriteRune(r)
	}
	return b.String()
}

func listAIFixedAnswers(db *sql.DB, limit int) ([]aiFixedAnswerRow, error) {
	rows, err := db.Query(
		`SELECT id, question, answer, status, created_at, updated_at
		 FROM ai_fixed_answers
		 WHERE status = 'active'
		 ORDER BY updated_at DESC, id DESC
		 LIMIT ?`,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]aiFixedAnswerRow, 0, limit)
	for rows.Next() {
		var item aiFixedAnswerRow
		if err := rows.Scan(
			&item.ID,
			&item.Question,
			&item.Answer,
			&item.Status,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func hasAIFixedAnswers(db *sql.DB) bool {
	var exists int
	err := db.QueryRow(`SELECT 1 FROM ai_fixed_answers WHERE status = 'active' LIMIT 1`).Scan(&exists)
	return err == nil
}

func findAIFixedAnswer(db *sql.DB, question string) (aiFixedAnswerRow, bool, error) {
	normalized := normalizeAIFixedQuestion(question)
	if normalized == "" {
		return aiFixedAnswerRow{}, false, nil
	}
	var item aiFixedAnswerRow
	err := db.QueryRow(
		`SELECT id, question, answer, status, created_at, updated_at
		 FROM ai_fixed_answers
		 WHERE normalized_question = ? AND status = 'active'
		 LIMIT 1`,
		normalized,
	).Scan(
		&item.ID,
		&item.Question,
		&item.Answer,
		&item.Status,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return aiFixedAnswerRow{}, false, nil
	}
	if err != nil {
		return aiFixedAnswerRow{}, false, err
	}
	return item, true, nil
}

func upsertAIFixedAnswer(db *sql.DB, question, answer string) (aiFixedAnswerRow, error) {
	question = strings.TrimSpace(question)
	answer = strings.TrimSpace(answer)
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := db.Exec(
		`INSERT INTO ai_fixed_answers (question, normalized_question, answer, status, created_at, updated_at)
		 VALUES (?, ?, ?, 'active', ?, ?)
		 ON CONFLICT(normalized_question) DO UPDATE SET
		   question = excluded.question,
		   answer = excluded.answer,
		   status = 'active',
		   updated_at = excluded.updated_at`,
		question,
		normalizeAIFixedQuestion(question),
		answer,
		now,
		now,
	)
	if err != nil {
		return aiFixedAnswerRow{}, err
	}
	item, ok, err := findAIFixedAnswer(db, question)
	if err != nil {
		return aiFixedAnswerRow{}, err
	}
	if ok {
		return item, nil
	}
	return aiFixedAnswerRow{}, sql.ErrNoRows
}

func validAIFixedAnswerInput(question, answer string) bool {
	return strings.TrimSpace(question) != "" &&
		strings.TrimSpace(answer) != "" &&
		utf8.RuneCountInString(question) <= aiFixedAnswerQuestionMax &&
		utf8.RuneCountInString(answer) <= aiFixedAnswerBodyMax
}
